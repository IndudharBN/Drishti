import type { Handler } from '@netlify/functions';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.WHATSAPP_TO;

  if (!accountSid || !authToken || !from || !to) {
    return {
      statusCode: 501,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'WhatsApp credentials are not configured on the server.' })
    };
  }

  const payload = JSON.parse(event.body || '{}') as { message?: string };
  const message = String(payload.message || '').slice(0, 1200);
  if (!message) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Message is required.' }) };
  }

  const body = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    Body: message
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const text = await response.text();
  return {
    statusCode: response.ok ? 200 : response.status,
    headers: jsonHeaders,
    body: text
  };
};
