# PDF Tools Roadmap — parity with Sejda and iLovePDF

**Status date:** 2026-10-08 · **Catalogue:** 50 tools · **Owner decisions needed:** see §6

This document lists every tool offered by [Sejda](https://www.sejda.com/) and
[iLovePDF](https://www.ilovepdf.com/), compares it with AppToolkitLab, records the audit of the
tools we already ship, and defines how each missing tool is built and in which phase.

## 1. Competitor catalogue (researched 2026-10-08)

| Area | iLovePDF | Sejda |
| --- | --- | --- |
| Organize | Merge, Split, Remove pages, Extract pages, Organize, Scan to PDF | Merge, Alternate & mix, Organize, Extract pages, Split by pages / bookmarks / in half / size / text, Delete pages |
| Optimize | Compress, Repair, OCR | Compress, Deskew, OCR, Repair, Grayscale |
| Convert to PDF | JPG, Word, PowerPoint, Excel, HTML | JPG, Word, HTML |
| Convert from PDF | JPG, Word, PowerPoint, Excel, PDF/A | JPG, Word, Excel, PowerPoint, Text, Extract images |
| Edit | Rotate, Page numbers, Watermark, Crop, Edit PDF, PDF forms | PDF editor, Fill & sign, Create forms, Crop, Header & footer, Page numbers, Bates, Resize, N-up, Flip, Metadata, Bookmarks, Remove annotations, Rename |
| Security | Unlock, Protect, Sign, Redact, Compare | Protect, Unlock, Watermark, Flatten |
| AI | Summarizer, Translate, PDF to Markdown | — |

## 2. Our status per tool

Legend: ✅ shipped and correct · 🔧 shipped but defective/incomplete (fixed in Phase 1) · ➕ to build

| Tool | Status | Engine / approach |
| --- | --- | --- |
| Merge, Alternate & mix, Extract, Delete, Organize, Crop, Resize, Metadata, Bates, Flatten forms | ✅ | Browser · pdf-lib |
| Split | 🔧 only "every page" | Browser · pdf-lib — add ranges, every N pages |
| Rotate | 🔧 ignores page selection | Browser · pdf-lib |
| Watermark | 🔧 crashes on non-Latin text; off-centre/clipped; no opacity/size/position | Browser · pdf-lib + canvas-rendered text for any script |
| Header & footer | 🔧 crashes on non-Latin text | Browser · same text renderer |
| Page numbers | 🔧 no position / start / format options | Browser · pdf-lib |
| N-up | 🔧 2-up on portrait sheet shrinks pages to 47% | Browser · auto landscape for 2-up |
| Image to PDF | 🔧 rejects WebP/GIF | Browser · decode via canvas, embed PNG |
| All browser tools | 🔧 password-protected input shows a raw library error | Clear "unlock first" message |
| PDF OCR text extractor | 🔧 tells customers to "install tesseract"; retries 3× uselessly | Worker · clear, non-retriable error |
| URL to PDF / Word | 🔧 downloads named `pasted-content.*` | Name after the website |
| PDF to Word / Markdown / Images, Word/HTML/Markdown/URL to PDF, URL to Word | ✅ (live audit passed) | Worker · pdf2docx / Pandoc / Poppler / Gotenberg |
| Split by bookmarks, Split in half, Split by size, Split by text | ➕ | Browser · pdf-lib + PDF.js (outline, text) |
| Remove annotations, Flip, Grayscale-lite, Create bookmarks, PDF to Text, Scan to PDF | ➕ | Browser · pdf-lib / PDF.js / camera capture |
| Compress | ➕ | Worker · PyMuPDF image down-sampling + object-stream rewrite |
| Protect / Unlock | ➕ | Worker · PyMuPDF AES-256 encryption / authentication |
| Repair | ➕ | Worker · PyMuPDF reconstruct + clean save |
| Grayscale | ➕ | Worker · PyMuPDF colour conversion |
| OCR to searchable PDF | ➕ | Worker · Poppler render → Tesseract PDF layer → merge |
| Redact | ➕ | Worker · PyMuPDF true redaction (text removed, not covered) by search terms and patterns |
| Extract images | ➕ | Worker · PyMuPDF embedded image export (ZIP) |
| PDF to Excel | ➕ | Worker · PyMuPDF table detection → SheetJS workbook |
| PDF to PowerPoint | ➕ | Worker · LibreOffice Impress PDF import (editable slides) |
| PowerPoint / Excel to PDF | ➕ | Gotenberg · LibreOffice |
| PDF to PDF/A | ➕ | Gotenberg · PDF/A-1b/2b/3b conversion |
| Sign PDF, Fill & create forms, Compare, Edit PDF extensions | ➕ Phase 3 | Interactive page workspace (needs new UI) |
| AI summarizer, Translate PDF, Deskew | ➕ Phase 4 | AI provider key / image processing stack |

## 3. Architecture for new tools

1. **One catalogue.** Every tool is a `TOOL_REGISTRY` entry (`packages/tool-registry`), a
   presentation entry (`apps/web/src/lib/tools-registry.ts`), and a task group
   (`apps/web/src/lib/tool-groups.ts`). A unit test fails if any tool is ungrouped.
2. **Declarative options.** Tool settings are declared once in
   `apps/web/src/lib/tool-options.ts` (field type, label, default, limits) and rendered
   generically, instead of hand-written state per tool.
3. **Browser first.** Anything pdf-lib/PDF.js can do correctly runs in the browser: no upload,
   no quota.
4. **Operation-routed server jobs.** PDF→PDF server operations cannot be routed by file format,
   so jobs carry a validated `pdfOperation`; the worker dispatches it to `PdfOpsAdapter`, which
   runs `apps/worker/scripts/pdf_ops.py` (PyMuPDF, already shipped with pdf2docx) in a subprocess
   with cancellation and timeouts.
5. **Secrets never persist.** Passwords for Protect/Unlock are held in Redis for 30 minutes,
   keyed by job ID, never in `conversion_jobs.settings_json` or the outbox payload, and deleted
   by the worker after use.
6. **Seed derives from the registry.** New server tools are seeded from registry definitions so
   the API and catalogue cannot drift.

## 4. Phases

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Fix every 🔧 defect above; options schema | **Verified 2026-10-08** |
| 2 | Browser additions (split variants, remove annotations, flip, bookmarks, PDF to text, scan to PDF) and worker additions (compress, protect, unlock, repair, grayscale, searchable OCR, redact, extract images, PDF to Excel/PowerPoint, Office to PDF, PDF/A) | **Verified 2026-10-08** — catalogue now 50 tools |
| 3 | Interactive tools: Sign, Fill & create forms, Compare, Edit PDF (images, shapes, links, whiteout) | Planned |
| 4 | AI summarizer and translation (needs `AI_API_KEY`), Deskew | Planned |

## 5. Verification standard

Each tool ships with an automated test that opens the produced file and checks its content
(page count, rotation, text presence/absence, encryption state, table cells), plus a live API run
for server tools. Only then is the tool listed in the catalogue.

## 6. Owner decisions

- **PyMuPDF licence.** PyMuPDF is AGPL-3.0 (commercial licence available from Artifex). It is
  already in production as a dependency of pdf2docx. Operating it as part of a hosted service
  should be reviewed; the worker isolates it behind one script so it can be replaced (pikepdf
  for encryption/repair, pdfplumber for tables) without touching the rest of the system.
- **E-signatures.** Phase 3 "Sign" adds visual signatures. Legally binding signature workflows
  (signer identity, audit trail, certificate signing) are a separate product decision.
- **AI tools** require a production AI provider key and per-request cost controls.

## 7. Verification evidence (Phases 1–2)

- `apps/web/test/pdf-tools.test.mjs` — 12 browser-tool tests: encrypted-input message, split
  ranges / every N / by size / by text / in half, bookmarks round trip (add → split by bookmarks),
  rotate selection, 2-up landscape sheet, stamp options, annotation removal, flip, PDF to text.
- `apps/api/test/pdf-tools.e2e.test.cjs` — live API: compress (smaller), protect (encrypted) /
  unlock (wrong password rejected, encryption removed), redaction (text absent per pdftotext),
  searchable OCR (text present), PDF to Excel / PowerPoint, PowerPoint to PDF round trip, PDF/A
  identification metadata, repair, grayscale, image extraction, Excel to PDF.
- Passwords: absent from `conversion_jobs.settings_json` and `outbox_events`, and Redis secrets
  deleted after each job.
- Real Chrome on the production build: Hindi watermark, Chinese header, page-number position,
  WebP/scan to PDF, split, rotate selection, and compress/protect/redact through the tool pages.
