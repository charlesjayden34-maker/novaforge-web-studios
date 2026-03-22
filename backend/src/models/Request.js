const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['deposit', 'full'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    stripePaymentIntentId: { type: String, required: true },
    status: { type: String, default: 'requires_payment_method' }
  },
  { timestamps: true }
);

const RequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    projectType: { type: String, required: true },
    budgetRange: { type: String, required: true },
    preferredPaymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'paypal', 'crypto', 'other'],
      default: 'card'
    },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    deliveryUrl: { type: String, default: '' },
    payments: { type: [PaymentSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = { Request: mongoose.model('Request', RequestSchema) };

