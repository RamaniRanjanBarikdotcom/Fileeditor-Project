import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../lib/api';
import { UploadCloud, File as FileIcon, CheckCircle, XCircle, Loader2, Download, Sparkles, X, Link } from 'lucide-react';

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
      return [ALL_FORMATS.xlsx];
    case 'html':
    case 'htm':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.md];
    case 'md':
    case 'markdown':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html];
    case 'txt':
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx];
    case 'json':
      return [ALL_FORMATS.xlsx];
    case 'png':
    case 'jpg':
    case 'jpeg':
      return [ALL_FORMATS.pdf];
    default:
      return [ALL_FORMATS.pdf, ALL_FORMATS.docx, ALL_FORMATS.html, ALL_FORMATS.xlsx, ALL_FORMATS.csv];
  }
}

export function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState('pdf');
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState(0);
  const [inputType, setInputType] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);
  const navigate = useNavigate();

  const clearPollInterval = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPollInterval();
    };
  }, []);

  const availableFormats = getAvailableFormats(inputType, file);

  // Keep targetFormat valid
  useEffect(() => {
    if (!availableFormats.some(f => f.value === targetFormat)) {
      if (availableFormats.length > 0) {
        setTargetFormat(availableFormats[0].value);
      }
    }
  }, [inputType, file, targetFormat, availableFormats]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setDownloadUrl(null);
      setError(null);
      setProgress(0);
      clearPollInterval();
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setDownloadUrl(null);
      setError(null);
      setProgress(0);
      clearPollInterval();
    }
  }, []);

  const handleUploadAndConvert = async () => {
    if (inputType === 'file' && !file) return;
    if (inputType === 'url' && !urlInput.trim()) return;

    clearPollInterval();
    setError(null);
    setDownloadUrl(null);
    
    try {
      setStatus('uploading');
      setProgress(15);

      let uploadRes: Response;
      if (inputType === 'url') {
        let cleanUrl = urlInput.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        uploadRes = await fetchWithAuth('/api/v1/files/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: cleanUrl, format: 'url' }),
        });
      } else {
        const formData = new FormData();
        formData.append('file', file!);
        uploadRes = await fetchWithAuth('/api/v1/files/upload', {
          method: 'POST',
          body: formData
        });
      }

      if (uploadRes.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.message || uploadJson.error || 'Failed to upload document');
      }

      const uploadedFileId = uploadJson.data?.id || uploadJson.id;
      if (!uploadedFileId) {
        throw new Error('Upload succeeded but no file ID was returned');
      }
      
      setProgress(40);
      setStatus('converting');

      const convRes = await fetchWithAuth('/api/v1/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sourceFileId: uploadedFileId, targetFormat })
      });

      if (convRes.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const convJson = await convRes.json();
      if (!convRes.ok) {
        throw new Error(convJson.message || convJson.error || 'Failed to start conversion');
      }

      const jobId = convJson.data?.id || convJson.id;
      if (!jobId) {
        throw new Error('Conversion created but no job ID was returned');
      }
      
      // Poll for job completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetchWithAuth(`/api/v1/conversions/${jobId}`);
          if (statusRes.status === 401) {
            clearPollInterval();
            localStorage.removeItem('token');
            navigate('/login');
            return;
          }

          const statusJson = await statusRes.json();
          const job = statusJson.data || statusJson;
          
          if (job.status === 'COMPLETED') {
            clearPollInterval();
            setProgress(100);
            setStatus('complete');

            const dlRes = await fetchWithAuth(`/api/v1/conversions/${jobId}/download-url`, {
              method: 'POST'
            });
            const dlJson = await dlRes.json();
            const url = dlJson.data?.url || dlJson.url;
            if (url) {
              setDownloadUrl(url);
            }
          } else if (job.status === 'FAILED') {
            clearPollInterval();
            setStatus('error');
            setError(job.errorMessage || 'Conversion failed on server');
          } else {
            setProgress(prev => Math.min(prev + 10, 90));
          }
        } catch (pollErr: any) {
          clearPollInterval();
          setStatus('error');
          setError(pollErr.message || 'Lost connection while checking conversion status');
        }
      }, 1500);

    } catch (err: any) {
      clearPollInterval();
      setStatus('error');
      setError(err.message || 'An unexpected error occurred');
    }
  };

  const resetState = () => {
    clearPollInterval();
    setFile(null);
    setUrlInput('');
    setStatus('idle');
    setProgress(0);
    setDownloadUrl(null);
    setError(null);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '14px',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Sparkles style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
              Convert Document
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Upload a document or paste a web URL to transform it with pixel-perfect fidelity.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '28px' }}>
        {/* Left: Upload + Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Input Type Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setInputType('file'); setStatus('idle'); }}
              style={{
                padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                backgroundColor: inputType === 'file' ? 'var(--bg-active)' : 'transparent',
                color: inputType === 'file' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: `1.5px solid ${inputType === 'file' ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <UploadCloud style={{ width: '16px', height: '16px' }} />
              Upload File
            </button>
            <button
              onClick={() => { setInputType('url'); setStatus('idle'); setTargetFormat('pdf'); }}
              style={{
                padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                backgroundColor: inputType === 'url' ? 'var(--bg-active)' : 'transparent',
                color: inputType === 'url' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: `1.5px solid ${inputType === 'url' ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <Link style={{ width: '16px', height: '16px' }} />
              Convert from Web URL
            </button>
          </div>

          {/* Input Area */}
          {inputType === 'file' ? (
            <div
              onClick={() => status === 'idle' && fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? 'var(--border-focus)' : 'var(--border-primary)'}`,
                borderRadius: '20px',
                padding: '48px 32px',
                textAlign: 'center',
                cursor: status === 'idle' ? 'pointer' : 'default',
                backgroundColor: dragActive ? 'var(--bg-active)' : 'var(--bg-card)',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={status !== 'idle'}
              />
              
              {!file ? (
                <>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '20px',
                    background: 'var(--bg-active)', color: 'var(--text-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <UploadCloud style={{ width: '36px', height: '36px' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    Drop your file here
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
                    or click to browse from your computer
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['PDF', 'DOCX', 'XLSX', 'HTML', 'MD', 'CSV', 'TXT', 'JSON', 'PNG', 'JPG'].map(fmt => (
                      <span key={fmt} style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: 600, backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)', letterSpacing: '0.03em',
                      }}>
                        {fmt}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '20px',
                    background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <FileIcon style={{ width: '36px', height: '36px' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    {file.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {status === 'idle' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); resetState(); }}
                      style={{
                        marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '13px', fontWeight: 500, color: 'var(--text-tertiary)',
                        background: 'none', border: 'none', cursor: 'pointer',
                      }}
                    >
                      <X style={{ width: '14px', height: '14px' }} /> Change File
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)',
              borderRadius: '20px', padding: '36px', boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '18px',
                background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 0 20px',
              }}>
                <Link style={{ width: '32px', height: '32px' }} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Convert a Webpage with Chromium
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: '1.6' }}>
                Enter a public webpage link. Chromium runs JavaScript, loads web fonts and background images, then exports PDF or extracts editable Word, HTML, Markdown, or text content.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Webpage Address
                </label>
                <input
                  type="url"
                  placeholder="https://example.com or github.com"
                  className="input-field"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setStatus('idle'); setError(null); }}
                  disabled={status !== 'idle'}
                  style={{ width: '100%', fontSize: '15px' }}
                />
              </div>
            </div>
          )}

          {/* Progress/Status Box */}
          {status !== 'idle' && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)',
              borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {status === 'uploading' && <Loader2 style={{ width: '20px', height: '20px', color: 'var(--text-accent)', animation: 'spin 1s linear infinite' }} />}
                  {status === 'converting' && <Loader2 style={{ width: '20px', height: '20px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />}
                  {status === 'complete' && <CheckCircle style={{ width: '20px', height: '20px', color: '#22c55e' }} />}
                  {status === 'error' && <XCircle style={{ width: '20px', height: '20px', color: '#ef4444' }} />}
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {status === 'uploading' && (inputType === 'url' ? 'Fetching URL metadata...' : 'Uploading document...')}
                    {status === 'converting' && 'Rendering and converting...'}
                    {status === 'complete' && 'Conversion completed successfully!'}
                    {status === 'error' && 'Conversion failed'}
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)' }}>{progress}%</span>
              </div>
              
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%`, background: status === 'error' ? '#ef4444' : undefined }}
                />
              </div>

              {error && (
                <div style={{
                  marginTop: '16px', fontSize: '13px', padding: '14px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 500,
                }}>
                  {error}
                </div>
              )}
              
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{
                    width: '100%', marginTop: '20px',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    textDecoration: 'none'
                  }}
                >
                  <Download style={{ width: '18px', height: '18px' }} />
                  Download Converted File
                </a>
              )}

              {(status === 'complete' || status === 'error') && (
                <button
                  onClick={resetState}
                  style={{
                    width: '100%', marginTop: '12px', padding: '12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)',
                    borderRadius: '10px',
                  }}
                >
                  Convert another document
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Format Picker */}
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-sm)',
          alignSelf: 'start',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-accent)' }}>→</span> Target Format
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableFormats.map(opt => {
              const selected = targetFormat === opt.value;
              const isDisabled = status !== 'idle';
              return (
                <button
                  key={opt.value}
                  onClick={() => !isDisabled && setTargetFormat(opt.value)}
                  disabled={isDisabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    width: '100%', padding: '14px 16px', borderRadius: '14px',
                    border: `2px solid ${selected ? 'var(--border-focus)' : 'var(--border-secondary)'}`,
                    backgroundColor: selected ? 'var(--bg-active)' : 'transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.6 : 1,
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    backgroundColor: opt.bg, color: opt.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800, flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}>
                    {opt.ext.replace('.', '').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{opt.ext}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleUploadAndConvert}
            disabled={(inputType === 'file' && !file) || (inputType === 'url' && !urlInput.trim()) || status !== 'idle'}
            className="btn-primary"
            style={{ width: '100%', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Sparkles style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            Start Conversion
          </button>
        </div>
      </div>
    </div>
  );
}
