'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Type,
  Code,
  Sparkles,
  FileDown,
} from 'lucide-react';
import { fetchWithAuth } from '../../../lib/api';
import { useTheme } from '../../../lib/ThemeContext';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function WorkspaceEditorPage() {
  const [editorMode, setEditorMode] = useState<'richtext' | 'markdown'>('richtext');
  const [markdownContent, setMarkdownContent] = useState('# Title\n\nStart typing your markdown here...');
  const [status, setStatus] = useState<'idle' | 'converting' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const tiptapEditor = useEditor({
    extensions: [StarterKit],
    content: '<h1>Title</h1><p>Start composing your rich document here...</p>',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px] p-8 prose dark:prose-invert max-w-none text-sm',
      },
    },
  });

  const handleExport = async (targetFormat: string = 'pdf') => {
    try {
      setStatus('converting');
      setProgress(15);
      setError(null);

      let content = '';
      let filename = '';
      let mimeType = '';

      if (editorMode === 'richtext') {
        content = tiptapEditor?.getHTML() || '';
        filename = 'document.html';
        mimeType = 'text/html';
      } else {
        content = markdownContent;
        filename = 'document.md';
        mimeType = 'text/markdown';
      }

      const blob = new Blob([content], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, filename);

      const uploadRes = await fetchWithAuth('/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error?.message || 'Failed to upload document');

      const sourceFileId = uploadData.data.id;
      setProgress(45);

      const convRes = await fetchWithAuth('/api/v1/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId,
          targetFormat,
        }),
      });
      const convData = await convRes.json();
      if (!convData.success) throw new Error(convData.error?.message || 'Export failed');

      const jobId = convData.data.id;

      // Poll
      const poll = setInterval(async () => {
        const res = await fetchWithAuth(`/api/v1/conversions/${jobId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setProgress(Math.max(60, data.data.progress || 70));
          if (data.data.status === 'COMPLETED') {
            clearInterval(poll);
            setProgress(100);
            const downloadRes = await fetchWithAuth(`/api/v1/conversions/${jobId}/download-url`, {
              method: 'POST',
            });
            const downloadData = await downloadRes.json();
            if (!downloadData.success || !downloadData.data?.url) {
              setStatus('error');
              setError('Export completed, but the download link could not be created.');
              return;
            }
            setDownloadUrl(downloadData.data.url);
            setStatus('complete');
          } else if (data.data.status === 'FAILED') {
            clearInterval(poll);
            setStatus('error');
            setError('Export conversion failed.');
          }
        }
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'An error occurred during export.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setEditorMode('richtext')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              editorMode === 'richtext'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Rich Text (WYSIWYG)</span>
          </button>
          <button
            onClick={() => setEditorMode('markdown')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              editorMode === 'markdown'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Markdown Source</span>
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          {status === 'complete' && downloadUrl ? (
            <a
              href={downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </a>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={status === 'converting'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
              <button
                onClick={() => handleExport('docx')}
                disabled={status === 'converting'}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                <span>Export DOCX</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-xl text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Editor Body */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[550px]">
        {editorMode === 'richtext' ? (
          <EditorContent editor={tiptapEditor} />
        ) : (
          <MonacoEditor
            height="550px"
            language="markdown"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={markdownContent}
            onChange={(val) => setMarkdownContent(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
            }}
          />
        )}
      </div>
    </div>
  );
}
