import { FormEvent, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type FormState = {
  name: string;
  email: string;
  projectType: string;
  budgetRange: string;
  preferredPaymentMethod: string;
  description: string;
};

const initialState: FormState = {
  name: '',
  email: '',
  projectType: '',
  budgetRange: '',
  preferredPaymentMethod: 'bank_transfer',
  description: ''
};

const field =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100';

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
      !form.budgetRange ||
      !form.preferredPaymentMethod ||
      !form.description
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/requests', form);
      setSuccess('Thanks! Your project request has been received.');
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
        <title>Request a Website · NovaForge Web Studios</title>
        <meta
          name="description"
          content="Tell NovaForge about your project — scope, budget, and goals. We respond within one business day."
        />
      </Helmet>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Request a Website
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Share a bit about your project and we’ll follow up within one business day with next steps.
          </p>
          <p className="text-xs rounded-lg border border-amber-300/50 bg-amber-100/70 px-3 py-2 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
            Payment-first policy: your website delivery is unlocked only after payment is confirmed.
          </p>
        </header>
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
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
                className={field}
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
                className={field}
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
                className={field}
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
                htmlFor="budgetRange"
              >
                Budget range (USD)<span className="text-brand-500 dark:text-brand-400">*</span>
              </label>
              <select
                id="budgetRange"
                name="budgetRange"
                required
                value={form.budgetRange}
                onChange={handleChange}
                className={field}
              >
                <option value="">Select a range</option>
                <option value="1500-3000">$1,500 – $3,000</option>
                <option value="3000-6000">$3,000 – $6,000</option>
                <option value="6000-10000">$6,000 – $10,000</option>
                <option value="10000+">$10,000+</option>
              </select>
            </div>
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
            required
            value={form.preferredPaymentMethod}
            onChange={handleChange}
            className={field}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="paypal">PayPal</option>
            <option value="crypto">Crypto</option>
            <option value="other">Other</option>
          </select>
        </div>

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
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
          {success && <p className="text-xs text-emerald-600 dark:text-emerald-400">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
};
