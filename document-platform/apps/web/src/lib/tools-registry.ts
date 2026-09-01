import {
  FileText,
  ScanText,
  Globe,
  FileType,
  Code,
  FileCode,
  Image,
  Edit3,
  LucideIcon,
} from 'lucide-react';

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

export const TOOL_PRESENTATION_MAP: Record<string, ToolPresentation> = {
  'pdf-to-docx': {
    slug: 'pdf-to-docx',
    name: 'PDF to Word Converter',
    icon: FileText,
    badge: 'Most Popular',
    gradient: 'from-blue-500/20 via-indigo-500/20 to-violet-500/20',
    accentColor: '#4f46e5',
    features: [
      'Editable PDF text and OCR content conversion into Word DOCX',
      'Creates an editable DOCX from extracted text',
      'Batch conversion support for Pro & Business plans',
      'Fast client & cloud worker execution',
    ],
    steps: [
      { step: 1, title: 'Upload PDF', desc: 'Select or drag & drop your PDF file up to your plan limit.' },
      { step: 2, title: 'Select Options', desc: 'Configure OCR extraction mode or page formatting.' },
      { step: 3, title: 'Download DOCX', desc: 'Get your editable Microsoft Word document instantly.' },
    ],
    faq: [
      {
        q: 'How does the PDF to Word converter work?',
        a: 'The converter extracts readable text, uses English OCR when a scan has no text layer, and creates an editable Microsoft Word document.',
      },
      {
        q: 'Is my uploaded document private and secure?',
        a: 'Yes. Files are encrypted, processed in isolated worker containers, and automatically purged based on retention policies.',
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
      { step: 2, title: 'Process OCR', desc: 'Our engine identifies characters and structured text.' },
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
      { step: 2, title: 'Capture Page', desc: 'Chromium loads the public page, its scripts, fonts, and print styles.' },
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
      { step: 2, title: 'Analyze Content', desc: 'The engine extracts readable body text and structure.' },
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
      { step: 1, title: 'Paste or Upload HTML', desc: 'Input your HTML/CSS code or upload an HTML file.' },
      { step: 2, title: 'Preview & Configure', desc: 'Set page dimensions, margins, and background printing.' },
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
      { step: 1, title: 'Input Markdown', desc: 'Write or paste Markdown content or upload a .md file.' },
      { step: 2, title: 'Convert Content', desc: 'The worker parses the Markdown and builds a print-ready document.' },
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
      { step: 2, title: 'Convert', desc: 'The worker fits the image to a PDF page while preserving its aspect ratio.' },
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
      { step: 3, title: 'Export Anywhere', desc: 'Export directly into your preferred file format.' },
    ],
    faq: [
      {
        q: 'Can I save documents to my cloud workspace?',
        a: 'The editor currently exports documents on demand. Persistent collaborative editing is planned, not yet enabled.',
      },
    ],
  },
};

export function getToolPresentation(slug: string): ToolPresentation {
  return (
    TOOL_PRESENTATION_MAP[slug] || {
      slug,
      icon: FileText,
      gradient: 'from-indigo-500/20 via-blue-500/20 to-purple-500/20',
      accentColor: '#6366f1',
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
