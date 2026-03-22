require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { connectDb } = require('./services/db');
const { authRouter } = require('./routes/auth');
const { requestsRouter } = require('./routes/requests');
const { adminRouter } = require('./routes/admin');
const { paymentsRouter } = require('./routes/payments');
const { stripeWebhookHandler } = require('./routes/stripeWebhook');

const app = express();

function getCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return true;
  const origins = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

app.use(cors({ origin: getCorsOrigin(), credentials: true }));
app.use(morgan('dev'));

// Stripe webhook must use raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
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

