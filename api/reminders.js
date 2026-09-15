const { getJsonFile, putJsonFile } = require('./_github');
const { sendWhatsAppText } = require('./_whatsapp');

module.exports = async function handler(req, res) {
  try {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ message: 'Invalid cron authorization.' });
    }

    const taskFile = await getJsonFile('data/assigned-tasks.json');
    const employeeFile = await getJsonFile('employees.json');
    const waFile = await getJsonFile('whatsapp-users.json');

    const tasks = Array.isArray(taskFile.data)
      ? taskFile.data
      : (taskFile.data?.tasks || []);
    const employees = Array.isArray(employeeFile.data)
      ? employeeFile.data
      : (employeeFile.data?.employees || []);
    const users = waFile.data?.users || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let changed = false;
    let sent = 0;

    for (const task of tasks) {
      if (!task || task.done || !task.deadline) continue;

      const deadline = new Date(task.deadline);
      if (Number.isNaN(deadline.getTime())) continue;
      deadline.setHours(0, 0, 0, 0);

      const diffDays = Math.round((deadline - today) / 86400000);
      if (![5, 2].includes(diffDays)) continue;

      task.remindersSent = Array.isArray(task.remindersSent) ? task.remindersSent : [];
      const key = `D-${diffDays}`;
      if (task.remindersSent.includes(key)) continue;

      const employee = employees.find(e => Number(e.id) === Number(task.assigneeId));
      if (!employee) continue;

      const recipient = users[String(employee.id)]?.whatsappUserId || employee.phone;
      const message =
        `⏰ Irrigation Division Bareilly Reminder\\n\\n` +
        `Hi ${task.assignee}, your task is due in ${diffDays} day${diffDays === 1 ? '' : 's'}.\\n\\n` +
        `📋 ${task.desc}\\n📅 Deadline: ${task.deadline}\\n\\n` +
        `Please complete it from the task link or reply DONE ${task.id} on WhatsApp.`;

      try {
        await sendWhatsAppText(recipient, message);
        task.remindersSent.push(key);
        changed = true;
        sent++;
      } catch (error) {
        console.error(`Reminder failed for task ${task.id}:`, error.message);
      }
    }

    if (changed) {
      await putJsonFile(
        'data/assigned-tasks.json',
        { version: 1, tasks },
        taskFile.sha,
        'Send scheduled WhatsApp task reminders'
      );
    }

    return res.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Reminder job failed.' });
  }
};