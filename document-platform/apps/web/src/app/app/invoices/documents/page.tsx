'use client';

import DocumentList, { SALES_TABS } from '../components/DocumentList';

export default function SalesDocumentsPage() {
  return <DocumentList tabs={SALES_TABS} title="Sales documents" />;
}
