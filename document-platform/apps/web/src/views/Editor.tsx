import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import MonacoEditor from '@monaco-editor/react';
import { Save, Download, Loader2, CheckCircle, XCircle, Type, Code, FileDown, Sparkles } from 'lucide-react';
import { fetchWithAuth } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';

export function Editor() {
  const [editorMode, setEditorMode] = useState<'richtext' | 'markdown'>('richtext');
  const [markdownContent, setMarkdownContent] = useState('# Hello World\n\nStart typing your markdown here...');
  const [status, setStatus] = useState<'idle' | 'converting' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const tiptapEditor = useEditor({
    extensions: [StarterKit],
    content: '<h1>Hello World</h1><p>Start typing your rich text here...</p>',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px] p-8',
      },
    },
  });

  const handleConvert = async (targetFormat: string = 'pdf') => {
    try {
      setStatus('converting');
      setProgress(10);

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
      const file = new File([blob], filename, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetchWithAuth('/api/v1/files/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || uploadData.error || 'Upload failed');
      const uploadedFileId = uploadData.data?.id || uploadData.id;
      if (!uploadedFileId) throw new Error('No uploaded file ID returned');
      
      setProgress(40);

      const convRes = await fetchWithAuth('/api/v1/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sourceFileId: uploadedFileId, targetFormat })
      });
      const convData = await convRes.json();
      if (!convRes.ok) throw new Error(convData.message || convData.error || 'Failed to start conversion');
      
      const jobId = convData.data?.id || convData.id;
      if (!jobId) throw new Error('No conversion job ID returned');

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetchWithAuth(`/api/v1/conversions/${jobId}`);
          const statusData = await statusRes.json();
          const job = statusData.data || statusData;
          
          if (job.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setProgress(100);
            setStatus('complete');
            const dlRes = await fetchWithAuth(`/api/v1/conversions/${jobId}/download-url`, {
              method: 'POST'
            });
            const dlData = await dlRes.json();
            const url = dlData.data?.url || dlData.url;
            if (url) setDownloadUrl(url);
          } else if (job.status === 'FAILED') {
            clearInterval(pollInterval);
            setStatus('error');
            setError(job.errorMessage || 'Conversion failed');
          } else {
            setProgress(prev => Math.min(prev + 5, 90));
          }
        } catch {
          clearInterval(pollInterval);
          setStatus('error');
          setError('Lost connection to server');
        }
      }, 2000);

    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto h-[calc(100vh-8rem)] flex flex-col gap-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Type className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Document Editor
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Write directly and export to any format
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div 
          className="flex items-center p-1 rounded-xl gap-1"
          style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
        >
          <button
            onClick={() => setEditorMode('richtext')}
            className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: editorMode === 'richtext' ? 'var(--bg-card)' : 'transparent',
              color: editorMode === 'richtext' ? 'var(--text-accent)' : 'var(--text-tertiary)',
              boxShadow: editorMode === 'richtext' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Type className="w-4 h-4 mr-2" />
            Rich Text
          </button>
          <button
            onClick={() => setEditorMode('markdown')}
            className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: editorMode === 'markdown' ? 'var(--bg-card)' : 'transparent',
              color: editorMode === 'markdown' ? 'var(--text-accent)' : 'var(--text-tertiary)',
              boxShadow: editorMode === 'markdown' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Code className="w-4 h-4 mr-2" />
            Markdown
          </button>
        </div>
      </div>

      {/* Editor + Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Editor Panel */}
        <div 
          className="lg:col-span-3 glass-card overflow-hidden flex flex-col"
          style={{ borderRadius: 'var(--radius-xl)' }}
        >
          <div className="flex-1 overflow-y-auto">
            {editorMode === 'richtext' ? (
              <EditorContent 
                editor={tiptapEditor} 
                style={{ 
                  height: '100%', 
                  backgroundColor: 'var(--bg-card)', 
                  color: 'var(--text-primary)' 
                }} 
              />
            ) : (
              <MonacoEditor
                height="100%"
                language="markdown"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={markdownContent}
                onChange={(value) => setMarkdownContent(value || '')}
                options={{ 
                  minimap: { enabled: false }, 
                  wordWrap: 'on', 
                  padding: { top: 16 },
                  fontSize: 14,
                  lineHeight: 24,
                  fontFamily: "'Inter', monospace",
                  scrollBeyondLastLine: false,
                }}
              />
            )}
          </div>
        </div>

        {/* Export Panel */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <FileDown className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
              Export & Convert
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => handleConvert('pdf')}
                disabled={status === 'converting'}
                className="btn-primary w-full"
              >
                {status === 'converting' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Export to PDF
              </button>
              <button
                onClick={() => handleConvert('docx')}
                disabled={status === 'converting'}
                className="btn-secondary w-full"
              >
                {status === 'converting' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Export to Word
              </button>
            </div>

            {/* Status */}
            {status !== 'idle' && (
              <div className="mt-5 pt-5 fade-in" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {status === 'converting' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-accent)' }} />}
                    {status === 'complete' && <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />}
                    {status === 'error' && <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />}
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {status === 'converting' ? 'Processing...' : status === 'complete' ? 'Done!' : 'Failed'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {progress}%
                  </span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${progress}%`,
                      background: status === 'error' ? '#ef4444' : undefined
                    }}
                  />
                </div>

                {error && (
                  <p 
                    className="mt-3 text-xs p-3 rounded-lg font-medium"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  >
                    {error}
                  </p>
                )}

                {downloadUrl && (
                  <a 
                    href={downloadUrl}
                    download
                    className="mt-4 flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors"
                    style={{ 
                      background: 'rgba(34,197,94,0.1)', 
                      color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.2)'
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
