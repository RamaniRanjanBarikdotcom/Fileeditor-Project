import { useEffect, useState } from 'react';
import { File, CheckCircle, XCircle, Loader2, Clock, ArrowRight, Search } from 'lucide-react';
import { fetchWithAuth } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function History() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/conversions');
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        const data = await res.json();
        if (res.ok) {
          setJobs(data.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, { bg: string; color: string }> = {
      COMPLETED: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
      FAILED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
      PROCESSING: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
    };
    const s = styles[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
    const Icon = status === 'COMPLETED' ? CheckCircle : status === 'FAILED' ? XCircle : Loader2;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
        fontWeight: 600, background: s.bg, color: s.color,
        textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        <Icon style={{ width: '12px', height: '12px', ...(status === 'PROCESSING' ? { animation: 'spin 1s linear infinite' } : {}) }} />
        {status}
      </span>
    );
  };

  const [search, setSearch] = useState('');

  const handleDownload = async (jobId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/conversions/${jobId}/download-url`, { method: 'POST' });
      const data = await res.json();
      const url = data.data?.url || data.url;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Failed to download file', err);
    }
  };

  const filteredJobs = jobs.filter(j => {
    const name = (j.filename || j.sourceFile?.originalFilename || '').toLowerCase();
    const sf = (j.sourceFormat || '').toLowerCase();
    const tf = (j.targetFormat || '').toLowerCase();
    const q = search.toLowerCase().trim();
    return !q || name.includes(q) || sf.includes(q) || tf.includes(q);
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '14px',
          background: 'var(--gradient-primary)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)',
        }}>
          <Clock style={{ width: '22px', height: '22px', color: 'white' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Conversion History
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            View and manage your past document conversions.
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search style={{
          position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
          width: '16px', height: '16px', color: 'var(--text-tertiary)',
        }} />
        <input
          type="text"
          placeholder="Search by file name or format..."
          className="input-field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '44px' }}
        />
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)',
        borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['File Name', 'Conversion', 'Status', 'Date', 'Action'].map(h => (
                <th key={h} style={{
                  padding: '14px 20px', fontSize: '11px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '64px 20px', textAlign: 'center' }}>
                  <Loader2 style={{ width: '24px', height: '24px', margin: '0 auto 12px', color: 'var(--text-accent)', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Loading history...</p>
                </td>
              </tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '64px 20px', textAlign: 'center' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
                    backgroundColor: 'var(--bg-tertiary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <File style={{ width: '28px', height: '28px', color: 'var(--text-tertiary)' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                    {search ? 'No matching conversions found' : 'No conversions yet'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {search ? 'Try clearing your search query.' : 'Head to the dashboard to start your first conversion.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        backgroundColor: 'var(--bg-tertiary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <File style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {job.filename || job.sourceFile?.originalFilename || 'Document'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '5px', fontSize: '11px',
                        fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                      }}>
                        {job.sourceFormat}
                      </span>
                      <ArrowRight style={{ width: '12px', height: '12px', color: 'var(--text-tertiary)' }} />
                      <span style={{
                        padding: '3px 8px', borderRadius: '5px', fontSize: '11px',
                        fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                        textTransform: 'uppercase',
                      }}>
                        {job.targetFormat}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {job.status === 'COMPLETED' ? (
                      <button
                        onClick={() => handleDownload(job.id)}
                        className="btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--text-accent)' }}
                      >
                        Download
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
