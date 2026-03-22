const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Request } = require('../models/Request');
const { getStripe } = require('../services/stripe');

const router = express.Router();

router.use(requireAuth);

function amountFor({ budgetRange, type }) {
  // Simple heuristic: map budget range to a USD estimate.
  const estimates = {
    '1500-3000': 2500,
    '3000-6000': 4500,
    '6000-10000': 8000,
    '10000+': 12000
  };
  const est = estimates[budgetRange] || 3000;
  const deposit = Math.max(500, Math.round(est * 0.3));
  const full = est;
  return type === 'deposit' ? deposit : full;
}

router.post('/create-intent', async (req, res, next) => {
  try {
    const { requestId, type } = req.body || {};
    if (!requestId || !type) return res.status(400).json({ error: 'Missing fields' });
    if (!['deposit', 'full'].includes(String(type)))
      return res.status(400).json({ error: 'Invalid type' });

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const isOwner =
      (request.userId && request.userId.toString() === req.user._id.toString()) ||
      request.email === req.user.email ||
      req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const stripe = getStripe();
    const amountUsd = amountFor({ budgetRange: request.budgetRange, type: String(type) });

    const intent = await stripe.paymentIntents.create({
      amount: amountUsd * 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        requestId: request._id.toString(),
        type: String(type),
        userId: request.userId ? request.userId.toString() : ''
      }
    });

    request.payments.push({
      type: String(type),
      amount: amountUsd,
      currency: 'usd',
      stripePaymentIntentId: intent.id,
      status: intent.status
    });
    await request.save();

    res.json({ clientSecret: intent.client_secret });
  } catch (e) {
    next(e);
  }
});

module.exports = { paymentsRouter: router };

