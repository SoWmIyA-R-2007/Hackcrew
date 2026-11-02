import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'This link is missing its code. Open it again from the email.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <AuthShell title="Choose a new password">
      <p className="mt-2 text-ink-2">After this you are signed in here, and signed out everywhere else.</p>
      {error && (
        <p role="alert" className="mt-6 px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
          {error}{' '}
          {token && (
            <Link to="/forgot-password" className="underline font-medium">
              Ask for a new link
            </Link>
          )}
        </p>
      )}
      {token && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-password" className="field-label">
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
            <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
          </div>
          <button type="submit" className="btn btn-primary w-full h-11" disabled={saving}>
            {saving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
