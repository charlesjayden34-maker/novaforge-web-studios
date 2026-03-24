const express = require('express');
const { Request } = require('../models/Request');
const { requireAuth } = require('../middleware/auth');
const { sendAdminNotification } = require('../services/email');
const { requestCreateLimiter, requestClaimLimiter } = require('../middleware/rateLimit');
const { isSafeHttpUrl } = require('../utils/validation');
const { professionalDisplayName } = require('../utils/profile');

const router = express.Router();

const tierPricing = {
  starter: 1200,
  growth: 2500,
  premium: 5000
};

function detectBankName(identifier) {
  const value = String(identifier || '').replace(/\s+/g, '').toUpperCase();
  if (value.includes('FCIB') || value.startsWith('096')) return 'FCIB';
  if (value.includes('RBGL') || value.includes('RBC')) return 'RBC Royal Bank';
  if (value.includes('SCBL') || value.includes('SCOTIA')) return 'Scotiabank';
  if (value.includes('FIRN') || value.includes('FIRSTC')) return 'First Citizens';
  if (value.includes('NCBJ') || value.includes('NCB')) return 'National Commercial Bank';
  if (value.includes('CITI')) return 'Citibank';
  if (value.includes('CHASE') || value.includes('CHASUS')) return 'JPMorgan Chase';
  if (value.includes('BOFA') || value.includes('BOFAUS')) return 'Bank of America';
  return 'Unknown Bank';
}

// Authenticated users only: create a request linked to account
router.post('/', requireAuth, requestCreateLimiter, async (req, res, next) => {
  try {
    const { name, projectType, websiteTier, preferredPaymentMethod, paymentSubmission, description } =
      req.body || {};
    if (!name || !projectType || !websiteTier || !preferredPaymentMethod || !description)
      return res.status(400).json({ error: 'Missing fields' });

    const paymentMethod = String(preferredPaymentMethod);
    if (!['bank_transfer', 'paypal'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    const normalizedTier = String(websiteTier).toLowerCase().trim();
    const websitePrice = tierPricing[normalizedTier];
    if (!websitePrice) return res.status(400).json({ error: 'Invalid website tier' });

    const normalizedName = String(name).trim();
    const normalizedProjectType = String(projectType).trim();
    const normalizedDescription = String(description).trim();
    if (!normalizedName || normalizedName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 1 and 80 characters' });
    }
    if (!normalizedProjectType || normalizedProjectType.length > 80) {
      return res.status(400).json({ error: 'Project type must be between 1 and 80 characters' });
    }
    if (normalizedDescription.length < 20 || normalizedDescription.length > 2000) {
      return res
        .status(400)
        .json({ error: 'Project description must be between 20 and 2000 characters' });
    }

    const normalizedEmail = String(req.user.email).toLowerCase().trim();
    let normalizedPaymentSubmission;

    if (paymentMethod === 'bank_transfer') {
      const { payerFullName, payerBankIdentifier, transferReference, transferDate, paymentProofUrl } =
        paymentSubmission || {};
      if (
        !payerFullName ||
        !payerBankIdentifier ||
        !transferReference ||
        !transferDate ||
        !paymentProofUrl
      ) {
        return res.status(400).json({ error: 'Missing payment submission details' });
      }
      if (!isSafeHttpUrl(paymentProofUrl)) {
        return res.status(400).json({ error: 'Payment proof URL must be a valid http(s) URL' });
      }

      normalizedPaymentSubmission = {
        payerFullName: String(payerFullName).trim(),
        payerBankIdentifier: String(payerBankIdentifier).trim(),
        payerBankName: detectBankName(payerBankIdentifier),
        transferReference: String(transferReference).trim(),
        transferDate: String(transferDate).trim(),
        paymentProofUrl: String(paymentProofUrl).trim()
      };
    }

    const request = await Request.create({
      userId: req.user._id,
      name: professionalDisplayName(normalizedName, normalizedEmail),
      email: normalizedEmail,
      projectType: normalizedProjectType,
      websiteTier: normalizedTier,
      websitePrice,
      preferredPaymentMethod: paymentMethod,
      paymentSubmission: normalizedPaymentSubmission,
      description: normalizedDescription
    });

    // fire-and-forget email
    sendAdminNotification({ request }).catch(() => {});

    res.status(201).json({ request });
  } catch (e) {
    next(e);
  }
});

router.post('/claim', requireAuth, requestClaimLimiter, async (req, res, next) => {
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

module.exports = { requestsRouter: router };

