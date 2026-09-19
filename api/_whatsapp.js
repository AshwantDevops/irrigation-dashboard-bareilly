// WhatsApp configuration — kept in sync with the values currently used by script.js.
const PHONE_NUMBER_ID = '1615049835013810';
const GRAPH_VERSION = 'v26.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

function cleanPhone(phone) {
  let value = String(phone || '').replace(/\D/g, '');
  if (value.length === 10) value = '91' + value;
  return value;
}

async function sendWhatsAppText(to, body) {
  const token = WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured.');
  }

  const recipient = cleanPhone(to);
  if (recipient.length < 10) {
    throw new Error('Invalid WhatsApp recipient number.');
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('WhatsApp Graph API error:', JSON.stringify(result));

    const apiError = new Error(
      result?.error?.message || 'WhatsApp API request failed.'
    );

    // Preserve Meta's diagnostic details without exposing the access token.
    apiError.code = result?.error?.code || null;
    apiError.type = result?.error?.type || null;
    apiError.fbtraceId = result?.error?.fbtrace_id || null;
    apiError.errorData = result?.error?.error_data || null;

    throw apiError;
  }

  return result;
}

async function sendWhatsAppTemplate(to, templateName, languageCode, parameters = []) {
  const token = WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured.');
  }

  const recipient = cleanPhone(to);
  if (recipient.length < 10) {
    throw new Error('Invalid WhatsApp recipient number.');
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: [
            {
              type: 'body',
              parameters: parameters.map(value => ({
                type: 'text',
                text: String(value ?? '')
              }))
            }
          ]
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('WhatsApp template API error:', JSON.stringify(result));

    const apiError = new Error(
      result?.error?.message || 'WhatsApp template request failed.'
    );

    // Preserve Meta's diagnostic details without exposing the access token.
    apiError.code = result?.error?.code || null;
    apiError.type = result?.error?.type || null;
    apiError.fbtraceId = result?.error?.fbtrace_id || null;
    apiError.errorData = result?.error?.error_data || null;

    throw apiError;
  }

  return result;
}

module.exports = {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  cleanPhone
};
