const crypto = require('crypto');
const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile, putJsonFile } = require('./_github');
const { sendWhatsAppTemplate } = require('./_whatsapp');

const TASK_PATH = 'data/assigned-tasks.json';
const EMPLOYEE_PATH = 'employees.json';
const TASK_ASSIGNMENT_TEMPLATE = 'task_assignment';
const TASK_ASSIGNMENT_LANGUAGE = 'en_US';
const DEPLOYMENT_VERSION = 'whatsapp-debug-v4-20260919';

async function readTasks() {
  const current = await getJsonFile(TASK_PATH);
  return {
    current,
    tasks: Array.isArray(current.data) ? current.data : (current.data?.tasks || [])
  };
}

async function readEmployees() {
  const current = await getJsonFile(EMPLOYEE_PATH);
  return Array.isArray(current.data) ? current.data : (current.data?.employees || []);
}

function publicBaseUrl(req) {
  const forwarded = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return process.env.APP_BASE_URL || `${forwarded}://${host}`;
}

function taskLink(req, task) {
  return `${publicBaseUrl(req)}/task.html?id=${encodeURIComponent(task.id)}&token=${encodeURIComponent(task.publicToken)}&wa=1`;
}

function formatWhatsAppDeadline(deadline) {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return String(deadline);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

module.exports = async function handler(req, res) {
  try {
    const requestId = crypto.randomUUID();
    console.info('[TaskAssignment][START]', JSON.stringify({
      requestId,
      method: req.method,
      host: req.headers.host || null,
      deploymentVersion: DEPLOYMENT_VERSION,
      queryId: req.query.id || null,
      hasPublicToken: Boolean(req.query.token || req.body?.token)
    }));

    const rawPublicToken = req.query.token || req.body?.token || '';
    // WhatsApp can append text after a detected URL. The public token is
    // always a 36-character lowercase hexadecimal value, so extract exactly
    // that value before validating it.
    const tokenMatch = String(rawPublicToken).match(/^[a-f0-9]{36}/i);
    const publicToken = tokenMatch ? tokenMatch[0] : String(rawPublicToken).trim();
    const publicRequest = Boolean(publicToken);
    let user = null;

    if (!publicRequest) {
      user = await authenticate(req);
    }

    const { current, tasks } = await readTasks();

    if (req.method === 'GET') {
      const id = req.query.id;

      if (id) {
        const task = tasks.find(t => String(t.id) === String(id));
        if (!task) return res.status(404).json({ message: 'Task not found.' });

        // A public task page may request a task using its public token.
        if (publicToken && publicToken === task.publicToken) {
          return res.status(200).json({ task });
        }

        return res.status(403).json({ message: 'Invalid task token.' });
      }

      return res.status(200).json({ tasks });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const employees = await readEmployees();
      const employee = employees.find(e => Number(e.id) === Number(body.assigneeId));

      console.info('[TaskAssignment][EMPLOYEE]', JSON.stringify({
        requestId,
        assigneeId: body.assigneeId || null,
        employeeFound: Boolean(employee),
        employeeId: employee?.id || null,
        employeeName: employee?.name || null,
        phoneLast4: employee?.phone ? String(employee.phone).replace(/\D/g, '').slice(-4) : null,
        template: TASK_ASSIGNMENT_TEMPLATE,
        language: TASK_ASSIGNMENT_LANGUAGE
      }));

      if (!employee) return res.status(400).json({ message: 'Assigned employee not found.' });
      if (!body.desc || !body.deadline) {
        return res.status(400).json({ message: 'Task description and deadline are required.' });
      }

      const id = Date.now();
      const publicToken = crypto.randomBytes(18).toString('hex');
      const task = {
        id,
        assigneeId: employee.id,
        assignee: employee.name,
        deadline: body.deadline,
        desc: body.desc,
        publicToken,
        createdBy: user.email,
        createdAt: new Date().toISOString(),
        m80: false,
        m50: false,
        m10: false,
        status: 'Pending',
        done: false,
        completedAt: null,
        remindersSent: []
      };

      const updated = [...tasks, task];
      await putJsonFile(
        TASK_PATH,
        { version: 1, tasks: updated },
        current.sha,
        `Assign task #${id}`
      );

      let whatsappSent = false;
      let whatsappMessageId = null;
      let whatsappStatus = 'not_sent';
      let whatsappStatusAt = null;
      let whatsappError = null;
      let whatsappErrorCode = null;
      let whatsappErrorType = null;
      let whatsappErrorData = null;

      try {
        const recipient = employee.phone;

        if (!recipient) {
          throw new Error(`No WhatsApp number is registered for ${employee.name}.`);
        }

        const link = taskLink(req, task);
        const deadline = formatWhatsAppDeadline(task.deadline);

        const whatsappResult = await sendWhatsAppTemplate(
          recipient,
          TASK_ASSIGNMENT_TEMPLATE,
          TASK_ASSIGNMENT_LANGUAGE,
          [
            { name: 'employee_name', value: employee.name },
            { name: 'task_description', value: task.desc },
            { name: 'deadline', value: deadline },
            { name: 'task_id', value: task.id },
            { name: 'task_url', value: link }
          ],
          { requestId }
        );

        whatsappMessageId = whatsappResult?.messages?.[0]?.id || null;
        whatsappStatus = 'accepted';
        whatsappStatusAt = new Date().toISOString();
        whatsappSent = true;
      } catch (error) {
        console.error('[TaskAssignment][WHATSAPP_ERROR]', JSON.stringify({
          requestId,
          employeeId: employee.id,
          employeeName: employee.name,
          phoneLast4: String(employee.phone || '').replace(/\D/g, '').slice(-4),
          template: TASK_ASSIGNMENT_TEMPLATE,
          language: TASK_ASSIGNMENT_LANGUAGE,
          errorMessage: error.message || null,
          metaErrorCode: error.code || null,
          metaErrorType: error.type || null,
          metaErrorData: error.errorData || null,
          fbtraceId: error.fbtraceId || null
        }));
        console.error('Assignment WhatsApp template failed:', error);
        whatsappStatus = 'failed';
        whatsappStatusAt = new Date().toISOString();
        whatsappError = error.message || 'WhatsApp API request failed.';
        whatsappErrorCode = error.code || null;
        whatsappErrorType = error.type || null;
        whatsappErrorData = error.errorData || null;
      }

      // The Graph API accepts a message before WhatsApp finishes delivery.
      // Persist the returned WAMID so the webhook can later update the real
      // sent/delivered/read/failed status for this task.
      let responseTasks = updated;
      try {
        const latest = await readTasks();
        const latestIndex = latest.tasks.findIndex(t => String(t.id) === String(task.id));

        if (latestIndex >= 0) {
          latest.tasks[latestIndex] = {
            ...latest.tasks[latestIndex],
            whatsappMessageId,
            whatsappStatus,
            whatsappStatusAt,
            whatsappError,
            whatsappErrorCode,
            whatsappErrorType,
            whatsappErrorData
          };

          await putJsonFile(
            TASK_PATH,
            { version: 1, tasks: latest.tasks },
            latest.current.sha,
            `Record WhatsApp status for task #${id}`
          );

          responseTasks = latest.tasks;
          Object.assign(task, latest.tasks[latestIndex]);
        }
      } catch (trackingError) {
        // Do not report a task assignment as failed just because status
        // bookkeeping could not be written after Meta accepted the message.
        console.error('Unable to persist WhatsApp message status:', trackingError);
      }

      res.setHeader('X-Irrigation-Deployment-Version', DEPLOYMENT_VERSION);
      res.setHeader('X-Irrigation-Request-Id', requestId);

      console.info('[TaskAssignment][END]', JSON.stringify({
        requestId,
        taskId: task.id,
        whatsappStatus,
        whatsappSent,
        whatsappMessageId,
        whatsappErrorCode,
        whatsappErrorType
      }));

      return res.status(201).json({
        task,
        tasks: responseTasks,
        whatsappSent,
        whatsappMessageId,
        whatsappStatus,
        whatsappStatusAt,
        whatsappTemplateName: TASK_ASSIGNMENT_TEMPLATE,
        whatsappTemplateLanguage: TASK_ASSIGNMENT_LANGUAGE,
        deploymentVersion: DEPLOYMENT_VERSION,
        whatsappError,
        whatsappErrorCode,
        whatsappErrorType,
        whatsappErrorData
      });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || '');
      const body = req.body || {};
      const index = tasks.findIndex(t => String(t.id) === id);

      if (index < 0) return res.status(404).json({ message: 'Task not found.' });

      const task = tasks[index];

      // Dashboard users authenticate with Google. Public task page uses the per-task token.
      const tokenAllowed = body.token && body.token === task.publicToken;
      if (!tokenAllowed && !user?.email) {
        return res.status(403).json({ message: 'Not authorized.' });
      }

      if (body.action === 'complete') {
        task.done = true;
        task.status = 'Completed';
        task.completedAt = new Date().toISOString();
      } else {
        Object.assign(task, body);
      }

      const updated = [...tasks];
      updated[index] = task;

      await putJsonFile(
        TASK_PATH,
        { version: 1, tasks: updated },
        current.sha,
        `Update task #${id}`
      );

      return res.status(200).json({ task, tasks: updated });
    }

    if (req.method === 'DELETE') {
      if (String(req.query.all) !== 'true') {
        return res.status(400).json({ message: 'Use ?all=true to clear tasks.' });
      }

      await putJsonFile(
        TASK_PATH,
        { version: 1, tasks: [] },
        current.sha,
        'Clear assigned tasks'
      );

      return res.status(200).json({ message: 'All tasks cleared.' });
    }

    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({ message: error.message || 'Task API failed.' });
  }
};
