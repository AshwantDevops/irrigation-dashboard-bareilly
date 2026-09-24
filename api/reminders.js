const { getJsonFile, putJsonFile } = require('./_github');
const { sendWhatsAppTemplate } = require('./_whatsapp');

const MILESTONES = [
  { percent: 80, key: 'M80' },
  { percent: 50, key: 'M50' },
  { percent: 10, key: 'M10' }
];

const REMINDER_TEMPLATE =
  process.env.WHATSAPP_REMINDER_TEMPLATE || 'task_reminder';
const REMINDER_LANGUAGE =
  process.env.WHATSAPP_REMINDER_LANGUAGE || 'en';

function formatRemaining(ms) {
  if (ms <= 0) return '0 minutes';

  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes && parts.length < 2) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  return parts.join(' ') || 'less than 1 minute';
}

function formatDeadline(deadline) {
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

function taskLink(req, task) {
  const forwarded = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = process.env.APP_BASE_URL || `${forwarded}://${host}`;

  return `${baseUrl}/?wa=1`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ message: 'Invalid cron authorization.' });
    }

    const taskFile = await getJsonFile('data/assigned-tasks.json');
    const employeeFile = await getJsonFile('employees.json');
    const tasks = Array.isArray(taskFile.data)
      ? taskFile.data
      : (taskFile.data?.tasks || []);
    const employees = Array.isArray(employeeFile.data)
      ? employeeFile.data
      : (employeeFile.data?.employees || []);
    const now = Date.now();
    let changed = false;
    let sent = 0;

    for (const task of tasks) {
      if (!task || task.done || !task.deadline || !task.createdAt) continue;

      const start = new Date(task.createdAt);
      const deadline = new Date(task.deadline);

      if (Number.isNaN(start.getTime()) || Number.isNaN(deadline.getTime())) continue;

      const totalMs = deadline.getTime() - start.getTime();
      const remainingMs = deadline.getTime() - now;

      // A task must have a real positive assignment window.
      if (totalMs <= 0) continue;

      // Percentage of the original task time still remaining.
      const remainingPercent = (remainingMs / totalMs) * 100;

      task.remindersSent = Array.isArray(task.remindersSent)
        ? task.remindersSent
        : [];

      const employee = employees.find(
        e => Number(e.id) === Number(task.assigneeId)
      );
      if (!employee) continue;

      const recipient = employee.phone;
      if (!recipient) continue;

      for (const milestone of MILESTONES) {
        // Once the remaining time reaches this milestone, send it once.
        if (remainingPercent > milestone.percent) continue;
        if (task.remindersSent.includes(milestone.key)) continue;

        const link = taskLink(req, task);
        const deadline = formatDeadline(task.deadline);
        const remaining = formatRemaining(remainingMs);
        const remainingPercentText = Math.max(0, remainingPercent).toFixed(1);

        try {
          const whatsappResult = await sendWhatsAppTemplate(
            recipient,
            REMINDER_TEMPLATE,
            REMINDER_LANGUAGE,
            [
              { name: 'employee_name', value: task.assignee },
              { name: 'task_description', value: task.desc },
              { name: 'time_remaining', value: remaining },
              { name: 'remaining_percent', value: remainingPercentText },
              { name: 'deadline', value: deadline },
              { name: 'task_id', value: task.id },
              { name: 'task_url', value: link }
            ],
            { requestId: `reminder-${task.id}-${milestone.key}` }
          );

          task.remindersSent.push(milestone.key);
          task.reminderStatus = 'accepted';
          task.reminderStatusAt = new Date().toISOString();
          task.reminderMilestone = milestone.key;
          task.reminderMessageId =
            whatsappResult?.messages?.[0]?.id || null;
          task.reminderError = null;
          task.reminderErrorCode = null;
          task.reminderErrorType = null;
          task.reminderErrorData = null;

          changed = true;
          sent++;

          // Avoid sending multiple milestone messages for the same task
          // during one cron run if several thresholds were crossed.
          break;
        } catch (error) {
          task.reminderStatus = 'failed';
          task.reminderStatusAt = new Date().toISOString();
          task.reminderMilestone = milestone.key;
          task.reminderMessageId = null;
          task.reminderError = error.message || 'WhatsApp reminder failed.';
          task.reminderErrorCode = error.code || null;
          task.reminderErrorType = error.type || null;
          task.reminderErrorData = error.errorData || null;
          changed = true;

          console.error(
            `Reminder ${milestone.key} failed for task ${task.id}:`,
            JSON.stringify({
              message: error.message || null,
              code: error.code || null,
              type: error.type || null,
              errorData: error.errorData || null,
              fbtraceId: error.fbtraceId || null
            })
          );
          break;
        }
      }
    }

    if (changed) {
      await putJsonFile(
        'data/assigned-tasks.json',
        { version: 1, tasks },
        taskFile.sha,
        'Send percentage-based WhatsApp task reminders'
      );
    }

    return res.status(200).json({
      ok: true,
      sent,
      checkedAt: new Date(now).toISOString()
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || 'Reminder job failed.'
    });
  }
};
