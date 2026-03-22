const express = require('express');
const { Request } = require('../models/Request');
const { requireAuth } = require('../middleware/auth');
const { sendAdminNotification } = require('../services/email');
const { requestCreateLimiter } = require('../middleware/rateLimit');
const { isSafeHttpUrl } = require('../utils/validation');

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
    if (
      !name ||
      !projectType ||
      !websiteTier ||
      !preferredPaymentMethod ||
      !paymentSubmission ||
      !description
    )
      return res.status(400).json({ error: 'Missing fields' });

    if (String(preferredPaymentMethod) !== 'bank_transfer') {
      return res.status(400).json({ error: 'Only bank transfer is currently supported' });
    }

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

    const normalizedTier = String(websiteTier).toLowerCase().trim();
    const websitePrice = tierPricing[normalizedTier];
    if (!websitePrice) return res.status(400).json({ error: 'Invalid website tier' });
    if (!isSafeHttpUrl(paymentProofUrl)) {
      return res.status(400).json({ error: 'Payment proof URL must be a valid http(s) URL' });
    }

    const normalizedEmail = String(req.user.email).toLowerCase().trim();
    const detectedBankName = detectBankName(payerBankIdentifier);

    const request = await Request.create({
      userId: req.user._id,
      name: String(name).trim(),
      email: normalizedEmail,
      projectType: String(projectType),
      websiteTier: normalizedTier,
      websitePrice,
      preferredPaymentMethod: String(preferredPaymentMethod),
      paymentSubmission: {
        payerFullName: String(payerFullName).trim(),
        payerBankIdentifier: String(payerBankIdentifier).trim(),
        payerBankName: detectedBankName,
        transferReference: String(transferReference).trim(),
        transferDate: String(transferDate).trim(),
        paymentProofUrl: String(paymentProofUrl).trim()
      },
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

