'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Globe,
  FileCheck,
  Download,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  ArrowRight,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { fetchApi } from '../lib/api';
import {
  cancelBrowserProcessing,
  processInBrowserWorker,
} from '../lib/browser-processing-controller';
import Link from 'next/link';

interface Props {
  tool: ToolDto;
}

export function InteractiveToolConverter({ tool }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<'idle' | 'converting' | 'completed' | 'failed'>(
    'idle',
  );
  const [downloadItems, setDownloadItems] = useState<Array<{ url: string; name: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>(tool.outputFormats[0] || 'pdf');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageSelection, setPageSelection] = useState('1');
  const [rotation, setRotation] = useState('90');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [metadata, setMetadata] = useState({ title: '', author: '', subject: '', keywords: '' });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localDownloadRefs = useRef<string[]>([]);

  const isUrlTool = tool.acceptedFormats.includes('url');
  const isBrowserTool = Boolean(tool.operation && tool.capability?.browser.supported);
  const hasServerEngine = Boolean(
    tool.capability?.node.supported || tool.capability?.native.supported,
  );
  const acceptsMultipleFiles = tool.operation === 'pdf.merge' || tool.operation === 'image.toPdf';
  const file = files[0] || null;

  const clearActiveJob = useCallback(() => {
    localStorage.removeItem(`active_job_${tool.slug}`);
    localStorage.removeItem(`active_job_time_${tool.slug}`);
    setActiveJobId(null);
  }, [tool.slug]);

  const startPolling = useCallback(
    (jobId: string, startTime: number) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setActiveJobId(jobId);
      const clientDeadlineMs = isUrlTool ? 330_000 : 270_000;

      // TODO (SSE): Replace polling with Server-Sent Events for push-based updates.
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetchApi<any>(`/tools/jobs/${jobId}`);

          if (statusRes.success && statusRes.data) {
            setProgress(Math.max(60, statusRes.data.progress || 70));

            if (statusRes.data.status === 'COMPLETED') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              clearActiveJob();
              setProgress(100);

              const downloadRes = await fetchApi<{ url: string }>(
                `/tools/jobs/${jobId}/download-url`,
                { method: 'POST' },
              );

              if (!downloadRes.success || !downloadRes.data?.url) {
                setJobStatus('failed');
                setIsUploading(false);
                setErrorMessage(
                  'The conversion finished, but the download link could not be created.',
                );
                return;
              }

              setDownloadItems([
                { url: downloadRes.data.url, name: `converted.${selectedFormat}` },
              ]);
              setJobStatus('completed');
              setIsUploading(false);
              setQuotaRemaining((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
            } else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(statusRes.data.status)) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              clearActiveJob();
              setJobStatus('failed');
              setIsUploading(false);
              setErrorMessage(
                statusRes.data.errorMessage || 'The conversion could not be completed.',
              );
            }
          }

          if (Date.now() - startTime > clientDeadlineMs) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            clearActiveJob();
            setJobStatus('failed');
            setIsUploading(false);
            setErrorMessage(
              'The server did not finish within the allowed time. Please try a smaller input.',
            );
          }
        } catch {
          // ignore fetch errors so polling continues
        }
      }, 1500);
    },
    [clearActiveJob, isUrlTool],
  );

  useEffect(() => {
    async function loadQuota() {
      const res = await fetchApi<{ remaining: number; limit: number }>('/tools/quota/anonymous');
      if (res.success && res.data) setQuotaRemaining(res.data.remaining);
    }
    void loadQuota();

    const storedJobId = localStorage.getItem(`active_job_${tool.slug}`);
    const activeJobStartTime = localStorage.getItem(`active_job_time_${tool.slug}`);
    if (storedJobId && activeJobStartTime) {
      setJobStatus('converting');
      setIsUploading(true);
      setProgress(60);
      startPolling(storedJobId, Number(activeJobStartTime));
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      localDownloadRefs.current.forEach((url) => URL.revokeObjectURL(url));
      localDownloadRefs.current = [];
    };
  }, [startPolling, tool.slug]);

  const handleCancel = async () => {
    if (isBrowserTool && cancelBrowserProcessing()) {
      setIsUploading(false);
      setProgress(0);
      setJobStatus('failed');
      setErrorMessage('The conversion was cancelled.');
      return;
    }
    if (!activeJobId) return;
    await fetchApi(`/tools/jobs/${activeJobId}/cancel`, { method: 'POST' });
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    clearActiveJob();
    setIsUploading(false);
    setProgress(0);
    setJobStatus('failed');
    setErrorMessage('The conversion was cancelled.');
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      setFiles(acceptsMultipleFiles ? Array.from(e.dataTransfer.files) : [e.dataTransfer.files[0]]);
      setErrorMessage(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles(acceptsMultipleFiles ? Array.from(e.target.files) : [e.target.files[0]]);
      setErrorMessage(null);
    }
  };

  const handleStartConversion = async () => {
    setErrorMessage(null);
    setIsUploading(true);
    setProgress(10);
    setJobStatus('converting');

    try {
      const formData = new FormData();
      if (isUrlTool) {
        if (!urlInput || !urlInput.startsWith('http')) {
          throw new Error('Please enter a valid URL beginning with http:// or https://');
        }

        formData.append('url', urlInput);
      } else {
        if (!file) {
          throw new Error('Please select a file to convert');
        }

        if (files.some((item) => item.size > tool.maxFileSizeBytes)) {
          throw new Error(
            `The file exceeds this tool's ${Math.round(tool.maxFileSizeBytes / 1024 / 1024)}MB limit.`,
          );
        }

        formData.append('file', file);
        if (isBrowserTool && tool.operation) {
          const result = await processInBrowserWorker(tool.operation, files, {
            pageSize,
            orientation,
            pages: pageSelection,
            rotation,
            watermarkText,
            ...metadata,
          });
          if (!result.success || !result.blobs?.[0]) {
            throw new Error(result.error?.message || 'Browser processing failed.');
          }
          localDownloadRefs.current.forEach((url) => URL.revokeObjectURL(url));
          const items = result.blobs.map((output) => ({
            url: URL.createObjectURL(output.blob),
            name: output.name,
          }));
          localDownloadRefs.current = items.map((item) => item.url);
          setDownloadItems(items);
          setProgress(100);
          setJobStatus('completed');
          setIsUploading(false);
          return;
        }
      }

      if (!hasServerEngine) {
        throw new Error('This tool has no enabled processing engine in the current deployment.');
      }

      formData.append('targetFormat', selectedFormat);
      formData.append('settings', JSON.stringify({ pageSize, orientation }));
      const convRes = await fetch(`/api/v1/tools/${tool.slug}/execute`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'AppToolkitLabApp' },
        body: formData,
        credentials: 'include',
      });

      const convData = await convRes.json().catch(() => null);
      if (!convData?.success) {
        throw new Error(convData.error?.message || 'Failed to initialize conversion job');
      }

      const jobId = convData.data.id;
      setActiveJobId(jobId);
      setProgress(60);

      const startTime = Date.now();
      localStorage.setItem(`active_job_${tool.slug}`, jobId);
      localStorage.setItem(`active_job_time_${tool.slug}`, startTime.toString());
      startPolling(jobId, startTime);
    } catch (err: any) {
      setIsUploading(false);
      setJobStatus('failed');
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(
        message === 'Failed to fetch' || message.includes('Unexpected end of JSON')
          ? 'The server conversion engine is offline. Start the API and worker, or use a private browser tool.'
          : message,
      );
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    clearActiveJob();
    setFiles([]);
    setUrlInput('');
    setJobStatus('idle');
    setProgress(0);
    setDownloadItems((items) => {
      items.forEach((item) => item.url.startsWith('blob:') && URL.revokeObjectURL(item.url));
      return [];
    });
    localDownloadRefs.current = [];
    setErrorMessage(null);
  };

  return (
    <div
      className="w-full rounded-3xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      {/* Top Banner: Anonymous Quota Meter */}
      <div
        className="px-6 py-3.5 flex items-center justify-between text-xs font-semibold"
        style={{
          backgroundColor: 'var(--bg-muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(99,102,241,0.12)',
              color: 'var(--brand-500)',
            }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            Free Quota:
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isBrowserTool
              ? 'Private processing — no upload or server quota'
              : quotaRemaining !== null
                ? `${quotaRemaining} / 3 daily operations left`
                : 'Server quota unavailable'}
          </span>
        </div>
        <Link
          href="/pricing"
          className="flex items-center gap-1 font-semibold transition-colors"
          style={{ color: 'var(--brand-500)', textDecoration: 'none' }}
        >
          <span>Compare higher monthly limits</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Converter Main Area */}
        {jobStatus === 'completed' ? (
          <div className="text-center py-10 space-y-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              <FileCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Conversion Complete!
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Your file has been processed into{' '}
                <span className="font-bold uppercase" style={{ color: 'var(--brand-500)' }}>
                  {selectedFormat}
                </span>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {downloadItems.map((item, index) => (
                <a
                  key={item.url}
                  href={item.url}
                  download={item.name}
                  className="btn btn-primary btn-md"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloadItems.length > 1 ? `Page ${index + 1}` : 'Download Result'}</span>
                </a>
              ))}
              <button onClick={handleReset} className="btn btn-secondary btn-md">
                <RefreshCw className="w-4 h-4" />
                <span>Convert Another</span>
              </button>
            </div>
          </div>
        ) : jobStatus === 'converting' ? (
          <div className="text-center py-12 space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div
                className="absolute inset-0 rounded-full border-4 animate-spin"
                style={{
                  borderColor: 'var(--border)',
                  borderTopColor: 'var(--brand-500)',
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center font-bold text-xs"
                style={{ color: 'var(--brand-500)' }}
              >
                {progress}%
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Processing Your Document...
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Our high-speed conversion engine is generating your {selectedFormat.toUpperCase()}{' '}
                file.
              </p>
            </div>

            <div className="max-w-md mx-auto progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-sm">
              Cancel conversion
            </button>
          </div>
        ) : (
          <>
            <div
              className="flex items-start gap-3 rounded-2xl p-4 text-sm"
              style={{
                background: isBrowserTool ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${isBrowserTool ? 'rgba(16,185,129,0.22)' : 'rgba(99,102,241,0.22)'}`,
                color: 'var(--text-secondary)',
              }}
            >
              <FileCheck
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: isBrowserTool ? '#10b981' : 'var(--brand-500)' }}
              />
              <p>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {isBrowserTool ? 'Private browser processing.' : 'Temporary server processing.'}
                </strong>{' '}
                {isBrowserTool
                  ? 'Your selected files stay on this device and do not count against server quota.'
                  : 'The input and generated file expire as soon as the workflow permits and no later than 10 minutes.'}
              </p>
            </div>

            {/* Input Selection Box */}
            {isUrlTool ? (
              <div className="space-y-3">
                <label
                  className="block text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Web Page URL to Convert:
                </label>
                <div className="relative">
                  <Globe
                    className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)', pointerEvents: 'none' }}
                  />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/article-or-report"
                    className="input"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept={tool.acceptedFormats.map((f) => `.${f}`).join(',')}
                  multiple={acceptsMultipleFiles}
                />
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl p-8 md:p-10 text-center cursor-pointer transition-all group"
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    border: '2px dashed var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand-500)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-md"
                    style={{
                      backgroundColor: 'rgba(99,102,241,0.15)',
                      color: 'var(--brand-500)',
                      border: '1px solid rgba(99,102,241,0.25)',
                    }}
                  >
                    <Upload className="w-6 h-6" />
                  </div>

                  {file ? (
                    <div>
                      <span
                        className="font-bold text-base block mb-1"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {files.length > 1 ? `${files.length} files selected` : file.name}
                      </span>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {(
                          files.reduce((total, item) => total + item.size, 0) /
                          (1024 * 1024)
                        ).toFixed(2)}{' '}
                        MB total • Click to change
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p
                        className="font-bold text-base mb-1.5"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        Choose {acceptsMultipleFiles ? 'files' : 'a file'} or drag &amp; drop here
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Supported formats:{' '}
                        <span
                          className="font-semibold uppercase"
                          style={{ color: 'var(--brand-500)' }}
                        >
                          {tool.acceptedFormats.join(', ')}
                        </span>{' '}
                        (Up to {Math.round(tool.maxFileSizeBytes / (1024 * 1024))}MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conversion Options */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Output Format:
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="input"
                  style={{ padding: '0.6rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  {tool.outputFormats.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt.toUpperCase()} Document
                    </option>
                  ))}
                </select>
              </div>

              {(tool.operation === 'image.toPdf' ||
                isUrlTool ||
                ['html.toPdf', 'markdown.toPdf'].includes(tool.operation || '')) && (
                <>
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Page Size:
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value as any)}
                      className="input"
                      style={{ padding: '0.6rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600 }}
                    >
                      <option value="A4">A4 (Standard)</option>
                      <option value="Letter">US Letter</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Orientation:
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as any)}
                      className="input"
                      style={{ padding: '0.6rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600 }}
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </>
              )}

              {['pdf.extractPages', 'pdf.deletePages'].includes(tool.operation || '') && (
                <div className="sm:col-span-1 lg:col-span-2">
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Pages (example: 1-3,5)
                  </label>
                  <input
                    className="input"
                    value={pageSelection}
                    onChange={(event) => setPageSelection(event.target.value)}
                    placeholder="1-3,5"
                  />
                </div>
              )}

              {tool.operation === 'pdf.rotate' && (
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Rotation
                  </label>
                  <select
                    className="input"
                    value={rotation}
                    onChange={(event) => setRotation(event.target.value)}
                  >
                    <option value="90">90° clockwise</option>
                    <option value="180">180°</option>
                    <option value="270">270° clockwise</option>
                  </select>
                </div>
              )}

              {tool.operation === 'pdf.watermark' && (
                <div className="sm:col-span-1 lg:col-span-2">
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Watermark text
                  </label>
                  <input
                    className="input"
                    value={watermarkText}
                    maxLength={80}
                    onChange={(event) => setWatermarkText(event.target.value)}
                  />
                </div>
              )}

              {tool.operation === 'pdf.editMetadata' && (
                <div className="grid gap-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-2">
                  {(['title', 'author', 'subject', 'keywords'] as const).map((field) => (
                    <label
                      key={field}
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="mb-1.5 block capitalize">{field}</span>
                      <input
                        className="input"
                        value={metadata[field]}
                        maxLength={field === 'keywords' ? 250 : 120}
                        placeholder={field === 'keywords' ? 'report, finance, 2026' : undefined}
                        onChange={(event) =>
                          setMetadata((current) => ({ ...current, [field]: event.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Notice:</span> {errorMessage}
                </div>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleStartConversion}
              disabled={isUploading || (!file && !urlInput)}
              className="btn btn-primary btn-lg w-full"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.9rem',
                opacity: isUploading || (!file && !urlInput) ? 0.5 : 1,
                cursor: isUploading || (!file && !urlInput) ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Converting Document...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Convert to {selectedFormat.toUpperCase()} Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
