'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  RefreshCw,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { fetchApi, restoreAccessToken } from '../lib/api';
import {
  cancelBrowserProcessing,
  processInBrowserWorker,
} from '../lib/browser-processing-controller';
import { SERVER_POPPLER_REQUIRED } from '../lib/browser-processing-engine';
import Link from 'next/link';

const PdfPageWorkspace = dynamic(
  () => import('./PdfPageWorkspace').then((module) => module.PdfPageWorkspace),
  { ssr: false },
);

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
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [quotaAccessLevel, setQuotaAccessLevel] = useState<'ANONYMOUS' | 'SUBSCRIPTION' | 'ADMIN'>(
    'ANONYMOUS',
  );
  const [quotaUnlimited, setQuotaUnlimited] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>(tool.outputFormats[0] || 'pdf');
  const [pdfFidelityMode, setPdfFidelityMode] = useState<'editable' | 'fixed' | 'visual' | 'ocr'>(
    'fixed',
  );
  const [imageDpi, setImageDpi] = useState('150');
  const [pdfImageEngine, setPdfImageEngine] = useState<'server' | 'browser'>(
    tool.operation === 'pdf.toImages' && tool.capability?.native.supported ? 'server' : 'browser',
  );
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageSelection, setPageSelection] = useState('1');
  const [pageOrder, setPageOrder] = useState('1');
  const [rotation, setRotation] = useState('90');
  const [cropMargins, setCropMargins] = useState({ top: '0', right: '0', bottom: '0', left: '0' });
  const [marginPoints, setMarginPoints] = useState('18');
  const [pagesPerSheet, setPagesPerSheet] = useState('2');
  const [gutterPoints, setGutterPoints] = useState('12');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('Page {page} of {pages}');
  const [bates, setBates] = useState({ prefix: 'APP-', suffix: '', start: '1', padding: '6' });
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
  const useBrowserProcessing = Boolean(
    isBrowserTool &&
    (tool.operation !== 'pdf.toImages' || pdfImageEngine === 'browser' || !hasServerEngine),
  );
  const acceptsMultipleFiles = ['pdf.merge', 'pdf.alternateMix', 'image.toPdf'].includes(
    tool.operation || '',
  );
  const file = files[0] || null;

  const clearActiveJob = useCallback(() => {
    localStorage.removeItem(`active_job_${tool.slug}`);
    localStorage.removeItem(`active_job_time_${tool.slug}`);
    localStorage.removeItem(`active_job_format_${tool.slug}`);
    setActiveJobId(null);
  }, [tool.slug]);

  const startPolling = useCallback(
    (jobId: string, startTime: number, outputFormat: string) => {
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

              const outputName =
                statusRes.data.outputFilename ||
                (tool.operation === 'pdf.toImages'
                  ? `converted-${outputFormat}-pages.zip`
                  : `converted.${outputFormat}`);
              setDownloadItems([{ url: downloadRes.data.url, name: outputName }]);
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
    [clearActiveJob, isUrlTool, tool.operation],
  );

  useEffect(() => {
    async function loadQuota() {
      await restoreAccessToken();
      const res = await fetchApi<{
        remaining: number | null;
        limit: number | null;
        accessLevel?: 'ADMIN' | 'SUBSCRIPTION';
        unlimited?: boolean;
      }>('/tools/quota/anonymous');
      if (res.success && res.data) {
        setQuotaRemaining(res.data.remaining);
        setQuotaLimit(res.data.limit);
        setQuotaAccessLevel(res.data.accessLevel || 'ANONYMOUS');
        setQuotaUnlimited(Boolean(res.data.unlimited));
      }
    }
    void loadQuota();

    const storedJobId = localStorage.getItem(`active_job_${tool.slug}`);
    const activeJobStartTime = localStorage.getItem(`active_job_time_${tool.slug}`);
    const activeJobFormat = localStorage.getItem(`active_job_format_${tool.slug}`);
    if (storedJobId && activeJobStartTime) {
      // Restoring an external localStorage-backed job is intentionally performed after hydration.
      // oxlint-disable-next-line react/set-state-in-effect
      setJobStatus('converting');
      setIsUploading(true);
      setProgress(60);
      startPolling(storedJobId, Number(activeJobStartTime), activeJobFormat || selectedFormat);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      localDownloadRefs.current.forEach((url) => URL.revokeObjectURL(url));
      localDownloadRefs.current = [];
    };
  }, [selectedFormat, startPolling, tool.slug]);

  const handleCancel = async () => {
    if (useBrowserProcessing && cancelBrowserProcessing()) {
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

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setErrorMessage(null);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
        if (useBrowserProcessing && tool.operation) {
          const result = await processInBrowserWorker(tool.operation, files, {
            pageSize,
            orientation,
            pages: pageSelection,
            pageOrder,
            rotation,
            watermarkText,
            cropTop: cropMargins.top,
            cropRight: cropMargins.right,
            cropBottom: cropMargins.bottom,
            cropLeft: cropMargins.left,
            marginPoints,
            pagesPerSheet,
            gutterPoints,
            headerText,
            footerText,
            batesPrefix: bates.prefix,
            batesSuffix: bates.suffix,
            batesStart: bates.start,
            batesPadding: bates.padding,
            ...metadata,
            outputFormat: selectedFormat,
            imageDpi,
          });
          const shouldRetryWithPoppler = Boolean(
            !result.success &&
            hasServerEngine &&
            tool.operation === 'pdf.toImages' &&
            result.error?.message.includes(SERVER_POPPLER_REQUIRED),
          );
          if (!result.success && !shouldRetryWithPoppler) {
            throw new Error(result.error?.message || 'Browser processing failed.');
          }
          if (shouldRetryWithPoppler) {
            setPdfImageEngine('server');
            setProgress(25);
          } else {
            if (!result.blobs?.[0]) throw new Error('Browser processing produced no output.');
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
      }

      if (!hasServerEngine) {
        throw new Error('This tool has no enabled processing engine in the current deployment.');
      }

      formData.append('targetFormat', selectedFormat);
      formData.append(
        'settings',
        JSON.stringify({
          pageSize,
          orientation,
          pdfFidelityMode,
          imageDpi: Number(imageDpi),
          imageFormat: selectedFormat,
        }),
      );
      const convData = await fetchApi<any>(`/tools/${tool.slug}/execute`, {
        method: 'POST',
        body: formData,
      });

      if (!convData.success || !convData.data?.id) {
        throw new Error(
          convData.error?.message ||
            'The conversion service returned an invalid response. Please try again.',
        );
      }

      const jobId = convData.data.id;
      setActiveJobId(jobId);
      setProgress(60);

      const startTime = Date.now();
      localStorage.setItem(`active_job_${tool.slug}`, jobId);
      localStorage.setItem(`active_job_time_${tool.slug}`, startTime.toString());
      localStorage.setItem(`active_job_format_${tool.slug}`, selectedFormat);
      startPolling(jobId, startTime, selectedFormat);
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

  const actionLabel =
    tool.operation === 'pdf.organize'
      ? 'Organize PDF'
      : tool.operation === 'pdf.alternateMix'
        ? 'Mix PDF Pages'
        : tool.operation === 'pdf.crop'
          ? 'Crop PDF'
          : tool.operation === 'pdf.resize'
            ? 'Resize PDF'
            : tool.operation === 'pdf.nUp'
              ? 'Create N-up PDF'
              : tool.operation === 'pdf.headerFooter'
                ? 'Add Header & Footer'
                : tool.operation === 'pdf.batesNumbering'
                  ? 'Apply Bates Numbers'
                  : tool.operation === 'pdf.flattenForms'
                    ? 'Flatten PDF Forms'
                    : `Convert to ${selectedFormat.toUpperCase()} Now`;

  return (
    <div
      className="interactive-converter"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      {/* Top Banner: server-authoritative access and quota meter */}
      <div
        className="converter-quota-bar"
        style={{
          backgroundColor: 'var(--bg-muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="converter-quota-copy">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(99,102,241,0.12)',
              color: 'var(--brand-500)',
            }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            {quotaAccessLevel === 'ADMIN'
              ? 'Admin Access:'
              : quotaAccessLevel === 'SUBSCRIPTION'
                ? 'Plan Access:'
                : 'Free Quota:'}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {useBrowserProcessing
              ? 'Private processing — no upload or server quota'
              : quotaUnlimited
                ? 'Unlimited tool usage — no subscription required'
                : quotaAccessLevel === 'SUBSCRIPTION' && quotaRemaining !== null
                  ? `${quotaRemaining} / ${quotaLimit ?? 0} monthly units left`
                  : quotaRemaining !== null
                    ? `${quotaRemaining} / ${quotaLimit ?? 0} daily operations left`
                    : 'Server quota unavailable'}
          </span>
        </div>
        {!quotaUnlimited && (
          <Link
            href="/pricing"
            className="converter-pricing-link"
            style={{ color: 'var(--brand-500)', textDecoration: 'none' }}
          >
            <span>Compare higher monthly limits</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="converter-body">
        {/* Converter Main Area */}
        {jobStatus === 'completed' ? (
          <div className="converter-result">
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
                Your document is ready
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Processing finished successfully. Your{' '}
                <span className="font-bold uppercase" style={{ color: 'var(--brand-500)' }}>
                  {selectedFormat}
                </span>{' '}
                file is ready to download.
              </p>
            </div>

            <div className="converter-result-files">
              {downloadItems.map((item, index) => (
                <a
                  key={item.url}
                  href={item.url}
                  download={item.name}
                  className="converter-result-file"
                >
                  <span className="converter-result-file-icon">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <strong>{item.name}</strong>
                    <small>
                      {downloadItems.length > 1 ? `Output ${index + 1}` : 'Processed output'}
                    </small>
                  </span>
                  <span className="btn btn-primary btn-sm">
                    <Download className="h-4 w-4" /> Download
                  </span>
                </a>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
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
              className="converter-privacy-note"
              style={{
                background: useBrowserProcessing
                  ? 'rgba(16,185,129,0.08)'
                  : 'rgba(99,102,241,0.08)',
                border: `1px solid ${useBrowserProcessing ? 'rgba(16,185,129,0.22)' : 'rgba(99,102,241,0.22)'}`,
                color: 'var(--text-secondary)',
              }}
            >
              <FileCheck
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: useBrowserProcessing ? '#10b981' : 'var(--brand-500)' }}
              />
              <p>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {useBrowserProcessing
                    ? 'Private browser processing.'
                    : 'Universal server rendering.'}
                </strong>{' '}
                {useBrowserProcessing
                  ? 'Your selected files stay on this device and do not count against server quota.'
                  : tool.operation === 'pdf.toImages'
                    ? 'Poppler renders embedded and subset PDF fonts directly; files expire as soon as the workflow permits and no later than 10 minutes.'
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
                  className="converter-dropzone group"
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
                  <div className="converter-dropzone-content">
                    <div
                      className="converter-dropzone-icon group-hover:scale-110"
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

                {acceptsMultipleFiles && files.length > 0 && (
                  <div className="converter-file-list" aria-label="Selected files">
                    <div className="converter-file-list-heading">
                      <strong>Selected files</strong>
                      <span>Processing follows this order</span>
                    </div>
                    {files.map((selectedFile, index) => (
                      <div
                        className="converter-file-row"
                        key={`${selectedFile.name}-${selectedFile.lastModified}-${index}`}
                      >
                        <span className="converter-file-index">{index + 1}</span>
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="converter-file-copy">
                          <strong>{selectedFile.name}</strong>
                          <small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                        </span>
                        <span className="converter-file-actions">
                          <button
                            type="button"
                            onClick={() => moveFile(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${selectedFile.name} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFile(index, 1)}
                            disabled={index === files.length - 1}
                            aria-label={`Move ${selectedFile.name} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            aria-label={`Remove ${selectedFile.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {file && file.type === 'application/pdf' && files.length === 1 && (
              <PdfPageWorkspace
                key={`${file.name}-${file.size}-${file.lastModified}`}
                file={file}
                operation={tool.operation || ''}
                pageOrder={pageOrder}
                pageSelection={pageSelection}
                onPageOrderChange={setPageOrder}
                onPageSelectionChange={setPageSelection}
              />
            )}

            {/* Conversion Options */}
            <div
              className="converter-options-grid"
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
                      {['png', 'jpg', 'jpeg'].includes(fmt)
                        ? `${fmt.toUpperCase()} Images`
                        : `${fmt.toUpperCase()} Document`}
                    </option>
                  ))}
                </select>
              </div>

              {tool.operation === 'pdf.toDocx' && (
                <div className="sm:col-span-1 lg:col-span-2">
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Word fidelity mode
                  </label>
                  <select
                    value={pdfFidelityMode}
                    onChange={(event) =>
                      setPdfFidelityMode(
                        event.target.value as 'editable' | 'fixed' | 'visual' | 'ocr',
                      )
                    }
                    className="input"
                  >
                    <option value="editable">Editable layout — text, images and tables</option>
                    <option value="fixed">Fixed editable — precise positioned text</option>
                    <option value="visual">Exact visual — pixel-matched pages</option>
                    <option value="ocr">OCR mode — scanned or image-based PDFs</option>
                  </select>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Fixed editable mode keeps detected text in individually editable positioned
                    boxes over preserved page artwork. Exact visual mode remains the pixel-perfect
                    fallback, and OCR mode forces optical text recognition for scanned pages.
                  </p>
                </div>
              )}

              {tool.operation === 'pdf.toImages' && (
                <>
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Image resolution
                    </label>
                    <select
                      value={imageDpi}
                      onChange={(event) => setImageDpi(event.target.value)}
                      className="input"
                    >
                      <option value="96">Screen — 96 DPI</option>
                      <option value="150">High quality — 150 DPI</option>
                      <option value="300">Print — 300 DPI</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 lg:col-span-2">
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Rendering engine
                    </label>
                    <select
                      value={pdfImageEngine}
                      onChange={(event) =>
                        setPdfImageEngine(event.target.value as 'server' | 'browser')
                      }
                      className="input"
                    >
                      {hasServerEngine && (
                        <option value="server">
                          Universal compatibility — Poppler (recommended)
                        </option>
                      )}
                      <option value="browser">Private browser — local glyph renderer</option>
                    </select>
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Universal mode provides the broadest embedded, subset, Type 1, CFF, TrueType
                      and OpenType font support. Private mode keeps the file on this device and
                      draws PDF glyph paths when browser fonts cannot be installed.
                    </p>
                  </div>
                </>
              )}

              {(tool.operation === 'image.toPdf' ||
                tool.operation === 'pdf.resize' ||
                tool.operation === 'pdf.nUp' ||
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
                      <option value="A3">A3</option>
                      <option value="A5">A5</option>
                      <option value="Letter">US Letter</option>
                      <option value="Legal">US Legal</option>
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

              {tool.operation === 'pdf.organize' && (
                <div className="sm:col-span-1 lg:col-span-2">
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    New page order
                  </label>
                  <input
                    className="input"
                    value={pageOrder}
                    onChange={(event) => setPageOrder(event.target.value)}
                    placeholder="3,1,2,2"
                  />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Reorder with comma-separated page numbers. Repeat a number to duplicate that
                    page.
                  </p>
                </div>
              )}

              {tool.operation === 'pdf.crop' && (
                <div className="grid gap-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-4">
                  {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                    <label
                      key={side}
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="mb-1.5 block capitalize">{side} margin (pt)</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="720"
                        step="1"
                        value={cropMargins[side]}
                        onChange={(event) =>
                          setCropMargins((current) => ({ ...current, [side]: event.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {tool.operation === 'pdf.resize' && (
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Page margin (pt)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="144"
                    value={marginPoints}
                    onChange={(event) => setMarginPoints(event.target.value)}
                  />
                </div>
              )}

              {tool.operation === 'pdf.nUp' && (
                <>
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Pages per sheet
                    </label>
                    <select
                      className="input"
                      value={pagesPerSheet}
                      onChange={(event) => setPagesPerSheet(event.target.value)}
                    >
                      <option value="2">2 pages</option>
                      <option value="4">4 pages</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Gutter (pt)
                    </label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="72"
                      value={gutterPoints}
                      onChange={(event) => setGutterPoints(event.target.value)}
                    />
                  </div>
                </>
              )}

              {tool.operation === 'pdf.headerFooter' && (
                <div className="grid gap-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-2">
                  <label
                    className="block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="mb-1.5 block">Header text</span>
                    <input
                      className="input"
                      maxLength={120}
                      value={headerText}
                      onChange={(event) => setHeaderText(event.target.value)}
                      placeholder="Confidential report"
                    />
                  </label>
                  <label
                    className="block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="mb-1.5 block">Footer text</span>
                    <input
                      className="input"
                      maxLength={120}
                      value={footerText}
                      onChange={(event) => setFooterText(event.target.value)}
                      placeholder="Page {page} of {pages}"
                    />
                  </label>
                  <p className="text-xs sm:col-span-2" style={{ color: 'var(--text-muted)' }}>
                    Use {'{page}'} for the current page and {'{pages}'} for the total.
                  </p>
                </div>
              )}

              {tool.operation === 'pdf.batesNumbering' && (
                <div className="grid gap-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-4">
                  {(
                    [
                      ['prefix', 'Prefix'],
                      ['suffix', 'Suffix'],
                      ['start', 'Starting number'],
                      ['padding', 'Number width'],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="mb-1.5 block">{label}</span>
                      <input
                        className="input"
                        type={field === 'start' || field === 'padding' ? 'number' : 'text'}
                        min={field === 'padding' ? 1 : 0}
                        max={field === 'padding' ? 12 : undefined}
                        value={bates[field]}
                        onChange={(event) =>
                          setBates((current) => ({ ...current, [field]: event.target.value }))
                        }
                      />
                    </label>
                  ))}
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
                  <span>{actionLabel}</span>
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
