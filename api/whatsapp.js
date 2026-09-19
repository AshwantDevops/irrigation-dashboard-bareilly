const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile } = require('./_github');
const { sendWhatsAppTemplate, cleanPhone } = require('./_whatsapp');

const EMPLOYEE_PATH = 'employees.json';
const TASK_ASSIGNMENT_TEMPLATE = 'task_assignment';
const TASK_ASSIGNMENT_LANGUAGE = 'en_US';

function publicBaseUrl(req) {
  const forwarded = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return process.env.APP_BASE_URL || `${forwarded}://${host}`;
}

async function findEmployeeByPhone(phone) {
  const file = await getJsonFile(EMPLOYEE_PATH);
  const employees = Array.isArray(file.data)
    ? file.data
    : (file.data?.employees || []);

  const normalized = cleanPhone(phone);
  return employees.find(employee => cleanPhone(employee?.phone) === normalized) || null;
}

module.exports = async function handler(req, res) {
  try {
    await authenticate(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed.' });
    }

    const body = req.body || {};

    if (body.action !== 'assignment') {
      return res.status(400).json({ message: 'Unsupported WhatsApp action.' });
    }

    const employee = await findEmployeeByPhone(body.recipient);

    if (!employee) {
      return res.status(403).json({
        message: 'WhatsApp recipient is not registered in employees.json.'
      });
    }

    if (!body.taskId || !body.publicToken || !body.taskTitle || !body.deadline) {
      return res.status(400).json({
        message: 'Task ID, task token, task title and deadline are required.'
      });
    }

    const taskUrl =
      `${publicBaseUrl(req)}/task.html?id=${encodeURIComponent(body.taskId)}&token=${encodeURIComponent(body.publicToken)}#task`;

    const result = await sendWhatsAppTemplate(
      employee.phone,
      TASK_ASSIGNMENT_TEMPLATE,
      TASK_ASSIGNMENT_LANGUAGE,
      [
        { name: 'employee_name', value: employee.name },
        { name: 'task_description', value: body.taskTitle },
        { name: 'deadline', value: body.deadline },
        { name: 'task_id', value: body.taskId },
        { name: 'task_url', value: taskUrl }
      ]
    );

    return res.status(200).json({
      ok: true,
      result,
      whatsappTemplateName: TASK_ASSIGNMENT_TEMPLATE,
      whatsappTemplateLanguage: TASK_ASSIGNMENT_LANGUAGE
    });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);

    return res.status(500).json({
      message: error.message || 'WhatsApp template API failed.',
      whatsappErrorCode: error.code || null,
      whatsappErrorType: error.type || null,
      whatsappErrorData: error.errorData || null
    });
  }
};
