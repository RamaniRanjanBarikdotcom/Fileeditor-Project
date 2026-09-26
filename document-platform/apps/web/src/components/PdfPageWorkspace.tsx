'use client';

import React, { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, ArrowRight, GripVertical, Loader2 } from 'lucide-react';
import { PDFJS_DOCUMENT_OPTIONS } from '@/lib/pdfjs-config.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  file: File;
  operation: string;
  pageOrder: string;
  pageSelection: string;
  onPageOrderChange: (value: string) => void;
  onPageSelectionChange: (value: string) => void;
}

const SELECTABLE = new Set(['pdf.extractPages', 'pdf.deletePages']);
const MAX_THUMBNAILS = 60;

function parseSelection(value: string): Set<number> {
  const selected = new Set<number>();
  value.split(',').forEach((part) => {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return;
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    for (let page = start; page <= end; page += 1) selected.add(page);
  });
  return selected;
}

export function PdfPageWorkspace({
  file,
  operation,
  pageOrder,
  pageSelection,
  onPageOrderChange,
  onPageSelectionChange,
}: Props) {
  const [pageCount, setPageCount] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const selected = useMemo(() => parseSelection(pageSelection), [pageSelection]);
  const isOrganizer = operation === 'pdf.organize';
  const isSelectable = SELECTABLE.has(operation);
  const order = useMemo(() => {
    const parsed = pageOrder
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount);
    return parsed.length ? parsed : Array.from({ length: pageCount }, (_, index) => index + 1);
  }, [pageCount, pageOrder]);

  const initialize = (pages: number) => {
    setPageCount(pages);
    if (isOrganizer) {
      const initial = Array.from({ length: pages }, (_, index) => index + 1);
      onPageOrderChange(initial.join(','));
    }
  };

  const updateOrder = (next: number[]) => {
    onPageOrderChange(next.join(','));
  };

  const move = (index: number, amount: number) => {
    const target = index + amount;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    updateOrder(next);
  };

  const togglePage = (page: number) => {
    const next = new Set(selected);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    onPageSelectionChange([...next].sort((a, b) => a - b).join(','));
  };

  const visiblePages = isOrganizer
    ? order.slice(0, MAX_THUMBNAILS)
    : Array.from({ length: Math.min(pageCount, MAX_THUMBNAILS) }, (_, index) => index + 1);

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-muted)' }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Page preview
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isOrganizer
              ? 'Drag pages or use arrow buttons to reorder them.'
              : isSelectable
                ? 'Click thumbnails to select pages.'
                : 'Review the source pages before processing.'}
          </p>
        </div>
        {pageCount > 0 && <span className="badge badge-neutral">{pageCount} pages</span>}
      </div>

      {error ? (
        <p className="p-4 text-sm text-red-500">{error}</p>
      ) : (
        <Document
          file={file}
          options={PDFJS_DOCUMENT_OPTIONS}
          onLoadSuccess={({ numPages }) => initialize(numPages)}
          onLoadError={() =>
            setError('This PDF preview could not be opened. It may be encrypted or damaged.')
          }
          loading={
            <div
              className="flex items-center justify-center gap-2 p-8 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing page previews…
            </div>
          }
        >
          <div className="flex gap-3 overflow-x-auto p-4">
            {visiblePages.map((pageNumber, index) => {
              const active = isSelectable && selected.has(pageNumber);
              return (
                <article
                  key={`${pageNumber}-${index}`}
                  draggable={isOrganizer}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => isOrganizer && event.preventDefault()}
                  onDrop={() => {
                    if (!isOrganizer || dragIndex === null || dragIndex === index) return;
                    const next = [...order];
                    const [moved] = next.splice(dragIndex, 1);
                    next.splice(index, 0, moved);
                    updateOrder(next);
                    setDragIndex(null);
                  }}
                  className={`relative shrink-0 overflow-hidden rounded-xl border-2 bg-white shadow-sm transition ${active ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <button
                    type="button"
                    onClick={() => isSelectable && togglePage(pageNumber)}
                    className="block p-2"
                    aria-pressed={active}
                    aria-label={`${active ? 'Deselect' : 'Select'} page ${pageNumber}`}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={118}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={<div className="h-40 w-[118px] animate-pulse bg-slate-100" />}
                    />
                  </button>
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600">
                    {isOrganizer && <GripVertical className="h-3.5 w-3.5 text-slate-400" />}
                    <span>Page {pageNumber}</span>
                    {isOrganizer && (
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30"
                          aria-label={`Move page ${pageNumber} left`}
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === order.length - 1}
                          className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30"
                          aria-label={`Move page ${pageNumber} right`}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Document>
      )}
      {pageCount > MAX_THUMBNAILS && (
        <p
          className="border-t px-4 py-2 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Showing the first {MAX_THUMBNAILS} pages to keep this tab responsive. Manual ranges can
          include all {pageCount} pages.
        </p>
      )}
    </section>
  );
}
