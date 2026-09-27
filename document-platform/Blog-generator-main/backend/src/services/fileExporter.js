// File export — ported from src/main/services/fileExporter.js, but the desktop wrote
// to a chosen directory; on the web we generate bytes in memory and return base64 so
// the frontend adapter can trigger browser downloads. PDF on the desktop used an
// Electron BrowserWindow (printToPDF); on the web we return the styled HTML and the
// adapter opens a print window (the browser's "Save as PDF").

import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import JSZip from 'jszip';
import mime from 'mime-types';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { loadImageBuffer } from './publishService.js';

const md = new MarkdownIt();

const MIME = {
  markdown: 'text/markdown',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'text/html', // returned as printable HTML; the client prints to PDF
  csv: 'text/csv',
  zip: 'application/zip',
};

function looksLikeHtml(content) {
  return /<\w+[^>]*>/.test(content || '');
}

function sanitizeFileName(name) {
  const cleaned = (name || 'blog').replace(/[^a-z0-9-_. ]/gi, '').trim();
  return cleaned ? cleaned.replace(/\s+/g, '-') : 'blog';
}

export function sanitizeExportName(name, fallback = 'item') {
  const cleaned = String(name || '').replace(/[^a-z0-9-_ ]/gi, '').trim();
  return cleaned ? cleaned.replace(/\s+/g, '-').slice(0, 60) : fallback;
}

function htmlToMarkdownish(html) {
  if (!html) return '';
  const $ = cheerio.load(html, { decodeEntities: true });
  const lines = [];

  function processInlineContent(node) {
    let result = '';
    $(node).contents().each((_, child) => {
      if (child.type === 'text') {
        result += child.data || '';
      } else {
        const tag = child.tagName || child.name || '';
        if (tag === 'strong' || tag === 'b') result += `**${processInlineContent(child)}**`;
        else if (tag === 'em' || tag === 'i') result += `*${processInlineContent(child)}*`;
        else if (tag === 'code') result += `\`${$(child).text()}\``;
        else if (tag === 'a') result += `[${processInlineContent(child)}](${$(child).attr('href') || ''})`;
        else if (tag === 'img') result += `![${$(child).attr('alt') || 'image'}](${$(child).attr('src') || ''})`;
        else if (tag === 'br') result += '\n';
        else result += processInlineContent(child);
      }
    });
    return result;
  }

  function processTable(tableNode) {
    const rows = [];
    const $table = $(tableNode);
    $table.find('tr').each((rowIdx, tr) => {
      const cells = [];
      $(tr).find('th, td').each((_, cell) => cells.push(processInlineContent(cell).trim().replace(/\|/g, '\\|')));
      if (cells.length > 0) {
        rows.push(`| ${cells.join(' | ')} |`);
        if ($(tr).find('th').length > 0 && rowIdx === 0) rows.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    });
    if (rows.length > 0 && !rows[1]?.startsWith('| ---')) {
      const colCount = (rows[0].match(/\|/g) || []).length - 1;
      if (colCount > 0) rows.splice(1, 0, `| ${Array(colCount).fill('---').join(' | ')} |`);
    }
    return rows.join('\n');
  }

  function walk(node) {
    const tag = node.tagName || node.name || '';
    if (tag === 'script' || tag === 'style') return;
    if (/^h[1-6]$/.test(tag)) {
      const content = processInlineContent(node).trim();
      if (content) {
        lines.push(`${'#'.repeat(parseInt(tag[1], 10))} ${content}`, '');
      }
      return;
    }
    if (tag === 'p') {
      const content = processInlineContent(node).trim();
      if (content) lines.push(content, '');
      return;
    }
    if (tag === 'blockquote') {
      const content = processInlineContent(node).trim();
      lines.push(content.split('\n').map((l) => `> ${l}`).join('\n'), '');
      return;
    }
    if (tag === 'ul') {
      $(node).children('li').each((_, li) => lines.push(`- ${processInlineContent(li).trim()}`));
      lines.push('');
      return;
    }
    if (tag === 'ol') {
      $(node).children('li').each((idx, li) => lines.push(`${idx + 1}. ${processInlineContent(li).trim()}`));
      lines.push('');
      return;
    }
    if (tag === 'hr') {
      lines.push('---', '');
      return;
    }
    if (tag === 'pre') {
      const codeNode = $(node).find('code');
      lines.push('```', codeNode.length ? codeNode.text() : $(node).text(), '```', '');
      return;
    }
    if (tag === 'img') {
      lines.push(`![${$(node).attr('alt') || 'image'}](${$(node).attr('src') || ''})`, '');
      return;
    }
    if (tag === 'table') {
      const t = processTable(node);
      if (t) lines.push(t, '');
      return;
    }
    if (tag === 'br') {
      lines.push('');
      return;
    }
    $(node).contents().each((_, child) => walk(child));
  }

  const $body = $('body');
  if ($body.length) $body.contents().each((_, child) => walk(child));
  else $.root().contents().each((_, child) => walk(child));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildHtmlDocument(blog) {
  const content = blog.content || '';
  const body = looksLikeHtml(content) ? content : md.render(content);
  const title = blog.title || 'Blog';
  const description = blog.metaDescription || blog.meta_description || '';
  const hasH1 = /<h1\b[^>]*>/i.test(body);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${description ? `<meta name="description" content="${description}" />` : ''}
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #1f2937; }
      h1, h2, h3 { color: #111827; }
      img { max-width: 100%; }
      hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
      table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
      th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
      th { background-color: #f3f4f6; font-weight: 600; }
      tr:nth-child(even) { background-color: #f9fafb; }
      blockquote { border-left: 4px solid #3b82f6; margin: 1.5em 0; padding: 0.5em 1em; background-color: #f8fafc; font-style: italic; }
      ul, ol { margin: 1em 0; padding-left: 2em; }
      li { margin: 0.5em 0; }
      code { background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
      pre { background-color: #1f2937; color: #f9fafb; padding: 1em; border-radius: 8px; overflow-x: auto; }
      pre code { background: none; padding: 0; }
    </style>
  </head>
  <body>
    ${hasH1 ? '' : `<h1>${title}</h1>`}
    ${description ? `<p><em>${description}</em></p><hr />` : ''}
    ${body}
  </body>
</html>`;
}

function buildMarkdownDocument(blog) {
  const title = blog.title || 'Blog';
  const description = blog.metaDescription || blog.meta_description || '';
  let content = blog.content || '';
  if (looksLikeHtml(content)) content = htmlToMarkdownish(content);
  const hasH1 = /^#\s+/.test(content.trim());
  const parts = [];
  if (!hasH1) parts.push(`# ${title}`, '');
  if (description) parts.push(`*${description}*`, '', '---', '');
  parts.push(content);
  return parts.join('\n').trim();
}

function markdownToDocxParagraphs(markdown) {
  const source = looksLikeHtml(markdown) ? htmlToMarkdownish(markdown) : markdown || '';
  return source.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return new Paragraph('');
    if (trimmed.startsWith('### ')) return new Paragraph({ text: trimmed.replace(/^###\s+/, ''), heading: HeadingLevel.HEADING_3 });
    if (trimmed.startsWith('## ')) return new Paragraph({ text: trimmed.replace(/^##\s+/, ''), heading: HeadingLevel.HEADING_2 });
    if (trimmed.startsWith('# ')) return new Paragraph({ text: trimmed.replace(/^#\s+/, ''), heading: HeadingLevel.HEADING_1 });
    return new Paragraph({ children: [new TextRun(trimmed)] });
  });
}

async function docxBase64(blog) {
  const paragraphs = [
    new Paragraph({ text: blog.title || 'Blog', heading: HeadingLevel.TITLE }),
    ...(blog.metaDescription || blog.meta_description
      ? [new Paragraph({ children: [new TextRun({ text: blog.metaDescription || blog.meta_description, italics: true })] })]
      : []),
    ...markdownToDocxParagraphs(blog.content),
  ];
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer).toString('base64');
}

const b64 = (str) => Buffer.from(str, 'utf8').toString('base64');

/**
 * Generate the requested formats for one blog.
 * Returns [{ name, mime, base64, format }]. The 'pdf' entry is printable HTML.
 */
export async function generateBlogFiles(blog, formats = ['markdown']) {
  const base = sanitizeFileName(blog.title);
  const out = [];
  for (const format of formats) {
    if (format === 'markdown') out.push({ name: `${base}.md`, mime: MIME.markdown, base64: b64(buildMarkdownDocument(blog)), format });
    else if (format === 'html') out.push({ name: `${base}.html`, mime: MIME.html, base64: b64(buildHtmlDocument(blog)), format });
    else if (format === 'docx') out.push({ name: `${base}.docx`, mime: MIME.docx, base64: await docxBase64(blog), format });
    else if (format === 'pdf') out.push({ name: `${base}.pdf`, mime: MIME.pdf, base64: b64(buildHtmlDocument(blog)), format: 'pdf' });
  }
  return out;
}

/** Bulk export → a single ZIP (base64). PDF is not supported for bulk (browser print is per-document). */
export async function generateBulkZip(blogs, format) {
  if (format === 'pdf') throw new Error('Bulk PDF export is not supported on the web — export individually, or choose Markdown/HTML/DOCX.');
  const zip = new JSZip();
  const used = new Map();
  for (const blog of blogs) {
    const [file] = await generateBlogFiles(blog, [format]);
    if (!file) continue;
    let name = file.name;
    const count = used.get(name) || 0;
    used.set(name, count + 1);
    if (count > 0) name = name.replace(/(\.[^.]+)$/, `-${count}$1`);
    zip.file(name, Buffer.from(file.base64, 'base64'));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { name: `blogs-${format}.zip`, mime: MIME.zip, base64: buffer.toString('base64') };
}

/** History CSV (base64). Mirrors the desktop columns. */
export function generateHistoryCsv(rows = []) {
  const header = ['Title', 'Language', 'Words', 'SEO Score', 'Cost', 'Generated At'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      `"${String(row.title || '').replace(/"/g, '""')}"`,
      `"${row.language || ''}"`,
      row.wordCount || 0,
      typeof row.seoScore === 'number' ? row.seoScore : '',
      typeof row.cost === 'number' ? row.cost.toFixed(2) : '',
      `"${row.generatedAt || ''}"`,
    ].join(','));
  }
  return { name: 'blog-history.csv', mime: MIME.csv, base64: b64(lines.join('\n')) };
}

function blogImageSources(blog) {
  const sources = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (s && !sources.includes(s)) sources.push(s);
  };
  push(blog.imageUrl || blog.image_url);
  const gallery = Array.isArray(blog.imageGallery) ? blog.imageGallery : Array.isArray(blog.image_gallery) ? blog.image_gallery : [];
  gallery.forEach(push);
  return sources;
}

/** Zip all images across the given blogs (one folder per blog). Returns { base64, stats }. */
export async function generateHistoryImagesZip(blogs = []) {
  const zip = new JSZip();
  let images = 0;
  let failedImages = 0;
  for (let i = 0; i < blogs.length; i += 1) {
    const blog = blogs[i] || {};
    const blogId = String(blog.id || blog._id || `blog-${i + 1}`);
    const folder = `${String(i + 1).padStart(2, '0')}-${sanitizeExportName(blog.title, `blog-${i + 1}`)}-${blogId.slice(-6)}`;
    const sources = blogImageSources(blog);
    for (let j = 0; j < sources.length; j += 1) {
      try {
        const loaded = await loadImageBuffer({ imageUrl: sources[j], localImagePath: '' });
        const ext = (mime.extension(loaded.mimeType) || 'png').replace(/^jpeg$/, 'jpg');
        zip.file(`${folder}/image-${String(j + 1).padStart(2, '0')}.${ext}`, loaded.buffer);
        images += 1;
      } catch {
        failedImages += 1;
      }
    }
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return { name: `history-images-${stamp}.zip`, mime: MIME.zip, base64: buffer.toString('base64'), stats: { blogs: blogs.length, images, failedImages } };
}
