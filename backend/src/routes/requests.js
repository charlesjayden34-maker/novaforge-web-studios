const express = require('express');
const { Request } = require('../models/Request');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sendAdminNotification } = require('../services/email');

const router = express.Router();

// Public: create a request (links userId when Authorization Bearer is sent)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { name, email, projectType, budgetRange, preferredPaymentMethod, description } = req.body || {};
    if (!name || !email || !projectType || !budgetRange || !preferredPaymentMethod || !description)
      return res.status(400).json({ error: 'Missing fields' });

    const validPaymentMethods = ['card', 'bank_transfer', 'paypal', 'crypto', 'other'];
    if (!validPaymentMethods.includes(String(preferredPaymentMethod))) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const userId =
      req.user &&
      (normalizedEmail === req.user.email || req.user.role === 'admin')
        ? req.user._id
        : null;

    const request = await Request.create({
      userId,
      name: String(name).trim(),
      email: normalizedEmail,
      projectType: String(projectType),
      budgetRange: String(budgetRange),
      preferredPaymentMethod: String(preferredPaymentMethod),
      description: String(description).trim()
    });

    // fire-and-forget email
    sendAdminNotification({ request }).catch(() => {});

    res.status(201).json({ request });
  } catch (e) {
    next(e);
  }
});

router.post('/claim', requireAuth, async (req, res, next) => {
  try {
    await Request.updateMany(
      { email: req.user.email, userId: null },
      { $set: { userId: req.user._id } }
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const requests = await Request.find({
      $or: [{ userId: req.user._id }, { email: req.user.email }]
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests });
  } catch (e) {
    next(e);
  }
});

module.exports = { requestsRouter: router };

