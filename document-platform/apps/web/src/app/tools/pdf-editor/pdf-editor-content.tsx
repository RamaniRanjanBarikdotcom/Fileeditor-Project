'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/src/Page/TextLayer.css';
import 'react-pdf/src/Page/AnnotationLayer.css';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Upload, Download, Loader2, ZoomIn, ZoomOut, FileText, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Status = 'idle' | 'loading' | 'editing' | 'saving' | 'done';

interface TextItem {
  id: string;
  str: string;
  x: number;      // PDF coords
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageNum: number;
}

export default function PDFEditorContent() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; pdfWidth: number; pdfHeight: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Please select a PDF file.'); return; }
    setError(null);
    setStatus('loading');
    setDownloadUrl(null);
    setEdits(new Map());
    setActiveId(null);
    setPage(1);

    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    setFileBytes(bytes);
    setFile(f);

    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    setNumPages(doc.numPages);

    // Extract text items from all pages
    const items: TextItem[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pdfPage = await doc.getPage(p);
      const tc = await pdfPage.getTextContent();
      tc.items.forEach((item: any, i: number) => {
        if (!item.str?.trim()) return;
        const [scaleX, , , scaleY, tx, ty] = item.transform;
        const fs = Math.abs(scaleY) || Math.abs(scaleX) || 12;
        items.push({
          id: `${p}-${i}`,
          str: item.str,
          x: tx,
          y: ty,
          width: item.width || fs * item.str.length * 0.6,
          height: item.height || fs * 1.2,
          fontSize: fs,
          pageNum: p,
        });
      });
    }
    setTextItems(items);
    setStatus('editing');
  }, []);

  // Update viewport dimensions when page or scale changes
  useEffect(() => {
    if (!fileBytes || status !== 'editing') return;
    (async () => {
      const doc = await pdfjs.getDocument({ data: fileBytes.slice() }).promise;
      const pdfPage = await doc.getPage(page);
      const vp = pdfPage.getViewport({ scale: 1 });
      setPageViewport({
        width: vp.width * scale,
        height: vp.height * scale,
        pdfWidth: vp.width,
        pdfHeight: vp.height,
      });
    })();
  }, [fileBytes, page, scale, status]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  };

  const getText = (item: TextItem) => edits.get(item.id) ?? item.str;

  const commitEdit = (id: string, val: string) => {
    setEdits(prev => {
      const next = new Map(prev);
      next.set(id, val);
      return next;
    });
    setActiveId(null);
  };

  // Convert PDF coords → screen coords for current page
  const toScreen = (item: TextItem) => {
    if (!pageViewport) return null;
    const { width: sw, height: sh, pdfWidth, pdfHeight } = pageViewport;
    const sx = (item.x / pdfWidth) * sw;
    // PDF Y is bottom-up; screen Y is top-down
    const sy = sh - ((item.y + item.height) / pdfHeight) * sh;
    const sWidth = (item.width / pdfWidth) * sw;
    const sHeight = (item.height / pdfHeight) * sh;
    const sFontSize = (item.fontSize / pdfHeight) * sh;
    return { sx, sy, sWidth, sHeight, sFontSize };
  };

  const saveAndDownload = async () => {
    if (!fileBytes) return;
    setStatus('saving');
    setError(null);
    try {
      const pdfDoc = await PDFDocument.load(fileBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // Group edits by page
      const editedItems = textItems.filter(item => edits.has(item.id));

      for (const item of editedItems) {
        const pdfPage = pages[item.pageNum - 1];
        if (!pdfPage) continue;
        const newText = edits.get(item.id) ?? item.str;

        // White out original text area
        pdfPage.drawRectangle({
          x: item.x - 1,
          y: item.y - 1,
          width: item.width + 2,
          height: item.height + 2,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // Draw new text at same position
        const fs = Math.min(item.fontSize, 72);
        pdfPage.drawText(newText, {
          x: item.x,
          y: item.y,
          size: fs,
          font,
          color: rgb(0, 0, 0),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Failed to save PDF.');
      setStatus('editing');
    }
  };

  const reset = () => {
    setFile(null); setFileBytes(null); setStatus('idle');
    setError(null); setDownloadUrl(null); setPage(1);
    setTextItems([]); setEdits(new Map()); setActiveId(null);
  };

  const currentItems = textItems.filter(item => item.pageNum === page);

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-100 dark:bg-slate-950">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
            <PenLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm">PDF Editor</span>
          {status === 'editing' && (
            <span className="text-xs text-slate-400 ml-1">— click any text to edit inline</span>
          )}
        </div>

        {status === 'editing' && (
          <>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.2))}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <ZoomIn className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {status === 'done' && downloadUrl ? (
            <>
              <a href={downloadUrl} download={`edited-${file?.name ?? 'document.pdf'}`}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                <Download className="w-4 h-4" /> Download PDF
              </a>
              <button onClick={reset}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                Edit another
              </button>
            </>
          ) : status === 'editing' ? (
            <>
              {edits.size > 0 && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{edits.size} edit{edits.size !== 1 ? 's' : ''}</span>
              )}
              <button onClick={saveAndDownload}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
                <Download className="w-4 h-4" /> Save &amp; Download
              </button>
              <button onClick={reset}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                Close
              </button>
            </>
          ) : status === 'saving' ? (
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </span>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
              <Upload className="w-4 h-4" /> Upload PDF
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm shrink-0">
          {error}
        </div>
      )}

      {/* Body */}
      {status === 'idle' ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-16 text-center hover:border-indigo-500 transition-colors cursor-pointer max-w-lg w-full bg-white dark:bg-slate-900"
          >
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Open a PDF to edit</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Drag & drop or click to browse</p>
          </div>
        </div>
      ) : status === 'loading' ? (
        <div className="flex-1 flex items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm text-slate-500">Extracting text…</span>
        </div>
      ) : (
        <div className="flex-1 overflow-auto flex flex-col items-center py-5 gap-4 bg-slate-200 dark:bg-slate-950">

          {/* Page nav */}
          {numPages > 1 && (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl px-4 py-2 shadow border border-slate-200 dark:border-slate-800 shrink-0">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                Page {page} / {numPages}
              </span>
              <button onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page === numPages}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* PDF canvas + overlays */}
          <div ref={containerRef} className="relative shadow-2xl shrink-0 select-none" style={{ cursor: 'text' }}>
            <Document file={file} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Text overlays */}
            {pageViewport && currentItems.map(item => {
              const coords = toScreen(item);
              if (!coords) return null;
              const { sx, sy, sWidth, sHeight, sFontSize } = coords;
              const isActive = activeId === item.id;
              const isEdited = edits.has(item.id);

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: sx,
                    top: sy,
                    width: Math.max(sWidth, 20),
                    height: Math.max(sHeight, sFontSize * 1.3),
                    fontSize: sFontSize,
                    lineHeight: 1.2,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    cursor: 'text',
                    boxSizing: 'border-box',
                  }}
                  onClick={() => !isActive && setActiveId(item.id)}
                >
                  {isActive ? (
                    <input
                      autoFocus
                      defaultValue={getText(item)}
                      onBlur={e => commitEdit(item.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(item.id, (e.target as HTMLInputElement).value); }
                        if (e.key === 'Escape') setActiveId(null);
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        minWidth: 60,
                        height: '100%',
                        fontSize: sFontSize,
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        lineHeight: 1.2,
                        background: 'rgba(255,255,255,0.95)',
                        border: '1.5px solid #6366f1',
                        borderRadius: 2,
                        outline: 'none',
                        padding: '0 2px',
                        color: '#000',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                        zIndex: 20,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        background: isEdited ? 'rgba(99,102,241,0.08)' : 'transparent',
                        border: isEdited ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        borderRadius: 2,
                        transition: 'background 0.1s, border-color 0.1s',
                      }}
                      onMouseEnter={e => { if (!isEdited) (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.06)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.4)'; }}
                      onMouseLeave={e => { if (!isEdited) { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; } }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
    </div>
  );
}
