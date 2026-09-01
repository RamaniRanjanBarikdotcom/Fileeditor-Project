'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import Link from 'next/link';

interface Props {
  tool: ToolDto;
}

export function InteractiveToolConverter({ tool }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<'idle' | 'converting' | 'completed' | 'failed'>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>(tool.outputFormats[0] || 'pdf');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUrlTool = tool.acceptedFormats.includes('url');

  useEffect(() => {
    async function loadQuota() {
      const res = await fetchApi<{ remaining: number; limit: number }>('/tools/quota/anonymous');
      if (res.success && res.data) {
        setQuotaRemaining(res.data.remaining);
      }
    }
    loadQuota();
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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

        formData.append('file', file);
      }

      formData.append('targetFormat', selectedFormat);
      formData.append('settings', JSON.stringify({ pageSize, orientation }));
      const convRes = await fetch(`/api/v1/tools/${tool.slug}/execute`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'ToolSuiteApp' },
        body: formData,
        credentials: 'include',
      });

      const convData = await convRes.json();
      if (!convData.success) {
        throw new Error(convData.error?.message || 'Failed to initialize conversion job');
      }

      const jobId = convData.data.id;
      setProgress(60);

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const statusRes = await fetchApi<any>(`/tools/jobs/${jobId}`);

        if (statusRes.success && statusRes.data) {
          setProgress(Math.max(60, statusRes.data.progress || 70));

          if (statusRes.data.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setProgress(100);
            const downloadRes = await fetchApi<{ url: string }>(
              `/tools/jobs/${jobId}/download-url`,
              { method: 'POST' },
            );
            if (!downloadRes.success || !downloadRes.data?.url) {
              setJobStatus('failed');
              setIsUploading(false);
              setErrorMessage('The conversion finished, but the download link could not be created.');
              return;
            }
            setDownloadUrl(downloadRes.data.url);
            setJobStatus('completed');
            setIsUploading(false);
            if (quotaRemaining !== null) {
              setQuotaRemaining(Math.max(0, quotaRemaining - 1));
            }
          } else if (statusRes.data.status === 'FAILED') {
            clearInterval(pollInterval);
            setJobStatus('failed');
            setIsUploading(false);
            setErrorMessage('Conversion failed. The file format or content could not be processed.');
          }
        }

        if (attempts > 30) {
          clearInterval(pollInterval);
          setJobStatus('failed');
          setIsUploading(false);
          setErrorMessage('Conversion timed out. Please try again.');
        }
      }, 1500);
    } catch (err: any) {
      setIsUploading(false);
      setJobStatus('failed');
      setErrorMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const handleReset = () => {
    setFile(null);
    setUrlInput('');
    setJobStatus('idle');
    setProgress(0);
    setDownloadUrl(null);
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
            {quotaRemaining !== null ? `${quotaRemaining} / 3 daily operations left` : 'Checking quota...'}
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
                Your file has been processed into <span className="font-bold uppercase" style={{ color: 'var(--brand-500)' }}>{selectedFormat}</span>.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={downloadUrl || '#'}
                download
                className="btn btn-primary btn-md"
              >
                <Download className="w-4 h-4" />
                <span>Download Result</span>
              </a>
              <button
                onClick={handleReset}
                className="btn btn-secondary btn-md"
              >
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
                Our high-speed conversion engine is generating your {selectedFormat.toUpperCase()} file.
              </p>
            </div>

            <div className="max-w-md mx-auto progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Input Selection Box */}
            {isUrlTool ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
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
                      <span className="font-bold text-base block mb-1" style={{ color: 'var(--text-primary)' }}>
                        {file.name}
                      </span>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Click to change file
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-base mb-1.5" style={{ color: 'var(--text-primary)' }}>
                        Choose a file or drag &amp; drop here
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Supported formats: <span className="font-semibold uppercase" style={{ color: 'var(--brand-500)' }}>{tool.acceptedFormats.join(', ')}</span> (Up to{' '}
                        {Math.round(tool.maxFileSizeBytes / (1024 * 1024))}MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conversion Options */}
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
