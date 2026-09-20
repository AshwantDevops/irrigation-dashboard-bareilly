const { authenticate, sendAuthError } = require('./_auth');

const PHONE_NUMBER_ID = '1615049835013810';
const GRAPH_VERSION = 'v26.0';
const TEMPLATE_NAME = 'task_assignment';

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed.' });
    }

    const auth = await authenticate(req);
    if (!auth.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
    if (!token) {
      return res.status(500).json({ message: 'WHATSAPP_ACCESS_TOKEN is not configured.' });
    }

    const headers = { Authorization: `Bearer ${token}` };

    const phoneResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,whatsapp_business_account`,
      { headers }
    );
    const phoneData = await phoneResponse.json();

    if (!phoneResponse.ok) {
      return res.status(502).json({
        message: 'Meta phone-number lookup failed.',
        metaErrorCode: phoneData?.error?.code || null,
        metaErrorMessage: phoneData?.error?.message || null
      });
    }

    const wabaId = phoneData?.whatsapp_business_account?.id || null;
    if (!wabaId) {
      return res.status(502).json({
        message: 'Meta did not return a WhatsApp Business Account ID.',
        phoneNumberId: PHONE_NUMBER_ID,
        displayPhoneNumber: phoneData?.display_phone_number || null
      });
    }

    const templateUrl =
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?name=${encodeURIComponent(TEMPLATE_NAME)}&limit=100`;

    const templateResponse = await fetch(templateUrl, { headers });
    const templateData = await templateResponse.json();

    if (!templateResponse.ok) {
      return res.status(502).json({
        message: 'Meta template lookup failed.',
        wabaId,
        metaErrorCode: templateData?.error?.code || null,
        metaErrorMessage: templateData?.error?.message || null
      });
    }

    const templates = Array.isArray(templateData?.data) ? templateData.data : [];
    const matches = templates
      .filter(template => template?.name === TEMPLATE_NAME)
      .map(template => ({
        id: template.id || null,
        name: template.name || null,
        language: template.language || null,
        status: template.status || null,
        category: template.category || null
      }));

    return res.status(200).json({
      phoneNumberId: PHONE_NUMBER_ID,
      displayPhoneNumber: phoneData?.display_phone_number || null,
      verifiedName: phoneData?.verified_name || null,
      wabaId,
      templateName: TEMPLATE_NAME,
      templates: matches
    });
  } catch (error) {
    console.error('WhatsApp template diagnostic failed:', error);
    if (error.statusCode) return sendAuthError(res, error);
    return res.status(500).json({ message: error.message || 'Diagnostic failed.' });
  }
};
