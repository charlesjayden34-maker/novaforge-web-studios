const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Request } = require('../models/Request');
const { getStripe } = require('../services/stripe');
const { isValidObjectId } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

router.post('/create-intent', async (req, res, next) => {
  try {
    const { requestId, type } = req.body || {};
    if (!requestId || !type) return res.status(400).json({ error: 'Missing fields' });
    if (!isValidObjectId(requestId)) return res.status(400).json({ error: 'Invalid request id' });
    if (String(type) !== 'full') return res.status(400).json({ error: 'Only full payment is supported' });

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const isOwner =
      (request.userId && request.userId.toString() === req.user._id.toString()) ||
      request.email === req.user.email ||
      req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const stripe = getStripe();
    const amountUsd = Number(request.websitePrice || 0);
    if (amountUsd <= 0) return res.status(400).json({ error: 'Invalid website price' });

    const intent = await stripe.paymentIntents.create({
      amount: amountUsd * 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        requestId: request._id.toString(),
        type: 'full',
        userId: request.userId ? request.userId.toString() : ''
      }
    });

    request.payments.push({
      type: 'full',
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

