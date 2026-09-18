// WhatsApp configuration — kept in sync with the values currently used by script.js.
const PHONE_NUMBER_ID = '1615049835013810';
const GRAPH_VERSION = 'v26.0';
const WHATSAPP_ACCESS_TOKEN = 'EAAXLCtl2jx0BSgJUWANj6MUzHIllcmCYahs3qMQkTZBV6sYPpzXwlLcES0FqamyDlnRC5oeaasuWLuK0jAePGbMldjO3WoMWtNHjP9YwQjpvBIpBRPVUmHvojF8HhZC8avMlIFuqZAZBFLhZC9AkH1U3LTcAC6qcsDaQFQkjXx0dV2XglOIc33PU2odrZBgAZDZD';

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
    throw new Error(result?.error?.message || 'WhatsApp API request failed.');
  }

  return result;
}

module.exports = { sendWhatsAppText, cleanPhone };
