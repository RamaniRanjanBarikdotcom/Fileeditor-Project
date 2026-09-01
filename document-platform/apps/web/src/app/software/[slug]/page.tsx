'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Download, Loader2, Package, ShieldCheck } from 'lucide-react';
import { fetchApi } from '../../../lib/api';

type Currency = 'USD' | 'INR';
type Price = { currency: Currency; amountMinorUnits: number; provider: string };
type Product = { id: string; slug: string; name: string; tagline?: string; description: string; type: string; prices: Price[]; currentRelease?: { version: string; fileSizeBytes: number } | null };
type Checkout = { provider: 'STRIPE' | 'RAZORPAY'; orderId: string; checkoutUrl?: string; razorpayOrderId?: string; keyId?: string; amount?: number; currency?: string; productName?: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const money = (price: Price | undefined, currency: Currency) => price
  ? new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price.amountMinorUnits / 100)
  : 'Unavailable';

async function loadRazorpay() {
  if (window.Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SoftwareDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const response = await fetchApi<Product>(`/products/${slug}`);
      if (response.success && response.data) setProduct(response.data);
      else setError(response.error?.message || 'Product not found.');
      setLoading(false);
    })();
  }, [slug]);

  const checkout = async () => {
    if (!product?.currentRelease) return;
    setBuying(true);
    setError('');
    const result = await fetchApi<Checkout>('/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, currency, successUrl: `${window.location.origin}/app/library?purchase=success`, cancelUrl: window.location.href }),
    });
    if (!result.success || !result.data) {
      const message = result.error?.message || 'Checkout could not be started.';
      setError(message.includes('Unauthorized') ? 'Please sign in before starting checkout.' : message);
      setBuying(false);
      return;
    }
    if (result.data.provider === 'STRIPE' && result.data.checkoutUrl) {
      window.location.assign(result.data.checkoutUrl);
      return;
    }
    const ready = await loadRazorpay();
    if (!ready || !window.Razorpay) {
      setError('Razorpay checkout could not be loaded. Please check your connection.');
      setBuying(false);
      return;
    }
    const data = result.data;
    const gateway = new window.Razorpay({
      key: data.keyId, amount: data.amount, currency: data.currency, name: 'ToolSuite', description: data.productName,
      order_id: data.razorpayOrderId,
      handler: async (payment: Record<string, string>) => {
        const verified = await fetchApi('/orders/verify-razorpay', { method: 'POST', body: JSON.stringify({ orderId: data.orderId, razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature }) });
        if (verified.success) router.push('/app/library?purchase=success');
        else { setError(verified.error?.message || 'Payment verification failed.'); setBuying(false); }
      },
      modal: { ondismiss: () => setBuying(false) }, theme: { color: '#6366f1' },
    });
    gateway.open();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}><Loader2 className="h-5 w-5 animate-spin" /> Loading product…</div>;
  if (!product) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><AlertCircle className="mx-auto mb-4 h-10 w-10 text-rose-500" /><h1 className="ts-h2">Product unavailable</h1><p className="my-4" style={{ color: 'var(--text-muted)' }}>{error}</p><Link className="btn btn-primary" href="/software">Back to store</Link></div>;

  const price = product.prices.find((item) => item.currency === currency);
  const available = Boolean(product.currentRelease && price);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <nav className="mb-10 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}><Link href="/">Home</Link><ChevronRight className="h-3 w-3" /><Link href="/software">Software</Link><ChevronRight className="h-3 w-3" /><span>{product.name}</span></nav>
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_380px]">
        <section>
          <span className="badge mb-5 bg-indigo-500/10 text-indigo-500">{product.type}{product.currentRelease ? ` · v${product.currentRelease.version}` : ' · preview'}</span>
          <h1 className="ts-h1 mb-5">{product.name}</h1>
          {product.tagline && <p className="mb-4 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>{product.tagline}</p>}
          <p className="max-w-3xl text-base leading-8" style={{ color: 'var(--text-muted)' }}>{product.description}</p>
          <div className="card mt-10 p-7"><h2 className="ts-h3 mb-5">Purchase protection</h2><ul className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}><li className="feature-item"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Availability is checked against the current catalog release.</li><li className="feature-item"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Payment is verified by Stripe or Razorpay before access is granted.</li><li className="feature-item"><Download className="h-4 w-4 text-emerald-500" /> Purchased releases use short-lived, signed download links.</li></ul></div>
        </section>
        <aside className="card border-2 border-indigo-500/60 p-8 shadow-xl">
          <div className="mb-5 flex gap-2">{(['USD', 'INR'] as Currency[]).map((item) => <button key={item} onClick={() => setCurrency(item)} className={`rounded-lg px-4 py-2 text-xs font-bold ${currency === item ? 'bg-indigo-600 text-white' : 'bg-slate-500/10'}`}>{item}</button>)}</div>
          <div className="text-4xl font-extrabold">{money(price, currency)}</div><p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{available ? 'One-time purchase' : 'Checkout opens when a release file is published'}</p>
          {!product.currentRelease && <div className="my-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-500"><Package className="mr-2 inline h-4 w-4" />This catalog item has no downloadable release yet, so purchasing is safely disabled.</div>}
          {error && <div className="my-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>}
          <button disabled={!available || buying} onClick={() => void checkout()} className="btn btn-primary btn-lg mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50">{buying ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting checkout…</> : <>Buy securely <ArrowRight className="h-4 w-4" /></>}</button>
          {error.includes('sign in') && <Link href={`/login?redirect=/software/${product.slug}`} className="mt-4 block text-center text-sm font-semibold text-indigo-500">Sign in to continue</Link>}
        </aside>
      </div>
    </div>
  );
}
