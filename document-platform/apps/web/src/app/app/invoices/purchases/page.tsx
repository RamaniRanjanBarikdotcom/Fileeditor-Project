'use client';

import DocumentList from '../components/DocumentList';

const PURCHASE_TABS = [
  { id: 'PURCHASE_ORDER', label: 'Purchase orders', create: 'PURCHASE_ORDER' },
  { id: 'PURCHASE_BILL', label: 'Bills', create: 'PURCHASE_BILL' },
];

export default function PurchasesPage() {
  return <DocumentList tabs={PURCHASE_TABS} title="Purchases" />;
}
