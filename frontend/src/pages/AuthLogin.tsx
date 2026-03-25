import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Helmet } from 'react-helmet-async';

export const AuthLogin = () => {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      login(res.data.token, res.data.user);
      nav('/dashboard');
    } catch {
      setError('Invalid credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Log in · Orvanta Studio</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Access your requests and payment status.
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
            className="nf-field"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="nf-field"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>
        {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="nf-btn-primary w-full"
        >
          {submitting ? 'Signing in...' : 'Log in'}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          New here?{' '}
          <Link className="text-slate-800 underline-offset-4 hover:underline dark:text-slate-200" to="/register">
            Create an account
          </Link>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Forgot password?{' '}
          <Link
            className="text-slate-800 underline-offset-4 hover:underline dark:text-slate-200"
            to="/forgot-password"
          >
            Reset it
          </Link>
        </p>
      </form>
    </div>
    </>
  );
};

