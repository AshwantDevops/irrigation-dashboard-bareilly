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

    apiError.code = result?.error?.code || null;
    apiError.type = result?.error?.type || null;
    apiError.fbtraceId = result?.error?.fbtrace_id || null;
    apiError.errorData = result?.error?.error_data || null;

    throw apiError;
  }

  return result;
}

// Sends a WhatsApp template with named body variables.
// Each parameter should be { name: 'template_variable', value: '...' }.
async function sendWhatsAppTemplate(to, templateName, languageCode, parameters = [], debugContext = {}) {
  const token = WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured.');
  }

  const recipient = cleanPhone(to);
  if (recipient.length < 10) {
    throw new Error('Invalid WhatsApp recipient number.');
  }

  const requestId = debugContext.requestId || 'no-request-id';
  const recipientLast4 = recipient.slice(-4);

  console.info('[WhatsApp][Template][START]', JSON.stringify({
    requestId,
    templateName,
    languageCode,
    recipientLast4,
    parameterNames: parameters.map(parameter => parameter?.name).filter(Boolean)
  }));

  const bodyParameters = parameters.map(parameter => {
    if (!parameter || !parameter.name) {
      throw new Error('WhatsApp template parameters must include variable names.');
    }

    return {
      type: 'text',
      parameter_name: parameter.name,
      text: String(parameter.value ?? '')
    };
  });

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
              parameters: bodyParameters
            }
          ]
        }
      })
    }
  );

  const result = await response.json();

  console.info('[WhatsApp][Template][META_RESPONSE]', JSON.stringify({
    requestId,
    templateName,
    languageCode,
    recipientLast4,
    httpStatus: response.status,
    ok: response.ok,
    messageId: result?.messages?.[0]?.id || null,
    metaErrorCode: result?.error?.code || null,
    metaErrorType: result?.error?.type || null,
    metaErrorMessage: result?.error?.message || null,
    metaErrorData: result?.error?.error_data || null,
    fbtraceId: result?.error?.fbtrace_id || null
  }));

  if (!response.ok) {
    console.error('WhatsApp template API error:', JSON.stringify(result));

    const apiError = new Error(
      result?.error?.message || 'WhatsApp template request failed.'
    );

    apiError.code = result?.error?.code || null;
    apiError.type = result?.error?.type || null;
    apiError.fbtraceId = result?.error?.fbtrace_id || null;
    apiError.errorData = result?.error?.error_data || null;

    throw apiError;
  }

  console.info('[WhatsApp][Template][SUCCESS]', JSON.stringify({
    requestId,
    templateName,
    languageCode,
    recipientLast4,
    messageId: result?.messages?.[0]?.id || null
  }));

  return result;
}

module.exports = {
  sendWhatsAppText,
  sendWhatsAppTemplate,
  cleanPhone
};
