'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Lock } from 'lucide-react';
import { fetchApi } from '../../lib/api';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [done, setDone] = useState(false); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setError('This reset link is missing its token.'); return; }
    setLoading(true); const result = await fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
    if (result.success) setDone(true); else setError(result.error?.message || 'This reset link is invalid or expired.'); setLoading(false);
  };
  return <div className="flex min-h-[75vh] items-center justify-center px-5"><div className="card w-full max-w-md p-8"><Lock className="mb-5 h-10 w-10 text-indigo-500" /><h1 className="ts-h2 mb-6">Choose a new password</h1>{done ? <div><p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-500"><CheckCircle2 className="mr-2 inline h-4 w-4" />Your password was changed and existing sessions were signed out.</p><Link href="/login" className="btn btn-primary mt-6 w-full">Sign in</Link></div> : <form onSubmit={submit} className="space-y-4"><input className="input" type="password" minLength={8} required placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} /><input className="input" type="password" minLength={8} required placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />{error && <p className="text-sm text-rose-500">{error}</p>}<button disabled={loading} className="btn btn-primary w-full">{loading ? 'Updating…' : 'Update password'}</button></form>}</div></div>;
}
