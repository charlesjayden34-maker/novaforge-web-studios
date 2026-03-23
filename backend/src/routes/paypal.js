const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Request } = require('../models/Request');
const { callPaypal, getPaypalConfig } = require('../services/paypal');
const { isValidObjectId } = require('../utils/validation');
const { requestCreateLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const ORDER_ID_PATTERN = /^[A-Z0-9-]{10,64}$/i;

function asUsdAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Number(amount.toFixed(2));
}

function matchesExpectedUsd(request, amount, currencyCode) {
  const expected = asUsdAmount(request.websitePrice);
  return (
    expected !== null &&
    amount !== null &&
    String(currencyCode || '').toUpperCase() === 'USD' &&
    Math.abs(expected - amount) < 0.01
  );
}

router.post('/create-order', requireAuth, requestCreateLimiter, async (req, res, next) => {
  try {
    const { requestId } = req.body || {};
    if (!isValidObjectId(requestId)) return res.status(400).json({ error: 'Invalid request id' });

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (String(request.preferredPaymentMethod) !== 'paypal') {
      return res.status(400).json({ error: 'This request is not set to PayPal payment' });
    }
    if (String(request.paymentStatus) === 'paid') {
      return res.status(400).json({ error: 'Request has already been paid' });
    }
    if (String(request.paymentStatus) === 'cancelled' || String(request.status) === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled requests cannot be paid' });
    }

    const isOwner =
      (request.userId && request.userId.toString() === req.user._id.toString()) ||
      request.email === req.user.email ||
      req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const amount = Number(request.websitePrice || 0).toFixed(2);
    const frontend = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (!frontend) return res.status(500).json({ error: 'FRONTEND_URL is not configured' });

    const order = await callPaypal({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: request._id.toString(),
            amount: { currency_code: 'USD', value: amount }
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${frontend}/dashboard?paypal=success`,
              cancel_url: `${frontend}/dashboard?paypal=cancelled`,
              user_action: 'PAY_NOW'
            }
          }
        }
      }
    });

    const approveUrl = (order.links || []).find(
      (link) => link.rel === 'approve' || link.rel === 'payer-action'
    )?.href;
    if (!approveUrl) return res.status(500).json({ error: 'PayPal approval URL missing' });
    return res.json({ orderId: order.id, approveUrl });
  } catch (e) {
    next(e);
  }
});

router.post('/capture-order', requireAuth, requestCreateLimiter, async (req, res, next) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId || !ORDER_ID_PATTERN.test(String(orderId))) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const capture = await callPaypal({
      method: 'POST',
      path: `/v2/checkout/orders/${orderId}/capture`
    });

    const purchaseUnit = capture?.purchase_units?.[0];
    const capturedPayment = purchaseUnit?.payments?.captures?.[0];
    const customId = capturedPayment?.custom_id || purchaseUnit?.custom_id;
    if (!isValidObjectId(customId)) {
      return res.status(400).json({ error: 'Invalid request mapping from PayPal order' });
    }

    const request = await Request.findById(customId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const isOwner =
      (request.userId && request.userId.toString() === req.user._id.toString()) ||
      request.email === req.user.email ||
      req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const capturedAmount = asUsdAmount(capturedPayment?.amount?.value || purchaseUnit?.amount?.value);
    const capturedCurrency =
      capturedPayment?.amount?.currency_code || purchaseUnit?.amount?.currency_code || 'USD';
    if (!matchesExpectedUsd(request, capturedAmount, capturedCurrency)) {
      return res.status(400).json({ error: 'Captured amount does not match request price' });
    }

    const captureId = capturedPayment?.id || orderId;
    const status = capturedPayment?.status || capture?.status || 'COMPLETED';

    const existing = request.payments.find(
      (payment) =>
        payment.provider === 'paypal' && payment.providerPaymentId === String(captureId)
    );
    if (!existing) {
      request.payments.push({
        type: 'full',
        amount: capturedAmount || Number(request.websitePrice || 0),
        currency: 'usd',
        provider: 'paypal',
        providerPaymentId: String(captureId),
        status: String(status).toLowerCase()
      });
    }
    if (String(status).toLowerCase() === 'completed') {
      request.paymentStatus = 'paid';
    }
    await request.save();

    return res.json({ ok: true, request });
  } catch (e) {
    next(e);
  }
});

async function paypalWebhookHandler(req, res) {
  try {
    const { webhookId } = getPaypalConfig();
    if (!webhookId) return res.status(500).json({ error: 'PAYPAL_WEBHOOK_ID is required' });

    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return res.status(400).json({ error: 'Missing PayPal signature headers' });
    }

    const verification = await callPaypal({
      method: 'POST',
      path: '/v1/notifications/verify-webhook-signature',
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: req.body
      }
    });

    if (verification?.verification_status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body || {};
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const customId = event?.resource?.custom_id || event?.resource?.purchase_units?.[0]?.custom_id;
      const captureId = event?.resource?.id || event?.resource?.supplementary_data?.related_ids?.capture_id;
      if (isValidObjectId(customId) && captureId) {
        const request = await Request.findById(customId);
        if (request) {
          const capturedAmount = asUsdAmount(event?.resource?.amount?.value);
          const capturedCurrency = event?.resource?.amount?.currency_code || 'USD';
          if (!matchesExpectedUsd(request, capturedAmount, capturedCurrency)) {
            return res.json({ received: true });
          }

          const existing = request.payments.find(
            (payment) => payment.provider === 'paypal' && payment.providerPaymentId === String(captureId)
          );
          if (!existing) {
            request.payments.push({
              type: 'full',
              amount: capturedAmount || Number(request.websitePrice || 0),
              currency: 'usd',
              provider: 'paypal',
              providerPaymentId: String(captureId),
              status: 'completed'
            });
          }
          request.paymentStatus = 'paid';
          await request.save();
        }
      }
    }

    return res.json({ received: true });
  } catch (_e) {
    return res.status(400).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { paypalRouter: router, paypalWebhookHandler };
