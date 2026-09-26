'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import {
  ArrowLeft,
  Bold,
  Download,
  FileCode2,
  FileText,
  Heading2,
  Heading3,
  Italic,
  List,
  RefreshCw,
  Save,
  Sparkles,
  Undo2,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Image as ImageIcon,
  Send,
} from 'lucide-react';
import { fetchApi } from '../../../../lib/api';
import { useFeatureFlags } from '../../../../lib/use-feature-flags';

type Blog = {
  id: string;
  title: string;
  topic: string;
  html: string;
  editorJson: Record<string, unknown>;
  metadataJson: { seoTitle?: string; metaDescription?: string };
  keywords: string[];
  seoScore: number;
  wordCount: number;
  version: number;
  language: string;
  sources: Array<{ id: string; title: string; url: string }>;
};

export default function BlogEditorPage() {
  const flags = useFeatureFlags();
  const { blogId } = useParams<{ blogId: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [title, setTitle] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>(
    'idle',
  );
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const [destinations, setDestinations] = useState<Array<{ id: string; label: string; type: string }>>([]);
  const [destinationId, setDestinationId] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<{ id: string; url: string } | null>(null);
  const [remoteBusy, setRemoteBusy] = useState('');
  const loaded = useRef(false);
  const dirty = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '<p>Loading article…</p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[720px] max-w-none px-7 py-8 text-[16px] leading-8 text-slate-800 outline-none dark:text-slate-100 sm:px-12 sm:py-11 [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-black [&_h2]:mb-4 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-black [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-bold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:my-6 [&_td]:border [&_td]:border-slate-200 [&_td]:dark:border-slate-700 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:dark:border-slate-700 [&_th]:p-2 [&_th]:bg-slate-50 [&_th]:dark:bg-slate-800/50 [&_th]:font-bold [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-6',
      },
    },
    onUpdate: () => {
      if (loaded.current) {
        dirty.current = true;
        setSaveState('idle');
      }
    },
  });

  const load = useCallback(async () => {
    const response = await fetchApi<Blog>(`/blog-studio/blogs/${blogId}`);
    if (!response.success || !response.data) {
      setError(response.error?.message || 'The article could not be loaded.');
      return;
    }
    setBlog(response.data);
    setTitle(response.data.title);
    editor?.commands.setContent(response.data.html);
    loaded.current = true;
    dirty.current = false;
  }, [blogId, editor]);

  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [editor, load]);

  useEffect(() => {
    if (!flags.blogStudioPublishing) return;
    void fetchApi<Array<{ id: string; label: string; type: string }>>('/blog-studio/destinations').then((response) => {
      if (response.success && response.data) {
        setDestinations(response.data);
        setDestinationId((current) => current || response.data?.[0]?.id || '');
      }
    });
  }, [flags.blogStudioPublishing]);

  const save = useCallback(async () => {
    if (!blog || !editor || (!dirty.current && title === blog.title)) return;
    setSaveState('saving');
    const response = await fetchApi<Blog>(`/blog-studio/blogs/${blog.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        version: blog.version,
        title,
        html: editor.getHTML(),
        editorJson: editor.getJSON(),
        metadata: blog.metadataJson,
        keywords: blog.keywords,
      }),
    });
    if (!response.success || !response.data) {
      const conflict = response.error?.message?.toLowerCase().includes('another session');
      setSaveState(conflict ? 'conflict' : 'error');
      setError(response.error?.message || 'Autosave failed.');
      return;
    }
    setBlog(response.data);
    dirty.current = false;
    setSaveState('saved');
  }, [blog, editor, title]);

  useEffect(() => {
    const timer = setInterval(() => void save(), 5000);
    return () => clearInterval(timer);
  }, [save]);

  async function exportBlog(format: 'markdown' | 'html' | 'docx' | 'pdf') {
    if (!blog) return;
    await save();
    setExporting(format);
    setError('');
    const response = await fetchApi<{ status: string; url?: string; conversionId?: string }>(
      `/blog-studio/blogs/${blog.id}/exports`,
      { method: 'POST', body: JSON.stringify({ format }) },
    );
    setExporting('');
    if (!response.success || !response.data) {
      setError(response.error?.message || 'Export failed.');
      return;
    }
    if (response.data.url) window.location.assign(response.data.url);
    else if (response.data.conversionId)
      setError(
        `${format.toUpperCase()} export is processing in the document queue. Open conversion history to download it when complete.`,
      );
  }

  async function regenerate() {
    if (
      !blog ||
      !confirm(
        'Create a new version from this article topic? Your current article will remain unchanged.',
      )
    )
      return;
    const response = await fetchApi<{ id: string }>(`/blog-studio/blogs/${blog.id}/regenerate`, {
      method: 'POST',
    });
    if (!response.success)
      setError(response.error?.message || 'Regeneration could not be started.');
    else setError('A new generation has been queued. You can monitor it from Blog Studio.');
  }

  async function generateImage() {
    if (!blog || !editor || !imagePrompt.trim()) return;
    setRemoteBusy('image'); setError('');
    const response = await fetchApi<{ id: string; url: string }>(`/blog-studio/blogs/${blog.id}/images`, { method: 'POST', body: JSON.stringify({ prompt: imagePrompt, width: 1200, height: 630 }) });
    setRemoteBusy('');
    if (!response.success || !response.data) return setError(response.error?.message || 'Image generation failed.');
    const featured = await fetchApi(`/blog-studio/blogs/${blog.id}/images/${response.data.id}/featured`, { method: 'POST' });
    if (!featured.success) return setError(featured.error?.message || 'The image was generated but could not be selected as the cover.');
    setGeneratedImage(response.data);
    setImagePrompt('');
    setError('Cover image generated and saved in the private media gallery.');
  }

  async function publish() {
    if (!blog || !destinationId) return;
    await save(); setRemoteBusy('publish'); setError('');
    const response = await fetchApi(`/blog-studio/blogs/${blog.id}/publish`, { method: 'POST', body: JSON.stringify({ destinationId, publishedAs: 'draft' }) });
    setRemoteBusy(''); setError(response.success ? 'Draft published successfully. Open Published Posts to view the remote URL.' : response.error?.message || 'Publishing failed.');
  }

  if (error && !blog)
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </div>
    );
  if (!blog || !editor)
    return (
      <div className="mx-auto max-w-3xl py-20 text-center text-sm text-slate-500">
        Opening the Blog Studio editor…
      </div>
    );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app/blog-studio"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                dirty.current = true;
                setSaveState('idle');
              }}
              className="w-full truncate bg-transparent text-xl font-black text-slate-950 outline-none dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              {blog.wordCount.toLocaleString()} words · {blog.language} · SEO {blog.seoScore} ·{' '}
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : saveState === 'conflict'
                    ? 'Conflict detected'
                    : 'Autosave on'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void save()} className="studio-action">
            <Save className="h-4 w-4" />
            Save
          </button>
          <button onClick={regenerate} className="studio-action">
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </button>
          {(['markdown', 'html', 'docx', 'pdf'] as const).map((format) => (
            <button
              key={format}
              onClick={() => exportBlog(format)}
              disabled={Boolean(exporting)}
              className="studio-action"
            >
              <Download className="h-4 w-4" />
              {exporting === format ? 'Preparing…' : format.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      {error && (
        <div
          className={`rounded-xl border p-3 text-sm font-semibold ${saveState === 'conflict' || saveState === 'error' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'}`}
        >
          {error}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 p-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-slate-700">
              <Tool
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
                icon={Bold}
                label="Bold"
              />
              <Tool
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                icon={Italic}
                label="Italic"
              />
              <Tool
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                icon={UnderlineIcon}
                label="Underline"
              />
            </div>
            
            <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700">
              <Tool
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                icon={Heading2}
                label="Heading 2"
              />
              <Tool
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                icon={Heading3}
                label="Heading 3"
              />
            </div>

            <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700">
              <Tool
                active={editor.isActive({ textAlign: 'left' })}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                icon={AlignLeft}
                label="Align Left"
              />
              <Tool
                active={editor.isActive({ textAlign: 'center' })}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                icon={AlignCenter}
                label="Align Center"
              />
              <Tool
                active={editor.isActive({ textAlign: 'right' })}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                icon={AlignRight}
                label="Align Right"
              />
            </div>

            <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700">
              <Tool
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                icon={List}
                label="Bullet List"
              />
            </div>

            <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-slate-700">
              <Tool
                active={editor.isActive('table')}
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                icon={TableIcon}
                label="Insert Table"
              />
              <Tool
                onClick={() => {
                  const url = window.prompt('URL');
                  if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                  }
                }}
                icon={ImageIcon}
                label="Insert Image"
              />
            </div>

            <div className="flex items-center gap-1 pl-2">
              <Tool onClick={() => editor.chain().focus().undo().run()} icon={Undo2} label="Undo" />
            </div>
          </div>
          <EditorContent editor={editor} />
        </section>
        <aside className="space-y-4">
          <Panel title="SEO score" icon={Sparkles}>
            <div className="flex items-end gap-2">
              <strong className="text-4xl text-slate-950 dark:text-white">{blog.seoScore}</strong>
              <span className="pb-1 text-sm text-slate-400">/ 100</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500"
                style={{ width: `${blog.seoScore}%` }}
              />
            </div>
          </Panel>
          <Panel title="Search metadata" icon={FileCode2}>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {blog.metadataJson.seoTitle || blog.title}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {blog.metadataJson.metaDescription || 'No meta description returned.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {blog.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </Panel>
          <Panel title={`Sources (${blog.sources.length})`} icon={FileText}>
            {blog.sources.length ? (
              <div className="space-y-3">
                {blog.sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs font-semibold leading-5 text-indigo-500 hover:underline"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                No external source adapter was used for this generation.
              </p>
            )}
          </Panel>
          {flags.blogStudioImages && <Panel title="Generate cover image" icon={ImageIcon}>
            {generatedImage && <img src={generatedImage.url} alt="Generated article cover" className="mb-3 aspect-[1.5] w-full rounded-xl object-cover" />}
            <textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={3} maxLength={1000} placeholder="Describe the cover image…" className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
            <button onClick={generateImage} disabled={!imagePrompt.trim() || remoteBusy === 'image'} className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{remoteBusy === 'image' ? 'Generating…' : 'Generate cover image'}</button>
            <p className="mt-2 text-xs leading-5 text-slate-500">The image is stored privately and selected as this article&apos;s featured image. Gallery links are short-lived and are not embedded into saved article HTML.</p>
          </Panel>}
          {flags.blogStudioPublishing && <Panel title="Publish draft" icon={Send}>
            <select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Choose destination</option>{destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.label} · {destination.type}</option>)}</select>
            <button onClick={publish} disabled={!destinationId || remoteBusy === 'publish'} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{remoteBusy === 'publish' ? 'Publishing…' : 'Send as remote draft'}</button>
          </Panel>}
        </aside>
      </div>
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-lg ${active ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-indigo-500" />
        {title}
      </h2>
      {children}
    </section>
  );
}
