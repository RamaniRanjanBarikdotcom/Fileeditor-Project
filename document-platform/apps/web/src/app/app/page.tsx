'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '../../lib/api';
import {
  UploadCloud,
  File as FileIcon,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Sparkles,
  X,
  Link as LinkIcon,
  Zap,
} from 'lucide-react';

interface FormatOption {
  value: string;
  label: string;
  ext: string;
  color: string;
  bg: string;
}

const ALL_FORMATS: Record<string, FormatOption> = {
  pdf: { value: 'pdf', label: 'PDF Document', ext: '.pdf', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  docx: { value: 'docx', label: 'Word Document', ext: '.docx', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  html: { value: 'html', label: 'HTML Website', ext: '.html', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  xlsx: { value: 'xlsx', label: 'Excel Spreadsheet', ext: '.xlsx', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  csv: { value: 'csv', label: 'CSV Data', ext: '.csv', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  md: { value: 'markdown', label: 'Markdown File', ext: '.md', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  txt: { value: 'txt', label: 'Plain Text', ext: '.txt', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function getAvailableFormats(inputType: 'file' | 'url', file: File | null): FormatOption[] {
  if (inputType === 'url') {
    return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html, ALL_FORMATS.md, ALL_FORMATS.txt];
  }
  if (!file) {
    return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html, ALL_FORMATS.xlsx, ALL_FORMATS.csv];
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return [ALL_FORMATS.docx, ALL_FORMATS.html, ALL_FORMATS.md, ALL_FORMATS.txt];
    case 'docx':
      return [ALL_FORMATS.pdf, ALL_FORMATS.html, ALL_FORMATS.md];
    case 'xlsx':
      return [ALL_FORMATS.pdf, ALL_FORMATS.csv];
    case 'csv':
      return [ALL_FORMATS.pdf, ALL_FORMATS.xlsx];
    case 'html':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.md];
    case 'md':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html];
    case 'txt':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html];
    case 'png':
    case 'jpg':
    case 'jpeg':
      return [ALL_FORMATS.pdf];
    default:
      return [ALL_FORMATS.pdf];
  }
}

export default function WorkspaceConverterPage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [targetFormat, setTargetFormat] = useState('pdf');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'converting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableFormats = getAvailableFormats(inputType, file);

  useEffect(() => {
    if (availableFormats.length > 0 && !availableFormats.some((f) => f.value === targetFormat)) {
      setTargetFormat(availableFormats[0].value);
    }
  }, [file, inputType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  }, []);

  const handleConvert = async () => {
    setError(null);
    setStatus('uploading');
    setProgress(15);

    try {
      let sourceFileId: string;

      if (inputType === 'url') {
        const blob = new Blob([url], { type: 'text/uri-list' });
        const formData = new FormData();
        formData.append('file', blob, 'webpage.url');

        const uploadRes = await fetchWithAuth('/api/v1/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error?.message || 'Failed to process URL');
        sourceFileId = uploadData.data.id;
      } else {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetchWithAuth('/api/v1/files/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error?.message || 'Failed to upload file');
        sourceFileId = uploadData.data.id;
      }

      setStatus('converting');
      setProgress(40);

      const convRes = await fetchWithAuth('/api/v1/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId,
          targetFormat,
        }),
      });
      const convData = await convRes.json();
      if (!convData.success) throw new Error(convData.error?.message || 'Failed to start conversion');

      const id = convData.data.id;
      setJobId(id);

      // Poll job
      const poll = setInterval(async () => {
        const res = await fetchWithAuth(`/api/v1/conversions/${id}`);
        const data = await res.json();
        if (data.success && data.data) {
          setProgress(Math.max(50, data.data.progress || 60));
          if (data.data.status === 'COMPLETED') {
            clearInterval(poll);
            setProgress(100);
            const downloadRes = await fetchWithAuth(`/api/v1/conversions/${id}/download-url`, {
              method: 'POST',
            });
            const downloadData = await downloadRes.json();
            if (!downloadData.success || !downloadData.data?.url) {
              setStatus('error');
              setError('Conversion completed, but the download link could not be created.');
              return;
            }
            setDownloadUrl(downloadData.data.url);
            setStatus('success');
          } else if (data.data.status === 'FAILED') {
            clearInterval(poll);
            setStatus('error');
            setError('Conversion failed. Please try a different document format.');
          }
        }
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'An error occurred during conversion.');
    }
  };

  const handleReset = () => {
    setFile(null);
    setUrl('');
    setStatus('idle');
    setProgress(0);
    setError(null);
    setJobId(null);
    setDownloadUrl(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Converter</h1>
        <p className="text-xs text-slate-500 mt-1">Universal multi-format conversion pipeline with cloud storage</p>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
        {/* Toggle Mode */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
          <button
            onClick={() => { setInputType('file'); handleReset(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              inputType === 'file'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            File Upload
          </button>
          <button
            onClick={() => { setInputType('url'); handleReset(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              inputType === 'url'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            URL Web Capture
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-10 space-y-4">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Conversion Finished!</h3>
            <p className="text-xs text-slate-500">Your output document is ready for download.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={downloadUrl || '#'}
                download
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Converted File</span>
              </a>
              <button
                onClick={handleReset}
                className="px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                Convert Another
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Input Box */}
            {inputType === 'url' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Webpage URL:
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  className="hidden"
                />
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 p-10 rounded-2xl text-center cursor-pointer transition-all bg-indigo-50/20 dark:bg-indigo-950/20"
                >
                  <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
                  {file ? (
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{file.name}</span>
                      <p className="text-xs text-slate-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        Click or drag document to convert
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, DOCX, XLSX, CSV, HTML, Markdown, Images</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Target Format Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Convert To Format:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {availableFormats.map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setTargetFormat(fmt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetFormat === fmt.value
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{fmt.label}</div>
                    <div className="text-[10px] text-slate-400">{fmt.ext}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-xl text-red-700 text-xs">
                {error}
              </div>
            )}

            {status === 'converting' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Converting document...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={status === 'uploading' || status === 'converting' || (!file && !url)}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {status === 'converting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Conversion...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Conversion</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
