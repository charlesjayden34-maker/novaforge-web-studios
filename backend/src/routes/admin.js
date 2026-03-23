const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { Request } = require('../models/Request');
const { User } = require('../models/User');
const { adminMutationLimiter } = require('../middleware/rateLimit');
const { isSafeHttpUrl, isValidObjectId } = require('../utils/validation');
const { normalizeUserProfile, professionalDisplayName } = require('../utils/profile');

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/requests', async (_req, res, next) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 }).lean();
    res.json({
      requests: requests.map((request) => ({
        ...request,
        name: professionalDisplayName(request.name, request.email)
      }))
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/requests/:id', adminMutationLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid request id' });
    const { status, paymentStatus, deliveryUrl } = req.body || {};

    const patch = {};
    if (status !== undefined) {
      if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(String(status)))
        return res.status(400).json({ error: 'Invalid status' });
      patch.status = String(status);
    }
    if (paymentStatus !== undefined) {
      if (!['unpaid', 'paid', 'cancelled'].includes(String(paymentStatus)))
        return res.status(400).json({ error: 'Invalid payment status' });
      patch.paymentStatus = String(paymentStatus);
    }
    if (deliveryUrl !== undefined) {
      const value = String(deliveryUrl || '').trim();
      if (value && !isSafeHttpUrl(value)) {
        return res.status(400).json({ error: 'Delivery URL must be a valid http(s) URL' });
      }
      patch.deliveryUrl = value;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Enforce pay-first delivery policy.
    const current = await Request.findById(id).lean();
    if (!current) return res.status(404).json({ error: 'Not found' });
    const nextStatus = patch.status || current.status;
    const nextPayment = patch.paymentStatus || current.paymentStatus || 'unpaid';
    if (nextStatus === 'completed' && nextPayment !== 'paid') {
      return res
        .status(400)
        .json({ error: 'Cannot mark completed until payment status is paid' });
    }
    if (nextStatus === 'cancelled' && !patch.paymentStatus) {
      patch.paymentStatus = 'cancelled';
    }

    const request = await Request.findByIdAndUpdate(id, patch, { new: true }).lean();
    res.json({
      request: request
        ? { ...request, name: professionalDisplayName(request.name, request.email) }
        : request
    });
  } catch (e) {
    next(e);
  }
});

router.post('/requests/:id/cancel', adminMutationLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid request id' });
    const request = await Request.findByIdAndUpdate(
      id,
      { status: 'cancelled', paymentStatus: 'cancelled' },
      { new: true }
    ).lean();
    if (!request) return res.status(404).json({ error: 'Not found' });
    return res.json({
      request: { ...request, name: professionalDisplayName(request.name, request.email) }
    });
  } catch (e) {
    next(e);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().select('_id name email role createdAt').sort({ createdAt: -1 }).lean();
    res.json({ users: users.map(normalizeUserProfile) });
  } catch (e) {
    next(e);
  }
});

router.patch('/users/:id', adminMutationLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid user id' });
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'Missing role' });
    if (!['user', 'admin'].includes(String(role)))
      return res.status(400).json({ error: 'Invalid role' });

    const user = await User.findByIdAndUpdate(id, { role: String(role) }, { new: true })
      .select('_id name email role createdAt')
      .lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user: normalizeUserProfile(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = { adminRouter: router };

