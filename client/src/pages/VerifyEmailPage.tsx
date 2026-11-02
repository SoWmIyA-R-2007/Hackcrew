import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<'checking' | 'done' | 'failed'>(token ? 'checking' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its code. Open it again from the email.');
  const started = useRef(false);

  useEffect(() => {
    // The token is single use, so make sure a re-render (or React's development double run) sends it only once
    if (!token || started.current) return;
    started.current = true;
    api
      .verifyEmail(token)
      .then(() => setState('done'))
      .catch((err) => {
        setState('failed');
        setMessage(err instanceof Error ? err.message : 'This link did not work.');
      });
  }, [token]);

  return (
    <AuthShell title={state === 'done' ? 'Email confirmed' : state === 'failed' ? 'Link did not work' : 'Confirming…'}>
      <p className="mt-2 text-ink-2" role={state === 'failed' ? 'alert' : 'status'}>
        {state === 'done'
          ? 'Thanks. Your email address is confirmed, so you can reset your password if you ever forget it.'
          : state === 'failed'
            ? message
            : 'Checking your link.'}
      </p>
      {state !== 'checking' && (
        <Link to="/dashboard" className="btn btn-primary mt-6">
          Go to your hackathons
        </Link>
      )}
    </AuthShell>
  );
}
