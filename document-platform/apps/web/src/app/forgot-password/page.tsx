'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { fetchApi } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    const result = await fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    if (result.success) setMessage('If an account exists for that address, a reset link has been sent.');
    else setError(result.error?.message || 'The reset request could not be sent.');
    setLoading(false);
  };
  return <div className="flex min-h-[75vh] items-center justify-center px-5"><div className="card w-full max-w-md p-8"><Mail className="mb-5 h-10 w-10 text-indigo-500" /><h1 className="ts-h2 mb-3">Reset your password</h1><p className="mb-7 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>Enter your account email and we will send a one-hour reset link.</p>{message ? <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-500"><CheckCircle2 className="mr-2 inline h-4 w-4" />{message}</div> : <form onSubmit={submit} className="space-y-4"><input className="input" type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />{error && <p className="text-sm text-rose-500">{error}</p>}<button disabled={loading} className="btn btn-primary w-full">{loading ? 'Sending…' : 'Send reset link'}</button></form>}<Link href="/login" className="mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-500"><ArrowLeft className="h-4 w-4" />Back to sign in</Link></div></div>;
}
