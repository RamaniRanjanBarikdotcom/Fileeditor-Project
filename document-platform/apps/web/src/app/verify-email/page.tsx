'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { fetchApi } from '../../lib/api';

export default function VerifyEmailPage() {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    void (async () => {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        setMessage('This verification link is missing its token.');
        setState('error');
        return;
      }
      const result = await fetchApi('/auth/verify-email/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (result.success) setState('done');
      else {
        setMessage(result.error?.message || 'This verification link is invalid or expired.');
        setState('error');
      }
    })();
  }, []);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="card w-full max-w-md p-9 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-indigo-500" />
            <h1 className="ts-h3">Verifying your email…</h1>
          </>
        )}
        {state === 'done' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="ts-h2">Email verified</h1>
            <Link href="/app" className="btn btn-primary mt-6">
              Open workspace
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <MailWarning className="mx-auto mb-4 h-12 w-12 text-rose-500" />
            <h1 className="ts-h2">Verification failed</h1>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {message}
            </p>
            <Link href="/app/settings" className="btn btn-secondary mt-6">
              Account settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
