const { getStripe } = require('../services/stripe');
const { Request } = require('../models/Request');
const { isValidObjectId } = require('../utils/validation');

async function stripeWebhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('STRIPE_WEBHOOK_SECRET missing');

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (_err) {
    return res.status(400).send('Invalid signature');
  }

  const relevantTypes = new Set([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'payment_intent.processing',
    'payment_intent.requires_payment_method'
  ]);

  if (relevantTypes.has(event.type)) {
    const pi = event.data.object;
    const requestId = pi?.metadata?.requestId;
    if (requestId && isValidObjectId(requestId)) {
      const normalizedStatus = String(pi.status || '').toLowerCase();
      const isPaid = normalizedStatus === 'succeeded';
      const paymentStatus = isPaid ? 'paid' : normalizedStatus === 'canceled' ? 'cancelled' : 'unpaid';

      await Request.updateOne(
        { _id: requestId, 'payments.providerPaymentId': pi.id, 'payments.provider': 'stripe' },
        {
          $set: {
            'payments.$.status': normalizedStatus,
            paymentStatus
          }
        }
      );
    }
  }

  res.json({ received: true });
}

module.exports = { stripeWebhookHandler };

