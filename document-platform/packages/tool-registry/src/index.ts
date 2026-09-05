import { CanonicalToolDefinition } from '@docconv/shared-types';

const TEN_MINUTES = 600;
const MB = 1024 * 1024;

export const TOOL_REGISTRY = {
  'merge-pdf': {
    id: 'pdf.merge', slug: 'merge-pdf', operation: 'pdf.merge', category: 'PDF',
    title: 'Merge PDF', description: 'Combine multiple PDF files in your chosen order without uploading them.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.merge', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 20 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.mergePdf',
  },
  'split-pdf': {
    id: 'pdf.split', slug: 'split-pdf', operation: 'pdf.split', category: 'PDF',
    title: 'Split PDF', description: 'Export every PDF page as an individual PDF in your browser.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.split', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.splitPdf',
  },
  'extract-pdf-pages': {
    id: 'pdf.extractPages', slug: 'extract-pdf-pages', operation: 'pdf.extractPages', category: 'PDF',
    title: 'Extract PDF Pages', description: 'Create a new PDF from selected pages such as 1-3,5.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.extractPages', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.extractPdfPages',
  },
  'delete-pdf-pages': {
    id: 'pdf.deletePages', slug: 'delete-pdf-pages', operation: 'pdf.deletePages', category: 'PDF',
    title: 'Delete PDF Pages', description: 'Remove selected pages and download the remaining PDF locally.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.deletePages', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.deletePdfPages',
  },
  'rotate-pdf': {
    id: 'pdf.rotate', slug: 'rotate-pdf', operation: 'pdf.rotate', category: 'PDF',
    title: 'Rotate PDF', description: 'Rotate all pages by 90, 180, or 270 degrees in your browser.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.rotate', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.rotatePdf',
  },
  'watermark-pdf': {
    id: 'pdf.watermark', slug: 'watermark-pdf', operation: 'pdf.watermark', category: 'PDF',
    title: 'Watermark PDF', description: 'Apply a centered text watermark to every PDF page locally.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.watermark', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.watermarkPdf',
  },
  'number-pdf-pages': {
    id: 'pdf.addPageNumbers', slug: 'number-pdf-pages', operation: 'pdf.addPageNumbers', category: 'PDF',
    title: 'Add PDF Page Numbers', description: 'Add readable page numbers to every page without an upload.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.addPageNumbers', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.numberPdfPages',
  },
  'pdf-metadata': {
    id: 'pdf.editMetadata', slug: 'pdf-metadata', operation: 'pdf.editMetadata', category: 'PDF',
    title: 'Edit PDF Metadata', description: 'Set PDF title, author, subject, and keywords privately.',
    inputTypes: ['pdf'], outputTypes: ['pdf'], availability: 'AVAILABLE_LOCAL',
    capability: {
      operation: 'pdf.editMetadata', browser: { supported: true, maxBytes: 30 * MB, maxFiles: 1 },
      node: { supported: false }, native: { supported: false }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES }, featureFlag: 'tool.pdfMetadata',
  },
  'pdf-to-docx': {
    id: 'pdf.toDocx', slug: 'pdf-to-docx', operation: 'pdf.toDocx', category: 'Document',
    title: 'PDF to Word Converter',
    description: 'Extract editable text from digital or scanned PDFs into DOCX.',
    inputTypes: ['pdf'], outputTypes: ['docx'], availability: 'BETA',
    capability: {
      operation: 'pdf.toDocx',
      browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 10 * MB, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.pdfToDocx',
  },
  'pdf-ocr': {
    id: 'pdf.ocr', slug: 'pdf-ocr', operation: 'pdf.ocr', category: 'Document',
    title: 'PDF OCR & Text Extractor',
    description: 'Extract text from digital and scanned PDFs.',
    inputTypes: ['pdf'], outputTypes: ['txt'], availability: 'BETA',
    capability: {
      operation: 'pdf.ocr',
      browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 10 * MB, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.pdfOcr',
  },
  'url-to-pdf': {
    id: 'url.toPdf', slug: 'url-to-pdf', operation: 'url.toPdf', category: 'Web',
    title: 'URL to PDF Web Capture', description: 'Render public webpages with Chromium.',
    inputTypes: ['url'], outputTypes: ['pdf'], availability: 'AVAILABLE_SERVER',
    capability: {
      operation: 'url.toPdf', browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 4096, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.urlToPdf',
  },
  'url-to-docx': {
    id: 'url.toDocx', slug: 'url-to-docx', operation: 'url.toDocx', category: 'Web',
    title: 'URL to Word Converter', description: 'Extract a public webpage into editable DOCX.',
    inputTypes: ['url'], outputTypes: ['docx'], availability: 'BETA',
    capability: {
      operation: 'url.toDocx', browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 4096, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.urlToDocx',
  },
  'html-to-pdf': {
    id: 'html.toPdf', slug: 'html-to-pdf', operation: 'html.toPdf', category: 'Developer',
    title: 'HTML to PDF Template Engine', description: 'Render HTML and CSS with Chromium.',
    inputTypes: ['html', 'txt'], outputTypes: ['pdf'], availability: 'AVAILABLE_SERVER',
    capability: {
      operation: 'html.toPdf', browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 10 * MB, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.htmlToPdf',
  },
  'markdown-to-pdf': {
    id: 'markdown.toPdf', slug: 'markdown-to-pdf', operation: 'markdown.toPdf', category: 'Developer',
    title: 'Markdown to PDF Converter', description: 'Render Markdown as a styled PDF.',
    inputTypes: ['markdown', 'md'], outputTypes: ['pdf'], availability: 'AVAILABLE_SERVER',
    capability: {
      operation: 'markdown.toPdf', browser: { supported: false }, node: { supported: false },
      native: { supported: true, maxBytes: 10 * MB, maxFiles: 1 }, preferred: 'NATIVE',
    },
    privacy: { browserPreferred: false, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.markdownToPdf',
  },
  'image-to-pdf': {
    id: 'image.toPdf', slug: 'image-to-pdf', operation: 'image.toPdf', category: 'Image',
    title: 'Image to PDF Converter', description: 'Convert images into PDF pages.',
    inputTypes: ['png', 'jpg', 'jpeg'], outputTypes: ['pdf'], availability: 'AVAILABLE_BOTH',
    capability: {
      operation: 'image.toPdf',
      browser: { supported: true, maxBytes: 25 * MB, maxFiles: 50 },
      node: { supported: true, maxBytes: 25 * MB, maxFiles: 50 },
      native: { supported: true, maxBytes: 250 * MB, maxFiles: 100 }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.imageToPdf',
  },
  'document-editor': {
    id: 'document.edit', slug: 'document-editor', operation: 'document.edit', category: 'Studio',
    title: 'Online Document Studio', description: 'Create and export documents in the browser.',
    inputTypes: ['html', 'markdown', 'txt'], outputTypes: ['pdf', 'docx', 'html'],
    availability: 'AVAILABLE_BOTH',
    capability: {
      operation: 'document.edit', browser: { supported: true, maxBytes: 10 * MB, maxFiles: 1 },
      node: { supported: true, maxBytes: 10 * MB, maxFiles: 1 },
      native: { supported: true, maxBytes: 100 * MB, maxFiles: 1 }, preferred: 'BROWSER',
    },
    privacy: { browserPreferred: true, serverRetentionSeconds: TEN_MINUTES },
    featureFlag: 'tool.documentEditor',
  },
} satisfies Record<string, CanonicalToolDefinition>;

export type ToolSlug = keyof typeof TOOL_REGISTRY;

export function getToolDefinition(slug: string): CanonicalToolDefinition | undefined {
  return TOOL_REGISTRY[slug as ToolSlug];
}

export function listToolDefinitions(): CanonicalToolDefinition[] {
  return Object.values(TOOL_REGISTRY);
}
