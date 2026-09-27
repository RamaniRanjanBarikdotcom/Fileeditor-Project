// IMPORTANT: import the apiClient FIRST. Importing it for its side effect installs
// window.electronAPI (backed by HTTP + WebSocket) before any component runs, so the
// copied renderer code calls `window.electronAPI.*` exactly as it did under Electron.
import './apiClient/index.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
