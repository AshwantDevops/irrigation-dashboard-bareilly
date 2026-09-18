const { getJsonFile, putJsonFile } = require('./_github');
const { sendWhatsAppText, cleanPhone } = require('./_whatsapp');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';

async function findEmployeeByWhatsApp(from) {
  const file = await getJsonFile('employees.json');
  const employees = Array.isArray(file.data)
    ? file.data
    : (file.data?.employees || []);

  const normalizedFrom = cleanPhone(from);
  const match = employees.find(
    employee => cleanPhone(employee?.phone) === normalizedFrom
  );

  return match ? Number(match.id) : null;
}

async function getEmployee(employeeId) {
  const file = await getJsonFile('employees.json');
  const employees = Array.isArray(file.data) ? file.data : (file.data?.employees || []);
  return employees.find(e => Number(e.id) === Number(employeeId)) || null;
}

async function updateTasks(mutator) {
  const file = await getJsonFile('data/assigned-tasks.json');
  const tasks = Array.isArray(file.data) ? file.data : (file.data?.tasks || []);
  const changed = await mutator(tasks);
  if (changed) {
    await putJsonFile(
      'data/assigned-tasks.json',
      { version: 1, tasks },
      file.sha,
      'Update task from WhatsApp'
    );
  }
  return tasks;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const entries = req.body?.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];

        for (const message of messages) {
          if (message.type !== 'text') continue;

          const from = message.from;
          const command = String(message.text?.body || '').trim();
          const employeeId = await findEmployeeByWhatsApp(from);

          if (!employeeId) {
            await sendWhatsAppText(from, 'Your WhatsApp number is not registered with the Irrigation Office Portal.');
            continue;
          }

          const employee = await getEmployee(employeeId);
          const upper = command.toUpperCase();

          if (upper === 'LIST' || upper === 'TASKS') {
            const tasks = await updateTasks(() => false);
            const mine = tasks.filter(t => Number(t.assigneeId) === employeeId && !t.done);

            const body = mine.length
              ? '📋 Your open tasks:\\n\\n' + mine.map(t => `#${t.id} - ${t.desc} (Due: ${t.deadline})`).join('\\n')
              : '✅ You have no open tasks.';

            await sendWhatsAppText(from, body);
            continue;
          }

          const doneMatch = command.match(/^(?:DONE|COMPLETE|COMPLETED)\s+(\d+)$/i);

          if (doneMatch) {
            const taskId = doneMatch[1];
            let completed = false;

            const tasks = await updateTasks(items => {
              const task = items.find(
                t => String(t.id) === taskId && Number(t.assigneeId) === employeeId
              );

              if (!task || task.done) return false;

              task.done = true;
              task.status = 'Completed';
              task.completedAt = new Date().toISOString();
              completed = true;
              return true;
            });

            await sendWhatsAppText(
              from,
              completed
                ? `✅ Task #${taskId} marked completed.\\n\\nThank you, ${employee?.name || 'User'}.`
                : `Task #${taskId} was not found or is already completed.`
            );
            continue;
          }

          await sendWhatsAppText(
            from,
            'Available commands:\\nLIST - show your open tasks\\nDONE <task-id> - mark a task completed'
          );
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'WhatsApp webhook failed.' });
  }
};