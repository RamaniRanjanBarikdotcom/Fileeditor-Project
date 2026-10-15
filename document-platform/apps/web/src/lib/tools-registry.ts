import {
  FileText,
  ScanText,
  Globe,
  FileType,
  Code,
  FileCode,
  Image,
  Edit3,
  Combine,
  Scissors,
  ListFilter,
  Trash2,
  RotateCw,
  Stamp,
  ListOrdered,
  Tags,
  LayoutGrid,
  Shuffle,
  Crop,
  Maximize2,
  Grid2X2,
  AlignVerticalJustifyCenter,
  Hash,
  LockKeyhole,
  FileOutput,
  LucideIcon,
  Bookmark,
  BookmarkPlus,
  Columns2,
  HardDrive,
  TextSearch,
  Eraser,
  FlipHorizontal2,
  ScanLine,
  Minimize2,
  Lock,
  LockOpen,
  Wrench,
  Contrast,
  EyeOff,
  Images,
  Sheet,
  Presentation,
  Archive,
  FileSpreadsheet,
} from 'lucide-react';
import { getToolDefinition } from '@docconv/tool-registry';

export interface ToolPresentation {
  slug: string;
  name: string;
  icon: LucideIcon;
  badge?: string;
  gradient: string;
  accentColor: string;
  features: string[];
  steps: { step: number; title: string; desc: string }[];
  faq: { q: string; a: string }[];
}

/** Compact presentation entry for tools added in the Sejda/iLovePDF parity work. */
function presentation(
  slug: string,
  name: string,
  icon: LucideIcon,
  badge: string,
  features: string[],
  steps: [string, string][],
  faq: { q: string; a: string }[],
): ToolPresentation {
  return {
    slug,
    name,
    icon,
    badge,
    gradient: 'from-indigo-500/20 via-blue-500/20 to-sky-500/20',
    accentColor: '#3e63dd',
    features,
    steps: steps.map(([title, desc], index) => ({ step: index + 1, title, desc })),
    faq,
  };
}

const PRIVATE_FAQ = {
  q: 'Is my file uploaded?',
  a: 'No. This tool runs entirely in your browser, so the file never leaves your device.',
};
const SERVER_FAQ = {
  q: 'What happens to my file?',
  a: 'It is processed by an isolated worker, scanned for malware, and deleted automatically within 10 minutes.',
};

export const TOOL_PRESENTATION_MAP: Record<string, ToolPresentation> = {
  'merge-pdf': {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    icon: Combine,
    badge: 'Private in Browser',
    gradient: 'from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20',
    accentColor: '#6366f1',
    features: [
      'Combine up to 20 PDFs in selection order',
      'Preserve every source page',
      'No server upload',
      'Validated PDF output',
    ],
    steps: [
      { step: 1, title: 'Choose PDFs', desc: 'Select two or more PDFs in the order you want.' },
      {
        step: 2,
        title: 'Merge locally',
        desc: 'Your browser copies every page into one document.',
      },
      { step: 3, title: 'Download', desc: 'Save the combined PDF immediately.' },
    ],
    faq: [{ q: 'Are my PDFs uploaded?', a: 'No. This operation runs entirely in your browser.' }],
  },
  'split-pdf': {
    slug: 'split-pdf',
    name: 'Split PDF',
    icon: Scissors,
    badge: 'Private in Browser',
    gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
    accentColor: '#0284c7',
    features: [
      'Export each page separately',
      'Keep original page dimensions',
      'No server upload',
      'One-click page downloads',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the document to split.' },
      { step: 2, title: 'Split locally', desc: 'Each source page becomes a valid PDF.' },
      { step: 3, title: 'Download pages', desc: 'Download the page files you need.' },
    ],
    faq: [
      {
        q: 'Does splitting reduce quality?',
        a: 'No. Existing PDF pages are copied without rasterizing them.',
      },
    ],
  },
  'extract-pdf-pages': {
    slug: 'extract-pdf-pages',
    name: 'Extract PDF Pages',
    icon: ListFilter,
    badge: 'Select Exact Pages',
    gradient: 'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
    accentColor: '#059669',
    features: [
      'Ranges such as 1-3,5',
      'Ascending deterministic order',
      'No server upload',
      'Original page dimensions',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a PDF up to the local limit.' },
      { step: 2, title: 'Enter pages', desc: 'Use page numbers or comma-separated ranges.' },
      { step: 3, title: 'Download', desc: 'Save one PDF containing only those pages.' },
    ],
    faq: [
      { q: 'How do page ranges work?', a: 'Enter values like 1-3,5,8. Page numbers begin at 1.' },
    ],
  },
  'delete-pdf-pages': {
    slug: 'delete-pdf-pages',
    name: 'Delete PDF Pages',
    icon: Trash2,
    badge: 'Private in Browser',
    gradient: 'from-rose-500/20 via-red-500/20 to-orange-500/20',
    accentColor: '#e11d48',
    features: [
      'Remove exact pages or ranges',
      'Prevents an empty result',
      'No server upload',
      'Keeps remaining pages intact',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the source PDF.' },
      { step: 2, title: 'Mark pages', desc: 'Enter the pages you want removed.' },
      { step: 3, title: 'Download', desc: 'Save the remaining pages as a new PDF.' },
    ],
    faq: [
      {
        q: 'Can I delete every page?',
        a: 'No. The tool safely requires at least one page to remain.',
      },
    ],
  },
  'rotate-pdf': {
    slug: 'rotate-pdf',
    name: 'Rotate PDF',
    icon: RotateCw,
    badge: 'Lossless Page Edit',
    gradient: 'from-amber-500/20 via-orange-500/20 to-red-500/20',
    accentColor: '#d97706',
    features: [
      'Rotate all pages by 90°, 180°, or 270°',
      'Preserve PDF vector content',
      'No server upload',
      'Works with mixed page sizes',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the PDF with sideways pages.' },
      { step: 2, title: 'Choose rotation', desc: 'Apply one rotation to every page.' },
      { step: 3, title: 'Download', desc: 'Save the corrected PDF.' },
    ],
    faq: [
      {
        q: 'Does rotation rasterize pages?',
        a: 'No. It updates page rotation without turning pages into images.',
      },
    ],
  },
  'watermark-pdf': {
    slug: 'watermark-pdf',
    name: 'Watermark PDF',
    icon: Stamp,
    badge: 'Text Watermark',
    gradient: 'from-purple-500/20 via-fuchsia-500/20 to-pink-500/20',
    accentColor: '#a855f7',
    features: [
      'Text watermark on every page',
      'Readable translucent overlay',
      'No server upload',
      'Preserves source content',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the document to mark.' },
      { step: 2, title: 'Enter text', desc: 'Type a concise watermark such as DRAFT.' },
      { step: 3, title: 'Download', desc: 'Save the watermarked copy.' },
    ],
    faq: [{ q: 'Can this remove existing watermarks?', a: 'No. It only adds a new text overlay.' }],
  },
  'number-pdf-pages': {
    slug: 'number-pdf-pages',
    name: 'Add PDF Page Numbers',
    icon: ListOrdered,
    badge: 'Automatic Numbering',
    gradient: 'from-blue-500/20 via-indigo-500/20 to-violet-500/20',
    accentColor: '#4f46e5',
    features: [
      'Number every page automatically',
      'Page X / total format',
      'No server upload',
      'Centered footer placement',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the document.' },
      { step: 2, title: 'Add numbers', desc: 'The browser labels every page.' },
      { step: 3, title: 'Download', desc: 'Save the numbered document.' },
    ],
    faq: [
      {
        q: 'Where are numbers placed?',
        a: 'They are centered near the bottom edge of every page.',
      },
    ],
  },
  'pdf-metadata': {
    slug: 'pdf-metadata',
    name: 'Edit PDF Metadata',
    icon: Tags,
    badge: 'Private Metadata',
    gradient: 'from-teal-500/20 via-emerald-500/20 to-lime-500/20',
    accentColor: '#0d9488',
    features: [
      'Set title, author, and subject',
      'Add comma-separated keywords',
      'No server upload',
      'Updates modification time',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a PDF on your device.' },
      { step: 2, title: 'Enter metadata', desc: 'Fill only the fields you want to set.' },
      { step: 3, title: 'Download', desc: 'Save the updated PDF.' },
    ],
    faq: [
      { q: 'Does metadata change page content?', a: 'No. It changes document properties only.' },
    ],
  },
  'organize-pdf': {
    slug: 'organize-pdf',
    name: 'Organize PDF Pages',
    icon: LayoutGrid,
    badge: 'Reorder & Duplicate',
    gradient: 'from-indigo-500/20 via-blue-500/20 to-cyan-500/20',
    accentColor: '#4f46e5',
    features: [
      'Custom page order',
      'Duplicate pages when needed',
      'Preserve vector content',
      'Private browser processing',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Open the PDF you want to reorganize.' },
      { step: 2, title: 'Set page order', desc: 'Enter page numbers in the exact output order.' },
      { step: 3, title: 'Download', desc: 'Save the newly organized PDF.' },
    ],
    faq: [
      {
        q: 'Can I duplicate a page?',
        a: 'Yes. Repeat its page number in the order, such as 1,2,2,3.',
      },
    ],
  },
  'alternate-mix-pdf': {
    slug: 'alternate-mix-pdf',
    name: 'Alternate & Mix PDF',
    icon: Shuffle,
    badge: 'Interleave Documents',
    gradient: 'from-fuchsia-500/20 via-violet-500/20 to-indigo-500/20',
    accentColor: '#7c3aed',
    features: [
      'Mix two or more PDFs',
      'Round-robin page order',
      'Unequal page counts supported',
      'No server upload',
    ],
    steps: [
      { step: 1, title: 'Choose PDFs', desc: 'Select at least two PDF documents.' },
      {
        step: 2,
        title: 'Alternate pages',
        desc: 'Pages are taken from each document in selection order.',
      },
      { step: 3, title: 'Download', desc: 'Save one combined mixed PDF.' },
    ],
    faq: [
      {
        q: 'What if files have different page counts?',
        a: 'Remaining pages continue in the same round-robin order.',
      },
    ],
  },
  'crop-pdf': {
    slug: 'crop-pdf',
    name: 'Crop PDF',
    icon: Crop,
    badge: 'Trim Margins',
    gradient: 'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
    accentColor: '#059669',
    features: [
      'Independent edge margins',
      'Points-based precision',
      'No rasterization',
      'Applied consistently to all pages',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a PDF with unwanted margins.' },
      { step: 2, title: 'Set margins', desc: 'Enter top, right, bottom, and left trim amounts.' },
      { step: 3, title: 'Download', desc: 'Save the cropped PDF copy.' },
    ],
    faq: [
      {
        q: 'Does cropping delete page content?',
        a: 'It changes the visible crop box without rasterizing the source page.',
      },
    ],
  },
  'resize-pdf': {
    slug: 'resize-pdf',
    name: 'Resize PDF',
    icon: Maximize2,
    badge: 'Page Size & Margins',
    gradient: 'from-blue-500/20 via-sky-500/20 to-cyan-500/20',
    accentColor: '#0284c7',
    features: [
      'A3, A4, A5, Letter, and Legal',
      'Portrait or landscape',
      'Configurable padding',
      'Aspect ratio preserved',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the document to resize.' },
      { step: 2, title: 'Choose paper', desc: 'Set paper size, orientation, and margin.' },
      { step: 3, title: 'Download', desc: 'Save the fitted document.' },
    ],
    faq: [
      { q: 'Will pages be stretched?', a: 'No. Each page is scaled proportionally and centered.' },
    ],
  },
  'n-up-pdf': {
    slug: 'n-up-pdf',
    name: 'N-up PDF',
    icon: Grid2X2,
    badge: 'Print Layout',
    gradient: 'from-amber-500/20 via-orange-500/20 to-rose-500/20',
    accentColor: '#d97706',
    features: [
      'Two or four pages per sheet',
      'Multiple paper sizes',
      'Adjustable gutter',
      'Proportional page scaling',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a document for compact printing.' },
      { step: 2, title: 'Choose layout', desc: 'Set pages per sheet, paper, and spacing.' },
      { step: 3, title: 'Download', desc: 'Save the print-ready N-up PDF.' },
    ],
    faq: [
      {
        q: 'Does N-up modify the source file?',
        a: 'No. It creates a new PDF and leaves the original unchanged.',
      },
    ],
  },
  'header-footer-pdf': {
    slug: 'header-footer-pdf',
    name: 'PDF Header & Footer',
    icon: AlignVerticalJustifyCenter,
    badge: 'Page Labels',
    gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
    accentColor: '#2563eb',
    features: [
      'Independent header and footer text',
      'Current and total page tokens',
      'Centered consistent placement',
      'Private browser processing',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Open the document to label.' },
      { step: 2, title: 'Write labels', desc: 'Add text and optional page-number tokens.' },
      { step: 3, title: 'Download', desc: 'Save the labelled PDF.' },
    ],
    faq: [
      {
        q: 'How do automatic page numbers work?',
        a: 'Use {page} and {pages} anywhere in the header or footer.',
      },
    ],
  },
  'bates-numbering-pdf': {
    slug: 'bates-numbering-pdf',
    name: 'Bates Numbering',
    icon: Hash,
    badge: 'Sequential IDs',
    gradient: 'from-violet-500/20 via-purple-500/20 to-fuchsia-500/20',
    accentColor: '#7c3aed',
    features: [
      'Custom prefix and suffix',
      'Configurable starting number',
      'One identifier per page',
      'Consistent zero padding',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select the document to stamp.' },
      { step: 2, title: 'Configure sequence', desc: 'Choose prefix, start, width, and suffix.' },
      { step: 3, title: 'Download', desc: 'Save the numbered document.' },
    ],
    faq: [
      {
        q: 'Where is the Bates number placed?',
        a: 'It is positioned at the lower-right of every page.',
      },
    ],
  },
  'flatten-pdf-forms': {
    slug: 'flatten-pdf-forms',
    name: 'Flatten PDF Forms',
    icon: LockKeyhole,
    badge: 'Make Fields Read-only',
    gradient: 'from-slate-500/20 via-indigo-500/20 to-blue-500/20',
    accentColor: '#475569',
    features: [
      'Flatten supported AcroForm fields',
      'Preserve visible field values',
      'Create a separate output copy',
      'No server upload',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a PDF containing form fields.' },
      {
        step: 2,
        title: 'Flatten locally',
        desc: 'Field appearances are merged into page content.',
      },
      { step: 3, title: 'Download', desc: 'Save the read-only form copy.' },
    ],
    faq: [
      {
        q: 'Does this remove all annotations?',
        a: 'No. This tool flattens supported AcroForm fields; other annotations are unchanged.',
      },
    ],
  },
  'word-to-pdf': {
    slug: 'word-to-pdf',
    name: 'Word to PDF',
    icon: FileOutput,
    badge: 'LibreOffice Engine',
    gradient: 'from-blue-500/20 via-indigo-500/20 to-violet-500/20',
    accentColor: '#2563eb',
    features: [
      'Convert DOCX documents to PDF',
      'Preserve common Word page layouts',
      'Render fonts available on the worker',
      'Temporary server processing',
    ],
    steps: [
      { step: 1, title: 'Upload DOCX', desc: 'Choose a Microsoft Word document.' },
      {
        step: 2,
        title: 'Render document',
        desc: 'LibreOffice converts the document in an isolated worker.',
      },
      { step: 3, title: 'Download PDF', desc: 'Save the generated PDF.' },
    ],
    faq: [
      {
        q: 'Why can fonts look different?',
        a: 'A document font must also be installed on the conversion worker; otherwise LibreOffice substitutes it.',
      },
    ],
  },
  'pdf-to-docx': {
    slug: 'pdf-to-docx',
    name: 'PDF to Word Converter',
    icon: FileText,
    badge: 'Most Popular',
    gradient: 'from-blue-500/20 via-indigo-500/20 to-violet-500/20',
    accentColor: '#4f46e5',
    features: [
      'Reconstructs PDF page layout in an editable Word DOCX',
      'Preserves text styling, images, columns, and supported tables',
      'Uses OCR text fallback for scanned or image-only documents',
      'Batch conversion support for Pro & Business plans',
      'Secure processing with automatic temporary-file expiry',
    ],
    steps: [
      {
        step: 1,
        title: 'Upload PDF',
        desc: 'Select or drag & drop your PDF file up to your plan limit.',
      },
      {
        step: 2,
        title: 'Select Options',
        desc: 'Configure OCR extraction mode or page formatting.',
      },
      {
        step: 3,
        title: 'Download DOCX',
        desc: 'Get your editable Microsoft Word document instantly.',
      },
    ],
    faq: [
      {
        q: 'How does the PDF to Word converter work?',
        a: 'The converter extracts readable text, uses English OCR when a scan has no text layer, and creates an editable Microsoft Word document.',
      },
      {
        q: 'Is my uploaded document private and secure?',
        a: 'Server jobs use isolated temporary storage and files expire within 10 minutes. Browser-capable tools keep the file on your device.',
      },
    ],
  },
  'pdf-to-markdown': {
    slug: 'pdf-to-markdown',
    name: 'PDF to Markdown Converter',
    icon: FileCode,
    badge: 'Structured Extraction',
    gradient: 'from-sky-500/20 via-cyan-500/20 to-emerald-500/20',
    accentColor: '#0891b2',
    features: [
      'Readable Markdown paragraphs and headings',
      'List normalization and page markers',
      'OCR fallback for scanned PDFs',
      'Temporary isolated server processing',
    ],
    steps: [
      { step: 1, title: 'Upload PDF', desc: 'Choose a digital or scanned PDF document.' },
      {
        step: 2,
        title: 'Extract structure',
        desc: 'Text and OCR content are normalized into Markdown.',
      },
      {
        step: 3,
        title: 'Download Markdown',
        desc: 'Save a clean MD file for docs, notes, or AI workflows.',
      },
    ],
    faq: [
      {
        q: 'Will Markdown preserve the exact PDF layout?',
        a: 'Markdown preserves readable structure rather than fixed page coordinates. Use PDF to Word exact visual mode when appearance is the priority.',
      },
    ],
  },
  'pdf-to-images': {
    slug: 'pdf-to-images',
    name: 'PDF to Image Converter',
    icon: Image,
    badge: 'Universal Font Rendering',
    gradient: 'from-fuchsia-500/20 via-pink-500/20 to-orange-500/20',
    accentColor: '#db2777',
    features: [
      'Export every page as PNG or JPG',
      '96, 150, or print-ready 300 DPI',
      'Embedded, subset, Type 1, CFF, TrueType and OpenType font support',
      'Poppler compatibility renderer with a private browser fallback',
    ],
    steps: [
      { step: 1, title: 'Choose PDF', desc: 'Select a PDF from your device.' },
      {
        step: 2,
        title: 'Choose quality',
        desc: 'Select PNG or JPG, resolution, and the compatibility or private renderer.',
      },
      {
        step: 3,
        title: 'Download pages',
        desc: 'Download a ZIP containing every page in exact numeric order.',
      },
    ],
    faq: [
      {
        q: 'Does image export change the page appearance?',
        a: 'Universal mode uses Poppler to render the PDF itself, including embedded and subset font programs. Private mode uses local PDF glyph paths as a no-upload fallback.',
      },
      {
        q: 'Why is universal compatibility recommended?',
        a: 'It supports more PDF font technologies and malformed font mappings than browser font loading. Password-protected or damaged files may still require unlocking or repair first.',
      },
    ],
  },
  'pdf-ocr': {
    slug: 'pdf-ocr',
    name: 'PDF OCR Text Extractor',
    icon: ScanText,
    badge: 'AI Powered',
    gradient: 'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
    accentColor: '#059669',
    features: [
      'Extract searchable text from scanned paper documents',
      'Download the extracted content as a text file',
      'English OCR for scanned PDF pages',
      'Uses the existing text layer when one is available',
    ],
    steps: [
      { step: 1, title: 'Upload Scanned File', desc: 'Upload scanned PDF or photo documents.' },
      {
        step: 2,
        title: 'Process OCR',
        desc: 'Our engine identifies characters and structured text.',
      },
      { step: 3, title: 'Download Text', desc: 'Download the extracted content as a TXT file.' },
    ],
    faq: [
      {
        q: 'Can this tool read low-resolution scans?',
        a: 'Clear scans work best. Low-resolution or heavily skewed pages can reduce English OCR accuracy.',
      },
    ],
  },
  'url-to-pdf': {
    slug: 'url-to-pdf',
    name: 'URL to PDF Web Capture',
    icon: Globe,
    badge: 'High Precision',
    gradient: 'from-purple-500/20 via-pink-500/20 to-rose-500/20',
    accentColor: '#9333ea',
    features: [
      'Render full webpages into clean, printable PDFs',
      'Executes JavaScript and waits for web fonts and page assets',
      'Uses browser print styles when the website provides them',
      'Runs in an isolated headless Chromium worker',
    ],
    steps: [
      { step: 1, title: 'Enter Web URL', desc: 'Paste the public link of the webpage or article.' },
      {
        step: 2,
        title: 'Capture Page',
        desc: 'Chromium loads the public page, its scripts, fonts, and print styles.',
      },
      { step: 3, title: 'Generate PDF', desc: 'Receive pixel-perfect PDF rendering in seconds.' },
    ],
    faq: [
      {
        q: 'Does it support password-protected or paywalled URLs?',
        a: 'No. The public tool captures pages that can be opened without a login, paywall, CAPTCHA, or private network access.',
      },
    ],
  },
  'url-to-docx': {
    slug: 'url-to-docx',
    name: 'URL to Word Converter',
    icon: FileType,
    badge: 'Smart Extraction',
    gradient: 'from-amber-500/20 via-orange-500/20 to-red-500/20',
    accentColor: '#d97706',
    features: [
      'Extract blog posts, articles, and docs into editable Word format',
      'Extracts readable page text after Chromium finishes rendering',
      'Creates a clean, editable text-focused Word document',
      'Instant download ready for Microsoft Word or Google Docs',
    ],
    steps: [
      { step: 1, title: 'Provide URL', desc: 'Paste any public article or documentation URL.' },
      {
        step: 2,
        title: 'Analyze Content',
        desc: 'The engine extracts readable body text and structure.',
      },
      { step: 3, title: 'Export to Word', desc: 'Download the formatted .docx file immediately.' },
    ],
    faq: [
      {
        q: 'Will images from the webpage be included in the DOCX?',
        a: 'Not currently. URL-to-DOCX is a text-focused export; use URL-to-PDF when visual fidelity is important.',
      },
    ],
  },
  'html-to-pdf': {
    slug: 'html-to-pdf',
    name: 'HTML to PDF Template Engine',
    icon: Code,
    badge: 'Developer Tool',
    gradient: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20',
    accentColor: '#0284c7',
    features: [
      'Render raw HTML/CSS templates into PDF invoices, receipts, and reports',
      'Support for Google Fonts, CSS Grid, Flexbox, and SVG assets',
      'Prints backgrounds and modern browser layouts',
      'Runs in an isolated Chromium rendering worker',
    ],
    steps: [
      {
        step: 1,
        title: 'Paste or Upload HTML',
        desc: 'Input your HTML/CSS code or upload an HTML file.',
      },
      {
        step: 2,
        title: 'Preview & Configure',
        desc: 'Set page dimensions, margins, and background printing.',
      },
      { step: 3, title: 'Render PDF', desc: 'Generate your professional PDF document.' },
    ],
    faq: [
      {
        q: 'Are custom CSS frameworks like Tailwind supported?',
        a: 'Inline and embedded CSS are supported. Remote assets must be publicly reachable by the rendering worker.',
      },
    ],
  },
  'markdown-to-pdf': {
    slug: 'markdown-to-pdf',
    name: 'Markdown to PDF Converter',
    icon: FileCode,
    badge: 'Fast & Clean',
    gradient: 'from-teal-500/20 via-cyan-500/20 to-sky-500/20',
    accentColor: '#0d9488',
    features: [
      'Convert GitHub Flavored Markdown (GFM) into styled PDFs',
      'Supports headings, lists, links, tables, and fenced code blocks',
      'Produces a consistent print-ready layout',
      'Uses the Pandoc conversion worker',
    ],
    steps: [
      {
        step: 1,
        title: 'Input Markdown',
        desc: 'Write or paste Markdown content or upload a .md file.',
      },
      {
        step: 2,
        title: 'Convert Content',
        desc: 'The worker parses the Markdown and builds a print-ready document.',
      },
      { step: 3, title: 'Export PDF', desc: 'Download clean, publication-ready PDF notes.' },
    ],
    faq: [
      {
        q: 'Does it support math formulas and diagrams?',
        a: 'Standard Markdown is supported. LaTeX and Mermaid rendering are not enabled in the current worker.',
      },
    ],
  },
  'image-to-pdf': {
    slug: 'image-to-pdf',
    name: 'Image to PDF Converter',
    icon: Image,
    badge: 'Zero Compression Loss',
    gradient: 'from-pink-500/20 via-rose-500/20 to-red-500/20',
    accentColor: '#db2777',
    features: [
      'Convert one PNG, JPG, or JPEG image into a PDF',
      'Automatic orientation and image aspect ratio fitting',
      'Runs through the isolated image conversion worker',
      'Keeps the original image aspect ratio',
    ],
    steps: [
      { step: 1, title: 'Select Image', desc: 'Upload a PNG, JPG, or JPEG image.' },
      {
        step: 2,
        title: 'Convert',
        desc: 'The worker fits the image to a PDF page while preserving its aspect ratio.',
      },
      { step: 3, title: 'Generate PDF', desc: 'Download the generated PDF.' },
    ],
    faq: [
      {
        q: 'Can I combine several images?',
        a: 'Not in the current release. Each conversion accepts one image; multi-image ordering is planned.',
      },
    ],
  },
  'document-editor': {
    slug: 'document-editor',
    name: 'Online Document Studio',
    icon: Edit3,
    badge: 'Live Studio',
    gradient: 'from-indigo-500/20 via-purple-500/20 to-pink-500/20',
    accentColor: '#6366f1',
    features: [
      'Rich WYSIWYG document studio with live export options',
      'Export current editor content to supported document formats',
      'Distraction-free focus mode and dark/light themes',
      'Private authenticated workspace with conversion history',
    ],
    steps: [
      { step: 1, title: 'Open Studio', desc: 'Start writing or paste existing content.' },
      { step: 2, title: 'Format & Organize', desc: 'Use headings, tables, callouts, and images.' },
      {
        step: 3,
        title: 'Export Anywhere',
        desc: 'Export directly into your preferred file format.',
      },
    ],
    faq: [
      {
        q: 'Can I save documents to my cloud workspace?',
        a: 'The editor currently exports documents on demand. Persistent collaborative editing is planned, not yet enabled.',
      },
    ],
  },
  'pdf-editor': {
    slug: 'pdf-editor',
    name: 'Online PDF Text Editor',
    icon: FileText,
    badge: 'Smart Editing',
    gradient: 'from-blue-500/20 via-indigo-500/20 to-violet-500/20',
    accentColor: '#4f46e5',
    features: [
      'Click selectable PDF text and replace it in place',
      'Change replacement text size, color, bold, and italic styling',
      'Add new text, highlights, shapes, and freehand annotations',
      'Keep the source PDF unchanged and export a new PDF copy',
      'Undo/redo history for safe editing',
    ],
    steps: [
      { step: 1, title: 'Upload PDF', desc: 'Select or drag & drop your PDF file.' },
      {
        step: 2,
        title: 'Edit Content',
        desc: 'Click text to edit, add new elements, or move items.',
      },
      {
        step: 3,
        title: 'Export',
        desc: 'Apply your changes and download a new edited PDF.',
      },
    ],
    faq: [
      {
        q: 'Does editing change the original PDF layout?',
        a: 'The original file is never overwritten. Replacement text is positioned over the existing selectable text area on a new PDF copy.',
      },
      {
        q: 'Can I add new content to my PDF?',
        a: 'Yes. You can add text, highlights, rectangle outlines, and freehand annotations. Image insertion is not yet available.',
      },
      {
        q: 'Why can I not click text in a scanned PDF?',
        a: 'A scanned page is one large image and contains no selectable text objects. Run PDF OCR first, or add a new text box over the scan.',
      },
    ],
  },
  'split-pdf-by-bookmarks': presentation(
    'split-pdf-by-bookmarks',
    'Split PDF by Bookmarks',
    Bookmark,
    'Private in Browser',
    [
      'One PDF per top-level bookmark',
      'Files named after each chapter',
      'Front matter kept as its own file',
    ],
    [
      ['Choose a PDF', 'Use a document that has bookmarks (an outline).'],
      ['Split by chapter', 'Each top-level bookmark starts a new file.'],
      ['Download', 'Save every chapter PDF.'],
    ],
    [
      PRIVATE_FAQ,
      {
        q: 'My PDF has no bookmarks',
        a: 'Use Split PDF with page ranges, or add bookmarks first with Add PDF Bookmarks.',
      },
    ],
  ),
  'split-pdf-in-half': presentation(
    'split-pdf-in-half',
    'Split PDF Pages in Half',
    Columns2,
    'Private in Browser',
    [
      'Cut two-page spreads into single pages',
      'Left/right or top/bottom',
      'Keeps the original quality',
    ],
    [
      ['Choose a PDF', 'Ideal for scanned books and booklets.'],
      ['Pick the cut', 'Down the middle or across the middle.'],
      ['Download', 'Every page becomes two.'],
    ],
    [PRIVATE_FAQ],
  ),
  'split-pdf-by-size': presentation(
    'split-pdf-by-size',
    'Split PDF by File Size',
    HardDrive,
    'Private in Browser',
    [
      'Parts stay below your size limit',
      'Page order is preserved',
      'Great for email attachment limits',
    ],
    [
      ['Choose a PDF', 'Select a large document.'],
      ['Set the limit', 'For example 10 MB per file.'],
      ['Download', 'Save every part.'],
    ],
    [
      PRIVATE_FAQ,
      {
        q: 'Why is one part bigger than the limit?',
        a: 'A single page that is larger than the limit cannot be split further, so it is kept whole in its own file.',
      },
    ],
  ),
  'split-pdf-by-text': presentation(
    'split-pdf-by-text',
    'Split PDF by Text',
    TextSearch,
    'Private in Browser',
    [
      'New file at every page containing your text',
      'Case-sensitive option',
      'Ideal for batches of invoices or statements',
    ],
    [
      ['Choose a PDF', 'Use a PDF with selectable text.'],
      ['Enter the text', 'For example "Invoice number".'],
      ['Download', 'One PDF per section.'],
    ],
    [
      PRIVATE_FAQ,
      {
        q: 'Does it work on scans?',
        a: 'Scanned pages have no text. Run OCR PDF first to make them searchable.',
      },
    ],
  ),
  'remove-pdf-annotations': presentation(
    'remove-pdf-annotations',
    'Remove PDF Annotations',
    Eraser,
    'Private in Browser',
    [
      'Removes comments, highlights, stamps and drawings',
      'Optionally keeps hyperlinks',
      'Form fields stay intact',
    ],
    [
      ['Choose a PDF', 'Select an annotated document.'],
      ['Choose what to keep', 'Keep or remove hyperlinks.'],
      ['Download', 'Save the clean PDF.'],
    ],
    [PRIVATE_FAQ],
  ),
  'flip-pdf': presentation(
    'flip-pdf',
    'Flip PDF Pages',
    FlipHorizontal2,
    'Private in Browser',
    ['Mirror horizontally or vertically', 'All pages or a selection', 'Respects rotated pages'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Pick a direction', 'Horizontal or vertical.'],
      ['Download', 'Save the mirrored PDF.'],
    ],
    [PRIVATE_FAQ],
  ),
  'pdf-bookmarks': presentation(
    'pdf-bookmarks',
    'Add PDF Bookmarks',
    BookmarkPlus,
    'Private in Browser',
    ['Clickable table of contents', 'Opens with the bookmark panel', 'Simple "Title, page" format'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['List bookmarks', 'One per line: Title, page.'],
      ['Download', 'Open it to see the outline.'],
    ],
    [PRIVATE_FAQ],
  ),
  'pdf-to-text': presentation(
    'pdf-to-text',
    'PDF to Text',
    FileText,
    'Private in Browser',
    ['Plain UTF-8 text for every page', 'Page separators included', 'Works in any language'],
    [
      ['Choose a PDF', 'Use a PDF with selectable text.'],
      ['Extract', 'Text is read in your browser.'],
      ['Download', 'Save the .txt file.'],
    ],
    [
      PRIVATE_FAQ,
      {
        q: 'The output is empty',
        a: 'Scanned PDFs contain images, not text. Use OCR PDF to recognise the text first.',
      },
    ],
  ),
  'scan-to-pdf': presentation(
    'scan-to-pdf',
    'Scan to PDF',
    ScanLine,
    'Camera Capture',
    [
      'Photograph pages with your phone camera',
      'Combine many photos into one PDF',
      'Page size and margins',
    ],
    [
      ['Take photos', 'On a phone the camera opens directly.'],
      ['Arrange pages', 'Add as many pages as you need.'],
      ['Download', 'Save one PDF.'],
    ],
    [PRIVATE_FAQ],
  ),
  'compress-pdf': presentation(
    'compress-pdf',
    'Compress PDF',
    Minimize2,
    'Smaller Files',
    [
      'Recommended, extreme or light compression',
      'Downsamples oversized images',
      'Never returns a larger file',
    ],
    [
      ['Choose a PDF', 'Select the document to shrink.'],
      ['Pick a level', 'Balance size and image quality.'],
      ['Download', 'Save the smaller PDF.'],
    ],
    [
      SERVER_FAQ,
      {
        q: 'Will text become blurry?',
        a: 'No. Text and vector graphics are kept sharp; only large images are resampled.',
      },
    ],
  ),
  'protect-pdf': presentation(
    'protect-pdf',
    'Protect PDF',
    Lock,
    'AES-256',
    ['AES-256 encryption', 'Control printing, copying and editing', 'Password never stored'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Set a password', 'Choose what readers may do.'],
      ['Download', 'The PDF now asks for the password.'],
    ],
    [
      SERVER_FAQ,
      {
        q: 'Do you keep my password?',
        a: 'No. It is held in memory only for this job and deleted as soon as it finishes.',
      },
    ],
  ),
  'unlock-pdf': presentation(
    'unlock-pdf',
    'Unlock PDF',
    LockOpen,
    'Remove Password',
    [
      'Removes the open password',
      'Removes printing and copying restrictions',
      'Password never stored',
    ],
    [
      ['Choose a PDF', 'Select the protected document.'],
      ['Enter the password', 'You must know the current password.'],
      ['Download', 'Save the unlocked PDF.'],
    ],
    [
      SERVER_FAQ,
      {
        q: 'Can you unlock a PDF without the password?',
        a: 'No. Unlocking requires the current password; only unlock files you are allowed to open.',
      },
    ],
  ),
  'repair-pdf': presentation(
    'repair-pdf',
    'Repair PDF',
    Wrench,
    'Recovery',
    [
      'Rebuilds broken cross-reference tables',
      'Recovers readable pages',
      'Cleans the file structure',
    ],
    [
      ['Choose a PDF', 'Select the damaged file.'],
      ['Repair', 'The structure is rebuilt.'],
      ['Download', 'Save the repaired PDF.'],
    ],
    [SERVER_FAQ],
  ),
  'grayscale-pdf': presentation(
    'grayscale-pdf',
    'Grayscale PDF',
    Contrast,
    'Print Ready',
    [
      'Converts text, images and graphics',
      'Saves colour ink when printing',
      'Keeps text selectable',
    ],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Convert', 'Colours become shades of grey.'],
      ['Download', 'Save the grayscale PDF.'],
    ],
    [SERVER_FAQ],
  ),
  'ocr-pdf': presentation(
    'ocr-pdf',
    'OCR PDF — Searchable PDF',
    ScanLine,
    'OCR',
    [
      'Invisible text layer over the original scan',
      'Pages look exactly the same',
      'English, Hindi and 8 more languages',
    ],
    [
      ['Choose a scanned PDF', 'Photos or scans of printed text.'],
      ['Pick the language', 'Better accuracy with the right language.'],
      ['Download', 'Search and copy text in any reader.'],
    ],
    [
      SERVER_FAQ,
      {
        q: 'Does it change how the pages look?',
        a: 'No. The recognised text is added invisibly behind the scan.',
      },
    ],
  ),
  'redact-pdf': presentation(
    'redact-pdf',
    'Redact PDF',
    EyeOff,
    'True Redaction',
    [
      'Removes text, not just covers it',
      'Emails, phone and card numbers',
      'Strips hidden metadata',
    ],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Choose what to remove', 'Words, phrases or patterns.'],
      ['Download', 'The redacted text is gone for good.'],
    ],
    [
      SERVER_FAQ,
      {
        q: 'Can redacted text be recovered?',
        a: 'No. Matching text and image pixels are deleted from the file, and metadata is removed.',
      },
    ],
  ),
  'extract-images-from-pdf': presentation(
    'extract-images-from-pdf',
    'Extract Images from PDF',
    Images,
    'Original Quality',
    ['Every embedded picture', 'Original format and resolution', 'Skips tiny icons'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Extract', 'Each image is saved once.'],
      ['Download', 'Get a ZIP of images.'],
    ],
    [SERVER_FAQ],
  ),
  'pdf-to-excel': presentation(
    'pdf-to-excel',
    'PDF to Excel',
    Sheet,
    'Table Detection',
    ['Detects tables on every page', 'One sheet per table', 'Numbers stay numeric'],
    [
      ['Choose a PDF', 'Use a PDF with selectable text.'],
      ['Detect tables', 'Rows and columns are rebuilt.'],
      ['Download', 'Open the workbook in Excel.'],
    ],
    [
      SERVER_FAQ,
      { q: 'Does it work on scans?', a: 'Run OCR PDF first, then convert the searchable PDF.' },
    ],
  ),
  'pdf-to-powerpoint': presentation(
    'pdf-to-powerpoint',
    'PDF to PowerPoint',
    Presentation,
    'Editable Slides',
    ['One slide per page', 'Text stays editable', 'Images and shapes preserved'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Convert', 'Pages become slides.'],
      ['Download', 'Edit in PowerPoint or Keynote.'],
    ],
    [SERVER_FAQ],
  ),
  'pdf-to-pdfa': presentation(
    'pdf-to-pdfa',
    'PDF to PDF/A',
    Archive,
    'ISO 19005',
    ['PDF/A-1b, 2b or 3b', 'Fonts embedded for long-term use', 'Accepted by archives and courts'],
    [
      ['Choose a PDF', 'Select the document.'],
      ['Pick a version', 'PDF/A-2b suits most uses.'],
      ['Download', 'Save the archival PDF.'],
    ],
    [SERVER_FAQ],
  ),
  'powerpoint-to-pdf': presentation(
    'powerpoint-to-pdf',
    'PowerPoint to PDF',
    Presentation,
    'LibreOffice',
    ['One page per slide', 'Fonts and images preserved', 'Share without PowerPoint'],
    [
      ['Choose a PPTX', 'Select the presentation.'],
      ['Convert', 'Slides are rendered to PDF.'],
      ['Download', 'Save the PDF.'],
    ],
    [SERVER_FAQ],
  ),
  'excel-to-pdf': presentation(
    'excel-to-pdf',
    'Excel to PDF',
    FileSpreadsheet,
    'LibreOffice',
    ['Every sheet converted', 'Print areas respected', 'Share without Excel'],
    [
      ['Choose an XLSX', 'Select the workbook.'],
      ['Convert', 'Sheets are rendered to PDF.'],
      ['Download', 'Save the PDF.'],
    ],
    [SERVER_FAQ],
  ),
};

/**
 * One accent per category keeps the catalogue coherent: colour signals what a
 * tool works on (PDF, documents, images, web, code, studio) rather than being
 * a different decoration on every card.
 */
export const CATEGORY_ACCENTS: Record<string, string> = {
  PDF: '#e5484d',
  Document: '#3e63dd',
  Image: '#d97706',
  Web: '#0891b2',
  Developer: '#7c5ce0',
  Studio: '#12a150',
};
const DEFAULT_ACCENT = CATEGORY_ACCENTS.Document;

export function accentForCategory(category?: string): string {
  return (category && CATEGORY_ACCENTS[category]) || DEFAULT_ACCENT;
}

for (const presentation of Object.values(TOOL_PRESENTATION_MAP)) {
  presentation.accentColor = accentForCategory(getToolDefinition(presentation.slug)?.category);
}

export function getToolPresentation(slug: string): ToolPresentation {
  return (
    TOOL_PRESENTATION_MAP[slug] || {
      slug,
      icon: FileText,
      gradient: 'from-indigo-500/20 via-blue-500/20 to-sky-500/20',
      accentColor: accentForCategory(getToolDefinition(slug)?.category),
      features: ['Fast conversion', 'High reliability', 'Cloud & client processing'],
      steps: [
        { step: 1, title: 'Select Input', desc: 'Provide your source file or link.' },
        { step: 2, title: 'Process', desc: 'The engine validates and converts the format.' },
        { step: 3, title: 'Download', desc: 'Get your converted output file.' },
      ],
      faq: [],
    }
  );
}
