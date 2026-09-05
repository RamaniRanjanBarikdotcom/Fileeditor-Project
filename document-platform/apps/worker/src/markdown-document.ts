export const MARKDOWN_PRINT_CSS = `
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { max-width: 900px; margin: 0 auto; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; }
  h1, h2, h3, h4 { color: #0f172a; line-height: 1.2; page-break-after: avoid; }
  h1 { font-size: 28pt; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
  h2 { font-size: 20pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px; }
  h3 { font-size: 15pt; margin-top: 22px; }
  p, li { orphans: 3; widows: 3; }
  a { color: #4f46e5; text-decoration: none; }
  blockquote { margin-left: 0; padding: 8px 16px; color: #475569; border-left: 4px solid #818cf8; background: #f8fafc; }
  code { font-family: "SFMono-Regular", Consolas, monospace; background: #f1f5f9; border-radius: 4px; padding: 2px 4px; }
  pre { overflow-wrap: anywhere; white-space: pre-wrap; background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 14px; page-break-inside: avoid; }
  pre code { color: inherit; background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
  th { background: #eef2ff; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #cbd5e1; margin: 24px 0; }
  @page { size: auto; }
</style>`;

export function styleMarkdownHtml(html: string): string {
  if (html.includes('</head>')) return html.replace('</head>', `${MARKDOWN_PRINT_CSS}</head>`);
  return `<!doctype html><html><head><meta charset="utf-8">${MARKDOWN_PRINT_CSS}</head><body>${html}</body></html>`;
}
