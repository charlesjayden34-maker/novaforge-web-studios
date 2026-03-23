function asBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function parseTrustProxy(value, isProduction) {
  const raw = String(value || '').trim();
  if (!raw) return isProduction ? 1 : false;
  if (raw === 'true') return 1;
  if (raw === 'false') return false;
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) return asNumber;
  return isProduction ? 1 : false;
}

function validateEnv() {
  const missing = [];

  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (!process.env.CORS_ORIGIN) missing.push('CORS_ORIGIN');
    if (!process.env.FRONTEND_URL) missing.push('FRONTEND_URL');
  }

  if (String(process.env.JWT_SECRET || '').length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const paypalMode = String(process.env.PAYPAL_ENV || '').toLowerCase();
  const hasAnyPaypal =
    !!process.env.PAYPAL_CLIENT_ID || !!process.env.PAYPAL_CLIENT_SECRET || !!process.env.PAYPAL_WEBHOOK_ID;
  if ((paypalMode === 'live' || hasAnyPaypal) && isProduction) {
    if (!process.env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
    if (!process.env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
    if (!process.env.PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  }

  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  if (hasStripeSecret && !process.env.STRIPE_WEBHOOK_SECRET && isProduction) {
    missing.push('STRIPE_WEBHOOK_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    isProduction,
    allowDevResetTokenResponse: asBool(process.env.ALLOW_DEV_RESET_TOKEN_RESPONSE),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY, isProduction)
  };
}

module.exports = { validateEnv };
