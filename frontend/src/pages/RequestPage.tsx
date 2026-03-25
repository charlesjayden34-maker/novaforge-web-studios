import { FormEvent, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { siteConfig, websiteTiers } from '../config/site';

type FormState = {
  name: string;
  email: string;
  projectType: string;
  websiteTier: string;
  preferredPaymentMethod: string;
  payerFullName: string;
  payerBankIdentifier: string;
  transferReference: string;
  transferDate: string;
  paymentProofUrl: string;
  description: string;
};

const detectBankName = (identifier: string) => {
  const value = identifier.replace(/\s+/g, '').toUpperCase();
  if (!value) return '';
  if (value.includes('FCIB') || value.startsWith('096')) return 'FCIB';
  if (value.includes('RBGL') || value.includes('RBC')) return 'RBC Royal Bank';
  if (value.includes('SCBL') || value.includes('SCOTIA')) return 'Scotiabank';
  if (value.includes('FIRN') || value.includes('FIRSTC')) return 'First Citizens';
  if (value.includes('NCBJ') || value.includes('NCB')) return 'National Commercial Bank';
  if (value.includes('CITI')) return 'Citibank';
  if (value.includes('CHASE') || value.includes('CHASUS')) return 'JPMorgan Chase';
  if (value.includes('BOFA') || value.includes('BOFAUS')) return 'Bank of America';
  return 'Unknown Bank';
};

const initialState: FormState = {
  name: '',
  email: '',
  projectType: '',
  websiteTier: '',
  preferredPaymentMethod: 'bank_transfer',
  payerFullName: '',
  payerBankIdentifier: '',
  transferReference: '',
  transferDate: '',
  paymentProofUrl: '',
  description: ''
};
const tierPricing = Object.fromEntries(websiteTiers.map((tier) => [tier.id, tier.price])) as Record<
  string,
  number
>;

const allowedPaypalHosts = new Set([
  'www.paypal.com',
  'paypal.com',
  'www.sandbox.paypal.com',
  'sandbox.paypal.com'
]);

function isAllowedPaypalApproveUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && allowedPaypalHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const RequestPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      email: user.email,
      name: prev.name || user.name
    }));
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !form.name ||
      !form.email ||
      !form.projectType ||
      !form.websiteTier ||
      !form.preferredPaymentMethod ||
      !form.description
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (
      form.preferredPaymentMethod === 'bank_transfer' &&
      (!form.payerFullName ||
        !form.payerBankIdentifier ||
        !form.transferReference ||
        !form.transferDate ||
        !form.paymentProofUrl)
    ) {
      setError('Please fill in all required bank transfer fields.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<{ request?: { _id: string } }>('/api/requests', {
        name: form.name,
        projectType: form.projectType,
        websiteTier: form.websiteTier,
        preferredPaymentMethod: form.preferredPaymentMethod,
        paymentSubmission:
          form.preferredPaymentMethod === 'bank_transfer'
            ? {
                payerFullName: form.payerFullName,
                payerBankIdentifier: form.payerBankIdentifier,
                transferReference: form.transferReference,
                transferDate: form.transferDate,
                paymentProofUrl: form.paymentProofUrl
              }
            : undefined,
        description: form.description
      });

      if (form.preferredPaymentMethod === 'paypal') {
        const requestId = created.data?.request?._id;
        if (!requestId) {
          throw new Error('Missing request id');
        }

        const paypal = await api.post<{ approveUrl: string }>('/api/paypal/create-order', { requestId });
        if (!isAllowedPaypalApproveUrl(paypal.data?.approveUrl)) {
          throw new Error('Invalid PayPal redirect URL');
        }

        window.location.assign(paypal.data.approveUrl);
        return;
      }

      setSuccess('Request submitted. Please complete your bank transfer now using the details below.');
      if (user) {
        setForm({
          ...initialState,
          email: user.email,
          name: user.name
        });
      } else {
        setForm(initialState);
      }
    } catch {
      setError('Something went wrong while submitting your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Request a Website · Orvanta Studio</title>
        <meta
          name="description"
          content="Tell Orvanta about your project - scope, budget, and goals. We respond within one business day."
        />
      </Helmet>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Request a Website
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pick your package and payment method. We start once payment is verified.
          </p>
          <p className="text-xs rounded-lg border border-amber-300/50 bg-amber-100/70 px-3 py-2 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
            Full-payment policy: no partial payments. Delivery is unlocked only after payment is confirmed.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {websiteTiers.map((tier) => (
            <div
              key={tier.id}
              className={`nf-card rounded-xl p-4 ${
                form.websiteTier === tier.id ? 'ring-2 ring-brand-500/40' : ''
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                {tier.name}
              </p>
              <p className="mt-1 text-2xl font-semibold">${tier.price}</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{tier.summary}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="nf-card rounded-2xl p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="name">
                Name<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="nf-field"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="email">
                Email<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className="nf-field"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-800 dark:text-slate-200"
                htmlFor="projectType"
              >
                Project type<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <select
                id="projectType"
                name="projectType"
                required
                value={form.projectType}
                onChange={handleChange}
                className="nf-field"
              >
                <option value="">Select a project type</option>
                <option value="landing">Landing page</option>
                <option value="marketing">Marketing site</option>
                <option value="webapp">Web app / dashboard</option>
                <option value="ecommerce">E‑commerce</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-800 dark:text-slate-200"
                htmlFor="websiteTier"
              >
                Website package (fixed price)<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <select
                id="websiteTier"
                name="websiteTier"
                required
                value={form.websiteTier}
                onChange={handleChange}
                className="nf-field"
              >
                <option value="">Select a package</option>
                {websiteTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} - ${tier.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            Fixed price to pay: <span className="font-semibold">${tierPricing[form.websiteTier] ?? 0}</span>
            {' '}USD (full payment only, no partial payments)
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-slate-800 dark:text-slate-200"
              htmlFor="preferredPaymentMethod"
            >
              Preferred payment method<span className="text-brand-500 dark:text-brand-400">*</span>
            </label>
            <select
              id="preferredPaymentMethod"
              name="preferredPaymentMethod"
              value={form.preferredPaymentMethod}
              onChange={handleChange}
              className="nf-field"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          {form.preferredPaymentMethod === 'bank_transfer' && (
            <>
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-100/70 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            <p className="font-semibold">Pay this account now (full amount):</p>
            <p>Account holder: {siteConfig.bank.accountHolder}</p>
            <p>Bank name: {siteConfig.bank.bankName}</p>
            <p>Branch: {siteConfig.bank.branch}</p>
            <p>Branch transit: {siteConfig.bank.branchTransit}</p>
            <p>SWIFT code: {siteConfig.bank.swiftCode}</p>
            <p>Account number: {siteConfig.bank.accountNumber}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="payerFullName">
                Payer full name<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="payerFullName"
                name="payerFullName"
                type="text"
                required
                value={form.payerFullName}
                onChange={handleChange}
                className="nf-field"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="payerBankIdentifier">
                Bank identifier (SWIFT / transit / code)<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="payerBankIdentifier"
                name="payerBankIdentifier"
                type="text"
                required
                value={form.payerBankIdentifier}
                onChange={handleChange}
                placeholder="Example: FCIBBBBB or 09606"
                className="nf-field"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Auto-detected bank: {detectBankName(form.payerBankIdentifier) || '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="transferReference">
                Transfer reference<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="transferReference"
                name="transferReference"
                type="text"
                required
                value={form.transferReference}
                onChange={handleChange}
                className="nf-field"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="transferDate">
                Transfer date<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="transferDate"
                name="transferDate"
                type="date"
                required
                value={form.transferDate}
                onChange={handleChange}
                className="nf-field"
              />
            </div>
          </div>

          <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="paymentProofUrl">
                Payment proof URL<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <input
                id="paymentProofUrl"
                name="paymentProofUrl"
                type="url"
                required
                value={form.paymentProofUrl}
                onChange={handleChange}
                placeholder="https://drive.google.com/... or screenshot link"
                className="nf-field"
              />
          </div>
            </>
          )}

          {form.preferredPaymentMethod === 'paypal' && (
            <p className="rounded-lg border border-sky-300/50 bg-sky-100/70 px-3 py-2 text-xs text-sky-900 dark:border-sky-700/60 dark:bg-sky-900/20 dark:text-sky-300">
              After submit, you will be redirected to PayPal to log in and complete full payment.
            </p>
          )}

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-slate-800 dark:text-slate-200"
              htmlFor="description"
            >
              Project description<span className="text-brand-500 dark:text-brand-400">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              value={form.description}
              onChange={handleChange}
              rows={5}
              placeholder="Share your goals, timeline, and any links or inspiration you have."
              className="nf-textarea"
            />
          </div>

          {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
          {success && <p className="text-xs text-emerald-600 dark:text-emerald-400">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="nf-btn-primary"
          >
            {submitting
              ? 'Sending...'
              : form.preferredPaymentMethod === 'paypal'
                ? 'Continue to PayPal'
                : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
};
