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
  const allowDevTokenDisplay = import.meta.env.DEV;

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
      if (allowDevTokenDisplay && res.data?.resetToken) setDevToken(res.data.resetToken);
    } catch {
      setError('Could not request password reset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Forgot password · Orvanta Studio</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter your email and we will send a password reset link.
          </p>
        </header>

        <form onSubmit={submit} className="nf-card rounded-2xl p-6 space-y-4">
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
              className="nf-field"
            />
          </div>

          {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
          {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
          {allowDevTokenDisplay && devToken && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Dev reset token: <span className="font-mono">{devToken}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="nf-btn-primary w-full"
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

