const fs = require('fs');
const path = require('path');

const fileInteractive = path.join(
  __dirname,
  '../apps/web/src/components/InteractiveToolConverter.tsx',
);
let contentInteractive = fs.readFileSync(fileInteractive, 'utf8');

// 1. Add pollIntervalRef
contentInteractive = contentInteractive.replace(
  'const fileInputRef = useRef<HTMLInputElement>(null);',
  `const fileInputRef = useRef<HTMLInputElement>(null);\n  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);`,
);

// 2. Modify useEffect to handle reconnect and define startPolling + handleCancel
const pollingLogic = `
  useEffect(() => {
    async function loadQuota() {
      const res = await fetchApi<{ remaining: number; limit: number }>('/tools/quota/anonymous');
      if (res.success && res.data) {
        setQuotaRemaining(res.data.remaining);
      }
    }
    loadQuota();

    const activeJobId = localStorage.getItem(\`active_job_\${tool.slug}\`);
    const activeJobStartTime = localStorage.getItem(\`active_job_time_\${tool.slug}\`);
    if (activeJobId && activeJobStartTime) {
      setJobStatus('converting');
      setIsUploading(true);
      setProgress(60);
      startPolling(activeJobId, parseInt(activeJobStartTime, 10));
    }
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [tool.slug]);

  const handleCancel = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    localStorage.removeItem(\`active_job_\${tool.slug}\`);
    localStorage.removeItem(\`active_job_time_\${tool.slug}\`);
    handleReset();
  };

  const startPolling = (jobId: string, startTime: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    // TODO (SSE): Replace polling with Server-Sent Events for push-based updates.
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetchApi<any>(\`/tools/jobs/\${jobId}\`);

        if (statusRes.success && statusRes.data) {
          setProgress(Math.max(60, statusRes.data.progress || 70));

          if (statusRes.data.status === 'COMPLETED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            localStorage.removeItem(\`active_job_\${tool.slug}\`);
            localStorage.removeItem(\`active_job_time_\${tool.slug}\`);
            setProgress(100);
            
            const downloadRes = await fetchApi<{ url: string }>(
              \`/tools/jobs/\${jobId}/download-url\`,
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
            setQuotaRemaining(prev => prev !== null ? Math.max(0, prev - 1) : null);
          } else if (statusRes.data.status === 'FAILED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            localStorage.removeItem(\`active_job_\${tool.slug}\`);
            localStorage.removeItem(\`active_job_time_\${tool.slug}\`);
            setJobStatus('failed');
            setIsUploading(false);
            setErrorMessage('Conversion failed. The file format or content could not be processed.');
          }
        }

        if (Date.now() - startTime > 240000) { // 4 minutes
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          localStorage.removeItem(\`active_job_\${tool.slug}\`);
          localStorage.removeItem(\`active_job_time_\${tool.slug}\`);
          setJobStatus('failed');
          setIsUploading(false);
          setErrorMessage('Conversion timed out. Please try again.');
        }
      } catch (e) {
        // ignore fetch errors so polling continues
      }
    }, 1500);
  };
`;
contentInteractive = contentInteractive.replace(
  /useEffect\(\(\) => \{[\s\S]*?loadQuota\(\);\n  \}, \[\]\);/,
  pollingLogic,
);

// 3. Replace the inline interval in handleStartConversion
const oldPollBlock = `      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const statusRes = await fetchApi<any>(\`/tools/jobs/\${jobId}\`);

        if (statusRes.success && statusRes.data) {
          setProgress(Math.max(60, statusRes.data.progress || 70));

          if (statusRes.data.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setProgress(100);
            const downloadRes = await fetchApi<{ url: string }>(
              \`/tools/jobs/\${jobId}/download-url\`,
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
      }, 1500);`;

const newStartPolling = `      const startTime = Date.now();
      localStorage.setItem(\`active_job_\${tool.slug}\`, jobId);
      localStorage.setItem(\`active_job_time_\${tool.slug}\`, startTime.toString());
      startPolling(jobId, startTime);`;

contentInteractive = contentInteractive.replace(oldPollBlock, newStartPolling);

// 4. Update handleReset
contentInteractive = contentInteractive.replace(
  '  const handleReset = () => {\n    setFile(null);',
  `  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    localStorage.removeItem(\`active_job_\${tool.slug}\`);
    localStorage.removeItem(\`active_job_time_\${tool.slug}\`);
    setFile(null);`,
);

// 5. Add Cancel Button to the UI
const cancelButtonHTML = `              {isUploading ? (
                <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Converting... {progress}%</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                    className="btn btn-secondary"
                    style={{ padding: '0.9rem', width: 'auto', backgroundColor: '#e2e8f0', color: '#1e293b' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (`;

contentInteractive = contentInteractive.replace(
  `              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Converting... {progress}%</span>
                </>`,
  cancelButtonHTML,
);

fs.writeFileSync(fileInteractive, contentInteractive);

// Now for app/app/page.tsx
const fileApp = path.join(__dirname, '../apps/web/src/app/app/page.tsx');
let contentApp = fs.readFileSync(fileApp, 'utf8');

// 1. Add pollIntervalRef
contentApp = contentApp.replace(
  '  const fileInputRef = useRef<HTMLInputElement>(null);',
  `  const fileInputRef = useRef<HTMLInputElement>(null);\n  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);`,
);

// 2. Add useEffect and handleCancel and startPolling
const appPollingLogic = `
  useEffect(() => {
    const activeJobId = localStorage.getItem('active_job_workspace');
    const activeJobStartTime = localStorage.getItem('active_job_time_workspace');
    if (activeJobId && activeJobStartTime) {
      setJobId(activeJobId);
      setStatus('converting');
      setProgress(60);
      startPolling(activeJobId, parseInt(activeJobStartTime, 10));
    }
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCancel = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    localStorage.removeItem('active_job_workspace');
    localStorage.removeItem('active_job_time_workspace');
    handleReset();
  };

  const startPolling = (id: string, startTime: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    // TODO (SSE): Replace polling with Server-Sent Events for push-based updates.
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetchWithAuth(\`/api/v1/conversions/\${id}\`);
        const data = await res.json();
        
        if (data.success && data.data) {
          setProgress(Math.max(50, data.data.progress || 60));
          
          if (data.data.status === 'COMPLETED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            localStorage.removeItem('active_job_workspace');
            localStorage.removeItem('active_job_time_workspace');
            setProgress(100);
            
            const downloadRes = await fetchWithAuth(\`/api/v1/conversions/\${id}/download-url\`, {
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
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            localStorage.removeItem('active_job_workspace');
            localStorage.removeItem('active_job_time_workspace');
            setStatus('error');
            setError('Conversion failed. Please try a different document format.');
          }
        }
        
        if (Date.now() - startTime > 240000) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          localStorage.removeItem('active_job_workspace');
          localStorage.removeItem('active_job_time_workspace');
          setStatus('error');
          setError('Conversion timed out. Please try again.');
        }
      } catch (e) {
        // ignore errors to keep polling
      }
    }, 1500);
  };

  const handleConvert = async () => {`;

contentApp = contentApp.replace('  const handleConvert = async () => {', appPollingLogic);

// 3. Replace inline polling in handleConvert
const oldAppPoll = `      // Poll job
      const poll = setInterval(async () => {
        const res = await fetchWithAuth(\`/api/v1/conversions/\${id}\`);
        const data = await res.json();
        if (data.success && data.data) {
          setProgress(Math.max(50, data.data.progress || 60));
          if (data.data.status === 'COMPLETED') {
            clearInterval(poll);
            setProgress(100);
            const downloadRes = await fetchWithAuth(\`/api/v1/conversions/\${id}/download-url\`, {
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
      }, 1500);`;

const newAppPoll = `      // Poll job
      const startTime = Date.now();
      localStorage.setItem('active_job_workspace', id);
      localStorage.setItem('active_job_time_workspace', startTime.toString());
      startPolling(id, startTime);`;

contentApp = contentApp.replace(oldAppPoll, newAppPoll);

// 4. Update handleReset
contentApp = contentApp.replace(
  '  const handleReset = () => {\n    setFile(null);',
  `  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    localStorage.removeItem('active_job_workspace');
    localStorage.removeItem('active_job_time_workspace');
    setFile(null);`,
);

// 5. Add Cancel Button to the UI
const appCancelButton = `              {status === 'converting' ? (
                <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Conversion...</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                    className="px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (`;

contentApp = contentApp.replace(
  `              {status === 'converting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Conversion...</span>
                </>`,
  appCancelButton,
);

fs.writeFileSync(fileApp, contentApp);
console.log('Updated both files successfully.');
