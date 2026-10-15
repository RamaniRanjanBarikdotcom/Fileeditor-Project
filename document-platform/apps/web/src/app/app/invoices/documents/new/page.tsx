'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DocumentEditor from '../../components/DocumentEditor';
import { DOCUMENT_LABELS } from '../../lib';

function NewDocument() {
  const params = useSearchParams();
  const requested = params.get('type') ?? 'TAX_INVOICE';
  const type = DOCUMENT_LABELS[requested] ? requested : 'TAX_INVOICE';
  return <DocumentEditor key={type} documentType={type} referenceDocumentId={params.get('ref') ?? undefined} />;
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={null}>
      <NewDocument />
    </Suspense>
  );
}
