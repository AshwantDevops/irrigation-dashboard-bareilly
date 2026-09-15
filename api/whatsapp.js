const { authenticate, sendAuthError } = require('./_auth');
const { sendWhatsAppText } = require('./_whatsapp');

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

    const link = body.taskId && body.publicToken
      ? `https://${req.headers.host}/task.html?id=${encodeURIComponent(body.taskId)}&token=${encodeURIComponent(body.publicToken)}`
      : '';

    const message =
      `📢 Irrigation Division Bareilly\\n\\n` +
      `New Task Assigned:\\n` +
      `📋 Task: ${body.taskTitle}\\n` +
      `📅 Deadline: ${body.deadline}\\n\\n` +
      (link ? `Open task: ${link}\\n\\n` : '') +
      `Reply DONE ${body.taskId || ''} on WhatsApp when completed.`;

    const result = await sendWhatsAppText(body.recipient, message);
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error(error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({ message: error.message || 'WhatsApp API failed.' });
  }
};