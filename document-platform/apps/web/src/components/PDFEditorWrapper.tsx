'use client';

import dynamic from 'next/dynamic';

const PDFEditor = dynamic(() => import('../app/tools/pdf-editor/page'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">Loading PDF Editor...</p>
      </div>
    </div>
  ),
});

export default PDFEditor;
