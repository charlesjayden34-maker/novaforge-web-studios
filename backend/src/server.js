require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const { connectDb } = require('./services/db');
const { authRouter } = require('./routes/auth');
const { requestsRouter } = require('./routes/requests');
const { adminRouter } = require('./routes/admin');
const { paymentsRouter } = require('./routes/payments');
const { stripeWebhookHandler } = require('./routes/stripeWebhook');
const { paypalRouter, paypalWebhookHandler } = require('./routes/paypal');
const { validateEnv } = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimit');

const env = validateEnv();

const app = express();
app.set('trust proxy', env.trustProxy);

function getCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return env.isProduction ? [] : true;
  const origins = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (origins.length === 0) return env.isProduction ? [] : true;
  return origins;
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// Stripe webhook must use raw body
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json', limit: '100kb' }),
  stripeWebhookHandler
);
app.post('/api/paypal/webhook', express.json({ limit: '200kb' }), paypalWebhookHandler);

app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/paypal', paypalRouter);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const statusCode = Number(err?.statusCode || 500);
  if (statusCode >= 500) {
    return res.status(500).json({ error: 'Server error' });
  }
  return res.status(statusCode).json({ error: err?.message || 'Request failed' });
});

const port = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`NovaForge API listening on :${port}`);
    });
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', e);
    process.exit(1);
  });

