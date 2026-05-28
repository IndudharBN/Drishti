import type { Handler } from '@netlify/functions';

const endpointForEnv = () => process.env.TRADING212_ENV === 'live'
  ? 'https://live.trading212.com/api/v0'
  : 'https://demo.trading212.com/api/v0';

const authHeader = () => {
  const key = process.env.TRADING212_API_KEY;
  const secret = process.env.TRADING212_API_SECRET;
  if (!key || !secret) return null;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
};

export const handler: Handler = async () => {
  const auth = authHeader();
  if (!auth) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: false,
        message: 'Trading 212 connector is ready, but API key and secret must be configured server-side in Netlify.'
      })
    };
  }

  const response = await fetch(`${endpointForEnv()}/equity/account/cash`, {
    headers: { Authorization: auth }
  });
  const payload = await response.json();
  return {
    statusCode: response.ok ? 200 : response.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connected: response.ok, payload })
  };
};
