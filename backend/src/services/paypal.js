const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_API = 'https://api-m.paypal.com';

function getPaypalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = String(process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  const apiBase = mode === 'live' ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required');
  }
  return { clientId, clientSecret, mode, apiBase, webhookId };
}

async function getAccessToken() {
  const { clientId, clientSecret, apiBase } = getPaypalConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || 'Failed to get PayPal access token');
  }
  return data.access_token;
}

async function callPaypal({ method, path, body }) {
  const { apiBase } = getPaypalConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || 'PayPal API request failed');
  }
  return data;
}

module.exports = { getPaypalConfig, callPaypal };
