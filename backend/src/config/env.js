function asBool(value) {
  return String(value || '').toLowerCase() === 'true';
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

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    isProduction,
    allowDevResetTokenResponse: asBool(process.env.ALLOW_DEV_RESET_TOKEN_RESPONSE)
  };
}

module.exports = { validateEnv };
