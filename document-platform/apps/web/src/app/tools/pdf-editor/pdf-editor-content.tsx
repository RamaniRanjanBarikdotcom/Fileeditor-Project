'use client';

import React, { useMemo, useReducer, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PDFJS_DOCUMENT_OPTIONS } from '@/lib/pdfjs-config.mjs';
import {
  Bold,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Highlighter,
  Italic,
  Layers3,
  Loader2,
  MousePointer2,
  Pencil,
  Redo2,
  ShieldCheck,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Tool = 'select' | 'text' | 'highlight' | 'rectangle' | 'draw';
type Selection = { kind: 'original' | 'text' | 'shape' | 'stroke'; id: string } | null;
type Point = { x: number; y: number };
type TextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  bold: boolean;
  italic: boolean;
  page: number;
};
type AddedText = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  page: number;
};
type Shape = {
  id: string;
  type: 'highlight' | 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  page: number;
};
type Stroke = { id: string; points: Point[]; width: number; color: string; page: number };
type Edit = { text: string; size: number; color: string; bold: boolean; italic: boolean };
type EditorState = {
  edits: Record<string, Edit>;
  texts: AddedText[];
  shapes: Shape[];
  strokes: Stroke[];
};
type History = { past: EditorState[]; current: EditorState; future: EditorState[] };
type Gesture = {
  tool: 'highlight' | 'rectangle' | 'draw';
  start: Point;
  current: Point;
  points: Point[];
};

const EMPTY: EditorState = { edits: {}, texts: [], shapes: [], strokes: [] };
const INITIAL: History = { past: [], current: EMPTY, future: [] };
const TOOLS: Array<{
  id: Tool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}> = [
  { id: 'select', label: 'Edit', icon: MousePointer2, hint: 'Select and replace detected text' },
  { id: 'text', label: 'Text', icon: Type, hint: 'Click the page to add text' },
  {
    id: 'highlight',
    label: 'Highlight',
    icon: Highlighter,
    hint: 'Drag across an area to highlight it',
  },
  { id: 'rectangle', label: 'Shape', icon: Square, hint: 'Drag to add an outline' },
  { id: 'draw', label: 'Draw', icon: Pencil, hint: 'Draw freehand annotations' },
];

function reducer(
  state: History,
  action: { type: 'set'; value: EditorState } | { type: 'undo' | 'redo' | 'reset' },
): History {
  if (action.type === 'reset') return INITIAL;
  if (action.type === 'undo' && state.past.length)
    return {
      past: state.past.slice(0, -1),
      current: state.past.at(-1)!,
      future: [state.current, ...state.future],
    };
  if (action.type === 'redo' && state.future.length)
    return {
      past: [...state.past, state.current].slice(-60),
      current: state.future[0],
      future: state.future.slice(1),
    };
  if (action.type === 'set')
    return { past: [...state.past, state.current].slice(-60), current: action.value, future: [] };
  return state;
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const pct = (value: number, total: number) => `${(value / total) * 100}%`;
const color = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const changeCount = (state: EditorState) =>
  Object.keys(state.edits).length + state.texts.length + state.shapes.length + state.strokes.length;

export default function PDFEditorContent() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'editing' | 'saving'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [items, setItems] = useState<TextItem[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<Selection>(null);
  const [editing, setEditing] = useState<Selection>(null);
  const [zoom, setZoom] = useState(1.1);
  const [ink, setInk] = useState('#6d5dfc');
  const [fontSize, setFontSize] = useState(16);
  const [lineWidth, setLineWidth] = useState(3);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, dispatch] = useReducer(reducer, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const size = sizes[page];
  const documentFile = useMemo(() => (bytes ? { data: bytes.slice() } : null), [bytes]);
  const pageItems = useMemo(() => items.filter((item) => item.page === page), [items, page]);
  const apply = (fn: (state: EditorState) => EditorState) => {
    dispatch({ type: 'set', value: fn(history.current) });
    setMessage('');
  };

  async function openPdf(nextFile: File) {
    if (!nextFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file.');
      return;
    }
    if (nextFile.size > 75 * 1024 * 1024) {
      setError('Choose a PDF smaller than 75 MB.');
      return;
    }
    setStatus('loading');
    setError('');
    setMessage('');
    setFile(nextFile);
    setPage(1);
    dispatch({ type: 'reset' });
    try {
      const data = new Uint8Array(await nextFile.arrayBuffer());
      const pdf = await pdfjs.getDocument({
        ...PDFJS_DOCUMENT_OPTIONS,
        data: data.slice(),
      }).promise;
      const found: TextItem[] = [];
      const pageSizes: Record<number, { width: number; height: number }> = {};
      for (let p = 1; p <= pdf.numPages; p += 1) {
        const pdfPage = await pdf.getPage(p);
        const viewport = pdfPage.getViewport({ scale: 1 });
        pageSizes[p] = { width: viewport.width, height: viewport.height };
        const content = await pdfPage.getTextContent();
        content.items.forEach((raw, index) => {
          if (!('str' in raw) || !raw.str.trim()) return;
          const calculated = Math.max(
            6,
            Math.hypot(raw.transform[2], raw.transform[3]) || raw.height || 12,
          );
          found.push({
            id: `${p}-${index}`,
            text: raw.str,
            x: raw.transform[4],
            y: raw.transform[5],
            width: Math.max(raw.width, 8),
            height: Math.max(raw.height, calculated),
            size: calculated,
            bold: raw.fontName.toLowerCase().includes('bold'),
            italic: /italic|oblique/i.test(raw.fontName),
            page: p,
          });
        });
        pdfPage.cleanup();
      }
      setBytes(data);
      setPages(pdf.numPages);
      setSizes(pageSizes);
      setItems(found);
      setStatus('editing');
      await pdf.destroy();
    } catch (reason) {
      console.error(reason);
      setStatus('idle');
      setFile(null);
      setError('This PDF could not be opened. It may be encrypted or damaged.');
    }
  }

  function pointFromEvent(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) * size.width,
      y:
        size.height -
        Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) * size.height,
    };
  }

  function commitText(target: NonNullable<Selection>, value: string) {
    if (target.kind === 'original') {
      const original = items.find((item) => item.id === target.id);
      if (!original) return;
      apply((state) => {
        const edits = { ...state.edits };
        if (value === original.text) delete edits[target.id];
        else
          edits[target.id] = {
            text: value,
            size: edits[target.id]?.size ?? original.size,
            color: edits[target.id]?.color ?? '#111827',
            bold: edits[target.id]?.bold ?? original.bold,
            italic: edits[target.id]?.italic ?? original.italic,
          };
        return { ...state, edits };
      });
    } else if (target.kind === 'text')
      apply((state) => ({
        ...state,
        texts: value.trim()
          ? state.texts.map((item) => (item.id === target.id ? { ...item, text: value } : item))
          : state.texts.filter((item) => item.id !== target.id),
      }));
    setEditing(null);
  }

  function removeSelected() {
    if (!selected) return;
    apply((state) => {
      if (selected.kind === 'original') {
        const original = items.find((item) => item.id === selected.id);
        return original
          ? {
              ...state,
              edits: {
                ...state.edits,
                [selected.id]: {
                  text: '',
                  size: original.size,
                  color: '#111827',
                  bold: original.bold,
                  italic: original.italic,
                },
              },
            }
          : state;
      }
      if (selected.kind === 'text')
        return { ...state, texts: state.texts.filter((item) => item.id !== selected.id) };
      if (selected.kind === 'shape')
        return { ...state, shapes: state.shapes.filter((item) => item.id !== selected.id) };
      return { ...state, strokes: state.strokes.filter((item) => item.id !== selected.id) };
    });
    setSelected(null);
    setEditing(null);
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const at = pointFromEvent(event);
    setMessage('');
    if (tool === 'select') {
      setSelected(null);
      setEditing(null);
      return;
    }
    if (tool === 'text') {
      const text: AddedText = {
        id: uid('text'),
        text: 'New text',
        x: at.x,
        y: at.y,
        size: fontSize,
        color: ink,
        bold: false,
        italic: false,
        page,
      };
      apply((state) => ({ ...state, texts: [...state.texts, text] }));
      setSelected({ kind: 'text', id: text.id });
      setEditing({ kind: 'text', id: text.id });
      setTool('select');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({ tool, start: at, current: at, points: [at] });
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!gesture) return;
    const at = pointFromEvent(event);
    setGesture((value) =>
      value
        ? {
            ...value,
            current: at,
            points: value.tool === 'draw' ? [...value.points, at] : value.points,
          }
        : null,
    );
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!gesture) return;
    const end = pointFromEvent(event);
    if (gesture.tool === 'draw' && gesture.points.length > 1) {
      const stroke: Stroke = {
        id: uid('stroke'),
        page,
        points: [...gesture.points, end],
        width: lineWidth,
        color: ink,
      };
      apply((state) => ({ ...state, strokes: [...state.strokes, stroke] }));
      setSelected({ kind: 'stroke', id: stroke.id });
    } else if (gesture.tool !== 'draw') {
      const shape: Shape = {
        id: uid('shape'),
        page,
        type: gesture.tool,
        x: Math.min(gesture.start.x, end.x),
        y: Math.min(gesture.start.y, end.y),
        width: Math.abs(end.x - gesture.start.x),
        height: Math.abs(end.y - gesture.start.y),
        color: ink,
      };
      if (shape.width > 3 && shape.height > 3) {
        apply((state) => ({ ...state, shapes: [...state.shapes, shape] }));
        setSelected({ kind: 'shape', id: shape.id });
      }
    }
    setGesture(null);
  }

  async function exportPdf() {
    if (!bytes || !file) return;
    setStatus('saving');
    setError('');
    setMessage('');
    try {
      const pdf = await PDFDocument.load(bytes.slice());
      const fonts = {
        regular: await pdf.embedFont(StandardFonts.Helvetica),
        bold: await pdf.embedFont(StandardFonts.HelveticaBold),
        italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
        boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
      };
      const fontFor = (style: { bold: boolean; italic: boolean }) =>
        style.bold && style.italic
          ? fonts.boldItalic
          : style.bold
            ? fonts.bold
            : style.italic
              ? fonts.italic
              : fonts.regular;
      Object.entries(history.current.edits).forEach(([id, edit]) => {
        const source = items.find((item) => item.id === id);
        if (!source) return;
        const target = pdf.getPage(source.page - 1);
        const selectedFont = fontFor(edit);
        const width = edit.text ? selectedFont.widthOfTextAtSize(edit.text, edit.size) : 0;
        target.drawRectangle({
          x: Math.max(0, source.x - 2),
          y: Math.max(0, source.y - 2),
          width: Math.max(source.width, width) + 4,
          height: Math.max(source.height, edit.size) + 4,
          color: rgb(1, 1, 1),
        });
        if (edit.text)
          target.drawText(edit.text, {
            x: source.x,
            y: source.y,
            size: edit.size,
            font: selectedFont,
            color: color(edit.color),
          });
      });
      history.current.texts.forEach((text) =>
        pdf.getPage(text.page - 1).drawText(text.text, {
          x: text.x,
          y: text.y,
          size: text.size,
          font: fontFor(text),
          color: color(text.color),
        }),
      );
      history.current.shapes.forEach((shape) => {
        const target = pdf.getPage(shape.page - 1);
        if (shape.type === 'highlight')
          target.drawRectangle({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            color: color(shape.color),
            opacity: 0.28,
          });
        else
          target.drawRectangle({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            borderColor: color(shape.color),
            borderWidth: lineWidth,
          });
      });
      history.current.strokes.forEach((stroke) =>
        stroke.points.slice(1).forEach((point, index) =>
          pdf.getPage(stroke.page - 1).drawLine({
            start: stroke.points[index],
            end: point,
            thickness: stroke.width,
            color: color(stroke.color),
            opacity: 0.95,
          }),
        ),
      );
      const output = await pdf.save();
      const browserBytes = new Uint8Array(output.byteLength);
      browserBytes.set(output);
      const url = URL.createObjectURL(new Blob([browserBytes], { type: 'application/pdf' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage('Edited PDF exported successfully.');
    } catch (reason) {
      console.error(reason);
      setError(
        'Export failed. Encrypted PDFs and unsupported font characters may need another file.',
      );
    } finally {
      setStatus('editing');
    }
  }

  const selectedOriginal =
    selected?.kind === 'original' ? items.find((item) => item.id === selected.id) : undefined;
  const selectedAdded =
    selected?.kind === 'text'
      ? history.current.texts.find((item) => item.id === selected.id)
      : undefined;
  const selectedValue = selectedOriginal
    ? (history.current.edits[selectedOriginal.id]?.text ?? selectedOriginal.text)
    : selectedAdded?.text;
  const selectedStyle = selectedOriginal
    ? (history.current.edits[selectedOriginal.id] ?? {
        text: selectedOriginal.text,
        size: selectedOriginal.size,
        color: '#111827',
        bold: selectedOriginal.bold,
        italic: selectedOriginal.italic,
      })
    : selectedAdded;

  function updateSelectedTextStyle(
    patch: Partial<Pick<Edit, 'size' | 'color' | 'bold' | 'italic'>>,
  ) {
    if (!selected) return;
    if (selected.kind === 'original' && selectedOriginal) {
      apply((state) => ({
        ...state,
        edits: {
          ...state.edits,
          [selected.id]: {
            text: state.edits[selected.id]?.text ?? selectedOriginal.text,
            size: patch.size ?? state.edits[selected.id]?.size ?? selectedOriginal.size,
            color: patch.color ?? state.edits[selected.id]?.color ?? '#111827',
            bold: patch.bold ?? state.edits[selected.id]?.bold ?? selectedOriginal.bold,
            italic: patch.italic ?? state.edits[selected.id]?.italic ?? selectedOriginal.italic,
          },
        },
      }));
    }
    if (selected.kind === 'text') {
      apply((state) => ({
        ...state,
        texts: state.texts.map((text) => (text.id === selected.id ? { ...text, ...patch } : text)),
      }));
    }
  }

  if (status === 'idle')
    return (
      <section className="relative min-h-[calc(100dvh-5rem)] overflow-hidden bg-[#f7f8fc] px-5 py-10 text-slate-950 dark:bg-[#080b12] dark:text-white sm:px-8 lg:py-14">
        <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-[1180px]" style={{ marginInline: 'auto' }}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,.82fr)_minmax(500px,1.18fr)] lg:gap-14">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-700 shadow-sm dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300">
                <Pencil className="h-3.5 w-3.5" /> Browser PDF editor
              </span>
              <h1 className="mt-6 text-[clamp(2.65rem,5vw,4rem)] font-black leading-[1.02] tracking-[-0.045em]">
                Make changes directly on your PDF.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                Edit detected text, add notes, highlight details, or draw on any page—then export a
                clean new PDF in seconds.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Private processing
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                  <Undo2 className="h-4 w-4 text-violet-500" /> Undo and redo
                </span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/90 bg-white/80 p-3 shadow-[0_24px_80px_-30px_rgba(76,29,149,.38)] backdrop-blur dark:border-white/10 dark:bg-[#111624]/90">
              <div className="mb-3 flex items-center justify-between px-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  Start editing
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  PDF · 75 MB max
                </span>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.files[0]) void openPdf(event.dataTransfer.files[0]);
                }}
                className="group flex min-h-[330px] w-full flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-8 text-center transition duration-300 hover:border-violet-500 hover:shadow-inner dark:border-violet-500/35 dark:from-violet-500/10 dark:via-[#0c1120] dark:to-fuchsia-500/10"
              >
                <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-xl shadow-violet-500/25 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105">
                  <Upload className="h-8 w-8" />
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400 dark:border-[#111624]" />
                </span>
                <span className="mt-6 text-2xl font-extrabold tracking-tight">Choose your PDF</span>
                <span className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Drag and drop a file here, or click to browse
                </span>
                <span className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition group-hover:bg-violet-600 dark:bg-white dark:text-slate-950 dark:group-hover:bg-violet-400">
                  Select PDF file
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.[0]) void openPdf(event.target.files[0]);
                  event.currentTarget.value = '';
                }}
              />
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300"
                >
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3" style={{ marginTop: '3rem' }}>
            {[
              [
                Type,
                'Edit and add text',
                'Replace selectable text or place new text precisely where you need it.',
              ],
              [
                Highlighter,
                'Annotate every page',
                'Highlight key details, add outlines, and draw freehand notes.',
              ],
              [
                Download,
                'Export a fresh PDF',
                'Keep the original untouched and download your completed edited copy.',
              ],
            ].map(([Icon, title, description], index) => (
              <article
                key={String(title)}
                className="group rounded-2xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-violet-500/40"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-violet-500">
                      0{index + 1}
                    </p>
                    <h2 className="mt-1 font-bold">{String(title)}</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {String(description)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );

  if (status === 'loading')
    return (
      <main className="grid min-h-[calc(100dvh-5rem)] place-items-center bg-slate-100 dark:bg-[#080b12]">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-500" />
          <h1 className="mt-5 text-2xl font-bold">Preparing your editor</h1>
          <p className="mt-2 text-slate-500">Reading pages and identifying editable text…</p>
        </div>
      </main>
    );

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-[#e9edf4] text-slate-950 dark:bg-[#070a10] dark:text-white">
      <header className="sticky top-16 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0e131e]/95">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 sm:px-5">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="max-w-56 truncate text-sm font-bold">{file?.name}</p>
              <p className="text-xs text-slate-500">
                {pages} pages · {changeCount(history.current)} unsaved changes
              </p>
            </div>
          </div>
          <div className="flex rounded-xl border border-slate-200 p-1 dark:border-white/10">
            <button
              title="Undo"
              disabled={!history.past.length}
              onClick={() => dispatch({ type: 'undo' })}
              className="rounded-lg p-2 disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              title="Redo"
              disabled={!history.future.length}
              onClick={() => dispatch({ type: 'redo' })}
              className="rounded-lg p-2 disabled:opacity-30"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center rounded-xl border border-slate-200 p-1 dark:border-white/10">
            <button
              title="Zoom out"
              onClick={() => setZoom((v) => Math.max(0.6, v - 0.15))}
              className="p-2"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-xs font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              title="Zoom in"
              onClick={() => setZoom((v) => Math.min(2.2, v + 0.15))}
              className="p-2"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 sm:block"
          >
            Open another
          </button>
          <button
            disabled={status === 'saving'}
            onClick={() => void exportPdf()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            {status === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{' '}
            Export PDF
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) void openPdf(e.target.files[0]);
              e.currentTarget.value = '';
            }}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 dark:border-white/5 sm:justify-center">
          {TOOLS.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              title={hint}
              onClick={() => {
                setTool(id);
                setEditing(null);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${tool === id ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {selectedStyle && (selected?.kind === 'original' || selected?.kind === 'text') && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-violet-50/90 px-3 py-2 dark:border-white/10 dark:bg-violet-500/10">
            <span className="mr-1 text-xs font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Text formatting
            </span>
            <button
              type="button"
              aria-label="Toggle bold"
              aria-pressed={selectedStyle.bold}
              onClick={() => updateSelectedTextStyle({ bold: !selectedStyle.bold })}
              className={`grid h-9 w-9 place-items-center rounded-lg border ${selectedStyle.bold ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white'}`}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Toggle italic"
              aria-pressed={selectedStyle.italic}
              onClick={() => updateSelectedTextStyle({ italic: !selectedStyle.italic })}
              className={`grid h-9 w-9 place-items-center rounded-lg border ${selectedStyle.italic ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white'}`}
            >
              <Italic className="h-4 w-4" />
            </button>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Size
              <input
                aria-label="Selected text size"
                type="number"
                min="6"
                max="96"
                value={Math.round(selectedStyle.size)}
                onChange={(event) =>
                  updateSelectedTextStyle({
                    size: Math.min(96, Math.max(6, Number(event.target.value) || 6)),
                  })
                }
                className="w-12 bg-transparent font-bold text-slate-950 outline-none dark:text-white"
              />
            </label>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Color
              <input
                aria-label="Selected text color"
                type="color"
                value={selectedStyle.color}
                onChange={(event) => updateSelectedTextStyle({ color: event.target.value })}
                className="h-6 w-7 cursor-pointer border-0 bg-transparent"
              />
            </label>
            <button
              type="button"
              onClick={removeSelected}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 dark:border-red-500/25 dark:bg-white/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-xs font-extrabold text-white shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Apply change
            </button>
          </div>
        )}
      </header>
      {(error || message) && (
        <div
          className={`mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {message && <CheckCircle2 className="h-4 w-4" />}
          {error || message}
        </div>
      )}
      <div className="grid min-h-[calc(100dvh-13rem)] xl:grid-cols-[180px_minmax(0,1fr)_270px]">
        <aside className="hidden border-r border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d111a] xl:block">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <Layers3 className="h-4 w-4 text-violet-500" />
            Pages
          </h2>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => {
                setPage(n);
                setSelected(null);
              }}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-2 text-left ${page === n ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10' : 'border-slate-200 dark:border-white/10'}`}
            >
              <span className="grid h-11 w-8 place-items-center rounded bg-white text-xs font-black shadow dark:bg-white/10">
                {n}
              </span>
              <span className="text-sm font-semibold">Page {n}</span>
            </button>
          ))}
        </aside>
        <section className="min-w-0 overflow-auto p-4 sm:p-8">
          <div className="mx-auto mb-4 flex w-fit flex-wrap items-center justify-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow dark:bg-[#111722]">
            <button
              disabled={page <= 1}
              onClick={() => setPage((n) => n - 1)}
              className="p-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-28 text-center text-sm font-semibold">
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((n) => n + 1)}
              className="p-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="mx-2 hidden h-5 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${pageItems.length ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}
            >
              {pageItems.length
                ? `${pageItems.length} editable text areas · click any text`
                : 'Image-only page · add text or run OCR first'}
            </span>
          </div>
          <Document file={documentFile || undefined} options={PDFJS_DOCUMENT_OPTIONS}>
            {size && (
              <div
                className="relative mx-auto overflow-hidden bg-white shadow-2xl ring-1 ring-black/10"
                style={{ width: size.width * zoom, height: size.height * zoom }}
              >
                <Page
                  pageNumber={page}
                  scale={zoom}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                <div
                  className="absolute inset-0 z-10 touch-none"
                  role="application"
                  aria-label={`PDF page ${page} editor`}
                  style={{
                    cursor: tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
                  }}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => setGesture(null)}
                />
                {pageItems.map((item) => {
                  const edit = history.current.edits[item.id];
                  const active = selected?.kind === 'original' && selected.id === item.id;
                  const input = editing?.kind === 'original' && editing.id === item.id;
                  return (
                    <div
                      key={item.id}
                      title="Click to edit this text"
                      className={`absolute z-20 rounded-[2px] transition ${tool === 'select' ? 'pointer-events-auto cursor-text hover:bg-sky-400/10 hover:outline hover:outline-1 hover:outline-sky-500' : 'pointer-events-none'} ${active ? 'bg-sky-400/10 outline outline-2 outline-sky-500' : ''}`}
                      style={{
                        left: pct(item.x, size.width),
                        top: pct(
                          size.height - item.y - Math.max(item.height, item.size),
                          size.height,
                        ),
                        minWidth: Math.max(item.width * zoom, 10),
                        minHeight: Math.max(item.height * zoom, 10),
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setSelected({ kind: 'original', id: item.id });
                        setEditing({ kind: 'original', id: item.id });
                      }}
                    >
                      {input ? (
                        <input
                          autoFocus
                          defaultValue={edit?.text ?? item.text}
                          aria-label={`Edit text: ${item.text}`}
                          className="rounded-sm border-2 border-sky-500 bg-white px-1 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,.18)] outline-none"
                          style={{
                            width: Math.max(item.width * zoom + 36, 120),
                            minHeight: Math.max(item.height * zoom + 6, 28),
                            fontSize: (edit?.size ?? item.size) * zoom,
                            fontWeight: (edit?.bold ?? item.bold) ? 700 : 400,
                            fontStyle: (edit?.italic ?? item.italic) ? 'italic' : 'normal',
                            lineHeight: 1.05,
                            color: edit?.color ?? '#111827',
                          }}
                          onBlur={(e) =>
                            commitText({ kind: 'original', id: item.id }, e.currentTarget.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                        />
                      ) : edit ? (
                        <span
                          className="block whitespace-nowrap bg-white px-0.5"
                          style={{
                            color: edit.color,
                            fontSize: edit.size * zoom,
                            fontWeight: edit.bold ? 700 : 400,
                            fontStyle: edit.italic ? 'italic' : 'normal',
                            lineHeight: 1.05,
                          }}
                        >
                          {edit.text || ' '}
                        </span>
                      ) : (
                        <span className="block h-full w-full" />
                      )}
                    </div>
                  );
                })}
                {history.current.texts
                  .filter((text) => text.page === page)
                  .map((text) => {
                    const input = editing?.kind === 'text' && editing.id === text.id;
                    return (
                      <div
                        key={text.id}
                        className={`absolute z-30 ${tool === 'select' ? 'pointer-events-auto' : 'pointer-events-none'} ${selected?.kind === 'text' && selected.id === text.id ? 'ring-2 ring-violet-500' : ''}`}
                        style={{
                          left: pct(text.x, size.width),
                          top: pct(size.height - text.y - text.size, size.height),
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          setSelected({ kind: 'text', id: text.id });
                          setEditing({ kind: 'text', id: text.id });
                        }}
                      >
                        {input ? (
                          <input
                            autoFocus
                            defaultValue={text.text}
                            aria-label="Edit added text"
                            className="min-w-32 rounded-sm border-2 border-sky-500 bg-white px-1 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,.18)] outline-none"
                            style={{
                              color: text.color,
                              fontSize: text.size * zoom,
                              fontWeight: text.bold ? 700 : 400,
                              fontStyle: text.italic ? 'italic' : 'normal',
                              lineHeight: 1.05,
                            }}
                            onBlur={(e) =>
                              commitText({ kind: 'text', id: text.id }, e.currentTarget.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                          />
                        ) : (
                          <span
                            className="whitespace-nowrap"
                            style={{
                              color: text.color,
                              fontSize: text.size * zoom,
                              fontWeight: text.bold ? 700 : 400,
                              fontStyle: text.italic ? 'italic' : 'normal',
                              lineHeight: 1.05,
                            }}
                          >
                            {text.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                {history.current.shapes
                  .filter((shape) => shape.page === page)
                  .map((shape) => (
                    <button
                      key={shape.id}
                      aria-label={`Select ${shape.type}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setSelected({ kind: 'shape', id: shape.id })}
                      className={`absolute z-20 ${tool === 'select' ? 'pointer-events-auto' : 'pointer-events-none'} ${selected?.kind === 'shape' && selected.id === shape.id ? 'ring-2 ring-violet-500' : ''}`}
                      style={{
                        left: pct(shape.x, size.width),
                        top: pct(size.height - shape.y - shape.height, size.height),
                        width: pct(shape.width, size.width),
                        height: pct(shape.height, size.height),
                        background: shape.type === 'highlight' ? `${shape.color}55` : 'transparent',
                        border:
                          shape.type === 'rectangle'
                            ? `${lineWidth}px solid ${shape.color}`
                            : 'none',
                      }}
                    />
                  ))}
                <svg
                  className="pointer-events-none absolute inset-0 z-20 h-full w-full"
                  viewBox={`0 0 ${size.width} ${size.height}`}
                >
                  {history.current.strokes
                    .filter((stroke) => stroke.page === page)
                    .map((stroke) => (
                      <polyline
                        key={stroke.id}
                        points={stroke.points.map((p) => `${p.x},${size.height - p.y}`).join(' ')}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  {gesture?.tool === 'draw' && (
                    <polyline
                      points={gesture.points.map((p) => `${p.x},${size.height - p.y}`).join(' ')}
                      fill="none"
                      stroke={ink}
                      strokeWidth={lineWidth}
                      strokeLinecap="round"
                    />
                  )}
                  {gesture && gesture.tool !== 'draw' && (
                    <rect
                      x={Math.min(gesture.start.x, gesture.current.x)}
                      y={size.height - Math.max(gesture.start.y, gesture.current.y)}
                      width={Math.abs(gesture.current.x - gesture.start.x)}
                      height={Math.abs(gesture.current.y - gesture.start.y)}
                      fill={gesture.tool === 'highlight' ? ink : 'transparent'}
                      fillOpacity=".3"
                      stroke={gesture.tool === 'rectangle' ? ink : 'none'}
                      strokeWidth={lineWidth}
                    />
                  )}
                </svg>
              </div>
            )}
          </Document>
        </section>
        <aside className="border-t border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0d111a] xl:border-l xl:border-t-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
            Properties
          </h2>
          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">Color</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-white/10">
                <input
                  type="color"
                  value={selectedStyle?.color ?? ink}
                  onChange={(event) => {
                    if (selectedStyle) updateSelectedTextStyle({ color: event.target.value });
                    else setInk(event.target.value);
                  }}
                  className="h-9 w-12"
                />
                <span className="font-mono text-sm uppercase text-slate-500">
                  {selectedStyle?.color ?? ink}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Font size</label>
              <input
                type="number"
                min="6"
                max="96"
                value={Math.round(selectedStyle?.size ?? fontSize)}
                onChange={(event) => {
                  const value = Math.min(96, Math.max(6, Number(event.target.value) || 6));
                  if (selectedStyle) updateSelectedTextStyle({ size: value });
                  else setFontSize(value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
              />
            </div>
            {(tool === 'draw' || tool === 'rectangle') && (
              <div>
                <label className="mb-2 flex justify-between text-sm font-semibold">
                  <span>Stroke width</span>
                  <span>{lineWidth}px</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-full accent-violet-600"
                />
              </div>
            )}
            {selected ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
                <p className="text-xs font-black uppercase tracking-wider text-violet-600">
                  Selected {selected.kind}
                </p>
                {selectedValue !== undefined && (
                  <textarea
                    key={`${selected.kind}-${selected.id}-${selectedValue}`}
                    defaultValue={selectedValue}
                    rows={3}
                    onBlur={(e) => commitText(selected, e.currentTarget.value)}
                    className="mt-3 w-full rounded-xl border border-violet-200 bg-white p-2.5 text-sm text-slate-950"
                  />
                )}
                <button
                  onClick={removeSelected}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="font-semibold">
                  {TOOLS.find((entry) => entry.id === tool)?.label} tool
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {TOOLS.find((entry) => entry.id === tool)?.hint}.
                </p>
              </div>
            )}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <p className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4" />
                Private editing
              </p>
              <p className="mt-1 opacity-80">Your source PDF stays in this browser.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
