import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevToken(null);
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      setMessage(
        res.data?.message ||
          'If an account exists with that email, a reset link has been sent.'
      );
      if (res.data?.resetToken) setDevToken(res.data.resetToken);
    } catch {
      setError('Could not request password reset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Forgot password · NovaForge Web Studios</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter your email and we will send a password reset link.
          </p>
        </header>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
          {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
          {devToken && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Dev reset token: <span className="font-mono">{devToken}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400 disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Back to{' '}
            <Link className="text-slate-800 underline-offset-4 hover:underline dark:text-slate-200" to="/login">
              login
            </Link>
          </p>
        </form>
      </div>
    </>
  );
};

