import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, Check, FileCheck2, Globe2, Landmark, QrCode, Receipt, ShieldCheck, ShoppingCart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Invoice Studio — GST & VAT Invoices with Inventory | AppToolkitLab',
  description:
    'Create GST and EU VAT invoices, quotations and credit notes in any language, and keep stock, suppliers and purchase orders in sync automatically.',
  alternates: { canonical: '/saas/invoice-inventory' },
};

const FEATURES = [
  { icon: Landmark, title: 'Tax done right', text: 'India GST (CGST/SGST/IGST, exports under LUT, reverse charge, cess) and EU VAT (reverse charge, OSS, exports), with the legal wording printed for you.' },
  { icon: Globe2, title: 'Any language', text: '13 ready languages, bilingual documents and right-to-left scripts. Rename any label to print in any other language.' },
  { icon: Receipt, title: 'Every document', text: 'Tax invoices, bills of supply, export invoices, quotations, proforma, credit and debit notes, delivery challans, purchase orders and bills.' },
  { icon: Boxes, title: 'Stock that updates itself', text: 'Issuing an invoice deducts stock; credit notes and goods receipts add it back. Multiple warehouses, transfers and low-stock alerts.' },
  { icon: ShoppingCart, title: 'Purchasing', text: 'Purchase orders, partial goods receipts against them, supplier bills and weighted-average stock valuation.' },
  { icon: QrCode, title: 'Get paid faster', text: 'UPI and SEPA payment QR codes on every invoice, secure share links, email with the PDF attached and payment tracking.' },
];

export default function InvoiceStudioLandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <section className="relative overflow-hidden border-b border-[var(--border)] px-5 py-24 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(62,99,221,.16),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,.12),transparent_30%)]" />
        <div className="container-custom relative max-w-4xl text-center">
          <span className="badge badge-brand mb-6 inline-flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" /> Invoicing + inventory
          </span>
          <h1 className="ts-h1 text-balance">
            Professional invoices in <span className="gradient-text">any language</span>, with stock kept in sync
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
            Invoice Studio calculates GST and VAT correctly, numbers every document without gaps, prints a
            pixel-identical PDF and updates your inventory the moment you issue.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/app/invoices" className="btn btn-primary btn-lg">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="btn btn-secondary btn-lg">See plans</Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-[var(--text-secondary)]">
            {['20 free invoices every month', 'No card needed to start', 'Legal copy archived for every invoice'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" />{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="container-custom grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-7">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-5 text-lg font-black text-[var(--text-primary)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg-muted)] px-5 py-16">
        <div className="container-custom flex flex-col items-center gap-4 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <h2 className="text-2xl font-black text-[var(--text-primary)]">Built for records you can rely on</h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Issued documents cannot be edited, only corrected with credit or debit notes. Every issued PDF is archived
            with a fingerprint, and every stock change is kept in an audit-ready ledger.
          </p>
        </div>
      </section>
    </div>
  );
}
