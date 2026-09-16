// WhatsApp configuration — kept in sync with the values currently used by script.js.
const PHONE_NUMBER_ID = '1288119947723289';
const GRAPH_VERSION = 'v26.0';
const WHATSAPP_ACCESS_TOKEN = 'EAAXLCtl2jx0BSZAqcKPYpGXc9ydqZAy5GQncPSAor9QjF40RoZAVYNxNtuGhXGGcECXD2P5NPa8KYHtSCh4lk2XFfquMZB3I3oB0EgbEFZCZBqX23UZCxaypxAOE0x18PFHF7k75fCNwQhvsB6rSZCTMXdx1IRb8dM0t6rmXTjHTyYz63UUZAIrYiSaB5I8HfnAZDZD';

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