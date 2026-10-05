const { authenticate, sendAuthError } = require('./_auth');
const { getJsonFile, putJsonFile } = require('./_github');

const PATH = 'tasks.json';
const EMPLOYEE_PATH = 'employees.json';

function hasAdminProfile(employees, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  return employees.some(employee =>
    String(employee.email || '').trim().toLowerCase() === normalizedEmail &&
    String(employee.post || '').trim().toLowerCase() === 'admin'
  );
}

async function readSchedule() {
  const current = await getJsonFile(PATH);
  return {
    current,
    tasks: Array.isArray(current.data)
      ? current.data
      : (current.data?.tasks || [])
  };
}

async function canManage(req) {
  const auth = await authenticate(req);
  const employeeFile = await getJsonFile(EMPLOYEE_PATH);
  const employees = Array.isArray(employeeFile.data)
    ? employeeFile.data
    : (employeeFile.data?.employees || []);

  return !!auth.isAdmin || hasAdminProfile(employees, auth.email);
}

module.exports = async function handler(req, res) {
  try {
    const { current, tasks } = await readSchedule();

    if (req.method === 'GET') {
      return res.status(200).json({ tasks });
    }

    const allowed = await canManage(req);
    if (!allowed) {
      return res.status(403).json({
        message: 'Administrator access is required to modify the Master Schedule.'
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const work = String(body.work || '').trim();
      const deadline = String(body.deadline || '').trim();

      if (!work || !deadline) {
        return res.status(400).json({
          message: 'Work name and deadline/frequency are required.'
        });
      }

      const newTask = {
        id: Date.now(),
        work,
        deadline
      };

      const updated = [...tasks, newTask];

      await putJsonFile(
        PATH,
        { version: 1, tasks: updated },
        current.sha,
        'Add Master Schedule task'
      );

      return res.status(200).json({ tasks: updated, task: newTask });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const id = Number(body.id);
      const work = String(body.work || '').trim();
      const deadline = String(body.deadline || '').trim();

      if (!Number.isFinite(id) || !work || !deadline) {
        return res.status(400).json({
          message: 'Valid task ID, work name and deadline/frequency are required.'
        });
      }

      const index = tasks.findIndex(task => Number(task.id) === id);
      if (index < 0) {
        return res.status(404).json({ message: 'Master Schedule task not found.' });
      }

      const updated = [...tasks];
      updated[index] = {
        ...updated[index],
        work,
        deadline
      };

      await putJsonFile(
        PATH,
        { version: 1, tasks: updated },
        current.sha,
        'Edit Master Schedule task'
      );

      return res.status(200).json({ tasks: updated, task: updated[index] });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id || req.body?.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'A valid task ID is required.' });
      }

      const updated = tasks.filter(task => Number(task.id) !== id);

      if (updated.length === tasks.length) {
        return res.status(404).json({ message: 'Master Schedule task not found.' });
      }

      await putJsonFile(
        PATH,
        { version: 1, tasks: updated },
        current.sha,
        'Delete Master Schedule task'
      );

      return res.status(200).json({ tasks: updated });
    }

    return res.status(405).json({ message: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({
      message: error.message || 'Master Schedule API failed.'
    });
  }
};
