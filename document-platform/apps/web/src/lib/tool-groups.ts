// Task-based organisation of the tool catalogue, shared by the public tools
// directory, the workspace toolbox and the navigation menu. Kept free of UI
// imports so it can be unit-tested directly under Node type stripping.

export interface ToolGroup {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  slugs: string[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'organize-pdf',
    title: 'Organize PDF',
    shortTitle: 'Organize',
    description: 'Combine, reorder, rotate and remove pages without uploading your files.',
    slugs: [
      'merge-pdf',
      'alternate-mix-pdf',
      'organize-pdf',
      'rotate-pdf',
      'extract-pdf-pages',
      'delete-pdf-pages',
    ],
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    shortTitle: 'Split',
    description: 'Break a PDF apart by pages, chapters, file size, text or down the middle.',
    slugs: [
      'split-pdf',
      'split-pdf-by-bookmarks',
      'split-pdf-by-size',
      'split-pdf-by-text',
      'split-pdf-in-half',
    ],
  },
  {
    id: 'optimize-pdf',
    title: 'Optimize PDF',
    shortTitle: 'Optimize',
    description: 'Shrink, repair and make scanned PDFs searchable.',
    slugs: ['compress-pdf', 'ocr-pdf', 'repair-pdf', 'grayscale-pdf'],
  },
  {
    id: 'edit-pdf',
    title: 'Edit & enhance PDF',
    shortTitle: 'Edit',
    description: 'Watermarks, page numbers, headers, bookmarks, page size and document details.',
    slugs: [
      'watermark-pdf',
      'number-pdf-pages',
      'header-footer-pdf',
      'bates-numbering-pdf',
      'pdf-bookmarks',
      'pdf-metadata',
      'crop-pdf',
      'resize-pdf',
      'n-up-pdf',
      'flip-pdf',
      'remove-pdf-annotations',
    ],
  },
  {
    id: 'convert-to-pdf',
    title: 'Convert to PDF',
    shortTitle: 'To PDF',
    description: 'Turn Word, PowerPoint, Excel, HTML and Markdown into clean PDFs.',
    slugs: ['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf', 'markdown-to-pdf'],
  },
  {
    id: 'convert-from-pdf',
    title: 'Convert from PDF',
    shortTitle: 'From PDF',
    description: 'Get editable Word, Excel, PowerPoint, text and archival PDF/A files.',
    slugs: [
      'pdf-to-docx',
      'pdf-to-excel',
      'pdf-to-powerpoint',
      'pdf-to-pdfa',
      'pdf-to-text',
      'pdf-to-markdown',
      'pdf-ocr',
    ],
  },
  {
    id: 'pdf-security',
    title: 'PDF security',
    shortTitle: 'Security',
    description: 'Add or remove passwords, permanently redact content and flatten forms.',
    slugs: ['protect-pdf', 'unlock-pdf', 'redact-pdf', 'flatten-pdf-forms'],
  },
  {
    id: 'image',
    title: 'Image tools',
    shortTitle: 'Image',
    description: 'Photos and scans to PDF, PDF pages to images, and embedded image extraction.',
    slugs: ['image-to-pdf', 'scan-to-pdf', 'pdf-to-images', 'extract-images-from-pdf'],
  },
  {
    id: 'web',
    title: 'Web capture',
    shortTitle: 'Web',
    description: 'Save any public webpage as a PDF or an editable Word document.',
    slugs: ['url-to-pdf', 'url-to-docx'],
  },
  {
    id: 'editors',
    title: 'Editors',
    shortTitle: 'Editors',
    description: 'Edit PDF text directly or write and export documents in the browser.',
    slugs: ['pdf-editor', 'document-editor'],
  },
];

/** Tools the API adds before this file is updated still appear, under "More tools". */
export const OTHER_TOOL_GROUP: ToolGroup = {
  id: 'more',
  title: 'More tools',
  shortTitle: 'More',
  description: 'Additional tools available in your workspace.',
  slugs: [],
};

export function groupIdForSlug(slug: string): string {
  return TOOL_GROUPS.find((group) => group.slugs.includes(slug))?.id ?? OTHER_TOOL_GROUP.id;
}

/**
 * Splits tools into groups in catalogue order, keeping each group's own tool
 * order and dropping empty groups.
 */
export function groupTools<T extends { slug: string }>(
  tools: T[],
): Array<{ group: ToolGroup; tools: T[] }> {
  const bySlug = new Map(tools.map((tool) => [tool.slug, tool]));
  const sections = TOOL_GROUPS.map((group) => ({
    group,
    tools: group.slugs.flatMap((slug) => {
      const tool = bySlug.get(slug);
      return tool ? [tool] : [];
    }),
  }));
  const grouped = new Set(TOOL_GROUPS.flatMap((group) => group.slugs));
  const others = tools.filter((tool) => !grouped.has(tool.slug));
  if (others.length) sections.push({ group: OTHER_TOOL_GROUP, tools: others });
  return sections.filter((section) => section.tools.length > 0);
}
