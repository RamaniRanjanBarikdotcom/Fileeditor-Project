// Self-host TinyMCE: copy the package assets into public/tinymce so they are served
// at /tinymce/* (EditBlogPage loads ./tinymce/tinymce.min.js). Mirrors the desktop
// app's scripts/copy-tinymce.js. Runs on postinstall.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'node_modules', 'tinymce');
const dst = path.join(__dirname, '..', 'public', 'tinymce');

if (!fs.existsSync(src)) {
  console.error('TinyMCE source not found:', src);
  process.exit(1);
}

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });

console.log('Copied TinyMCE to', dst);
