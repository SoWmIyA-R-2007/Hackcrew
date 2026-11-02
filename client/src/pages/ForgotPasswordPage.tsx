import React, { useState } from 'react';
import { Link } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell title={sent ? 'Check your email' : 'Reset your password'}>
      {sent ? (
        <>
          <p className="mt-2 text-ink-2" role="status">
            If an account uses {email.trim()}, we've sent it a link to choose a new password. The link works for 1 hour.
          </p>
          <p className="mt-3 text-sm text-ink-3">Nothing arrived? Check your spam folder, or try again in a few minutes.</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-ink-2">Enter the email you sign in with and we'll send you a link to choose a new password.</p>
          {error && (
            <p role="alert" className="mt-6 px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="field-label">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="field"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full h-11" disabled={sending}>
              {sending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <p className="mt-8 text-sm text-ink-2">
        <Link to="/login" className="text-accent font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
