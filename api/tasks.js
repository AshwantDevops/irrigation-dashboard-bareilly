const crypto = require('crypto');
const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile, putJsonFile } = require('./_github');
const { sendWhatsAppText } = require('./_whatsapp');

const TASK_PATH = 'data/assigned-tasks.json';
const EMPLOYEE_PATH = 'employees.json';
const WA_PATH = 'whatsapp-users.json';

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

async function readWhatsAppUsers() {
  const current = await getJsonFile(WA_PATH);
  return current.data?.users || {};
}

function publicBaseUrl(req) {
  const forwarded = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return process.env.APP_BASE_URL || `${forwarded}://${host}`;
}

function taskLink(req, task) {
  return `${publicBaseUrl(req)}/task.html?id=${encodeURIComponent(task.id)}&token=${encodeURIComponent(task.publicToken)}`;
}

module.exports = async function handler(req, res) {
  try {
    const user = await authenticate(req);
    const { current, tasks } = await readTasks();

    if (req.method === 'GET') {
      const id = req.query.id;

      if (id) {
        const task = tasks.find(t => String(t.id) === String(id));
        if (!task) return res.status(404).json({ message: 'Task not found.' });

        // A public task page may request a task using its public token.
        if (req.query.token && req.query.token === task.publicToken) {
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
      try {
        const users = await readWhatsAppUsers();
        const recipient = users[String(employee.id)]?.whatsappUserId || employee.phone;
        const link = taskLink(req, task);

        await sendWhatsAppText(
          recipient,
          `📢 Irrigation Division Bareilly\\n\\nNew task assigned to you.\\n\\n📋 Task: ${task.desc}\\n📅 Deadline: ${task.deadline}\\n\\nOpen task: ${link}\\n\\nReply DONE ${task.id} on WhatsApp when completed.`
        );
        whatsappSent = true;
      } catch (error) {
        console.error('Assignment WhatsApp failed:', error);
      }

      return res.status(201).json({ task, tasks: updated, whatsappSent });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || '');
      const body = req.body || {};
      const index = tasks.findIndex(t => String(t.id) === id);

      if (index < 0) return res.status(404).json({ message: 'Task not found.' });

      const task = tasks[index];

      // Dashboard users authenticate with Google. Public task page uses the per-task token.
      const tokenAllowed = body.token && body.token === task.publicToken;
      if (!tokenAllowed && !user.email) {
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