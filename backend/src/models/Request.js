const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['full'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    provider: { type: String, enum: ['stripe', 'paypal'], required: true, default: 'stripe' },
    providerPaymentId: { type: String, required: true },
    status: { type: String, default: 'created' }
  },
  { timestamps: true }
);

const PaymentSubmissionSchema = new mongoose.Schema(
  {
    payerFullName: { type: String, required: true, trim: true },
    payerBankIdentifier: { type: String, required: true, trim: true },
    payerBankName: { type: String, required: true, trim: true },
    transferReference: { type: String, required: true, trim: true },
    transferDate: { type: String, required: true, trim: true },
    paymentProofUrl: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const RequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    projectType: { type: String, required: true },
    websiteTier: { type: String, enum: ['starter', 'growth', 'premium'], required: true },
    websitePrice: { type: Number, required: true, min: 0 },
    preferredPaymentMethod: {
      type: String,
      enum: ['bank_transfer', 'paypal'],
      default: 'bank_transfer'
    },
    paymentSubmission: {
      type: PaymentSubmissionSchema,
      required: function paymentSubmissionRequired() {
        return this.preferredPaymentMethod === 'bank_transfer';
      }
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'cancelled'], default: 'unpaid' },
    deliveryUrl: { type: String, default: '' },
    payments: { type: [PaymentSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = { Request: mongoose.model('Request', RequestSchema) };

