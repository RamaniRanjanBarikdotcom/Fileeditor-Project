import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.cjs', import.meta.url), 'utf8');
const preload = fs.readFileSync(new URL('../src/preload.cjs', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../src/renderer/index.html', import.meta.url), 'utf8');
const required = [
  [main, 'contextIsolation: true'],
  [main, 'sandbox: true'],
  [main, 'nodeIntegration: false'],
  [main, 'safeStorage.encryptString'],
  [main, 'currentLicenseStatus()'],
  [main, 'sanitizeGeneratedHtml'],
  [preload, 'contextBridge.exposeInMainWorld'],
  [html, "object-src 'none'"],
];
for (const [source, marker] of required)
  if (!source.includes(marker)) throw new Error(`Desktop security marker missing: ${marker}`);
if (/loadURL\s*\(\s*['"]https?:/i.test(main))
  throw new Error('Desktop renderer must never load a remote application.');
console.log('Blog Studio Desktop security boundary verified.');
