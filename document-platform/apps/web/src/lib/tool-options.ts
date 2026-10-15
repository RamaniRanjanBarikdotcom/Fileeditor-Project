// Declarative settings for tools. Each operation lists its fields once; the
// converter renders them generically and passes the values to the browser
// engine or, for server tools, to the job settings. Adding a tool means adding
// a definition here instead of hand-writing state and inputs.

export type ToolOptionValue = string;

interface BaseField {
  key: string;
  label: string;
  help?: string;
  /** Only show (and send) this field when another field has one of these values. */
  showWhen?: { key: string; equals: string[] };
  /** Spans the full width of the settings grid. */
  wide?: boolean;
}

export type ToolOptionField =
  | (BaseField & {
      type: 'text' | 'password' | 'textarea';
      default: string;
      placeholder?: string;
      maxLength?: number;
    })
  | (BaseField & {
      type: 'number';
      default: string;
      min: number;
      max: number;
      step?: number;
      placeholder?: string;
    })
  | (BaseField & {
      type: 'select';
      default: string;
      choices: Array<{ value: string; label: string }>;
    })
  | (BaseField & { type: 'color'; default: string });

const PAGES_FIELD: ToolOptionField = {
  key: 'pages',
  label: 'Pages',
  type: 'text',
  default: '',
  placeholder: 'All pages — or e.g. 1-3,5',
  help: 'Leave empty to apply to every page.',
};

const POSITION_CHOICES = [
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-center', label: 'Top centre' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
];

const PASSWORD_FIELD: ToolOptionField = {
  key: 'password',
  label: 'Password',
  type: 'password',
  default: '',
  maxLength: 128,
};

export const TOOL_OPTION_FIELDS: Record<string, ToolOptionField[]> = {
  'pdf.split': [
    {
      key: 'splitMode',
      label: 'Split method',
      type: 'select',
      default: 'every',
      choices: [
        { value: 'every', label: 'Every page into its own PDF' },
        { value: 'ranges', label: 'Custom page ranges' },
        { value: 'everyN', label: 'Every N pages' },
      ],
    },
    {
      key: 'ranges',
      label: 'Page ranges',
      type: 'text',
      default: '1-2',
      placeholder: '1-3,4-6,7',
      help: 'Each range becomes a separate PDF.',
      showWhen: { key: 'splitMode', equals: ['ranges'] },
    },
    {
      key: 'everyN',
      label: 'Pages per file',
      type: 'number',
      default: '2',
      min: 1,
      max: 1000,
      showWhen: { key: 'splitMode', equals: ['everyN'] },
    },
  ],
  'pdf.rotate': [
    {
      key: 'rotation',
      label: 'Rotation',
      type: 'select',
      default: '90',
      choices: [
        { value: '90', label: '90° clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '90° counter-clockwise' },
      ],
    },
    PAGES_FIELD,
  ],
  'pdf.watermark': [
    {
      key: 'watermarkText',
      label: 'Watermark text',
      type: 'text',
      default: 'CONFIDENTIAL',
      maxLength: 120,
      wide: true,
      help: 'Any language is supported.',
    },
    {
      key: 'watermarkPosition',
      label: 'Position',
      type: 'select',
      default: 'center',
      choices: [{ value: 'center', label: 'Centre (diagonal)' }, ...POSITION_CHOICES],
    },
    {
      key: 'watermarkAngle',
      label: 'Angle',
      type: 'select',
      default: '45',
      choices: [
        { value: '45', label: '45°' },
        { value: '0', label: 'Horizontal' },
        { value: '-45', label: '−45°' },
        { value: '90', label: 'Vertical' },
      ],
      showWhen: { key: 'watermarkPosition', equals: ['center'] },
    },
    {
      key: 'watermarkOpacity',
      label: 'Opacity (%)',
      type: 'number',
      default: '30',
      min: 5,
      max: 100,
      step: 5,
    },
    {
      key: 'watermarkSize',
      label: 'Font size (pt)',
      type: 'number',
      default: '',
      min: 0,
      max: 200,
      placeholder: 'Auto',
    },
    { key: 'watermarkColor', label: 'Colour', type: 'color', default: '#737373' },
    PAGES_FIELD,
  ],
  'pdf.addPageNumbers': [
    {
      key: 'numberPosition',
      label: 'Position',
      type: 'select',
      default: 'bottom-center',
      choices: POSITION_CHOICES,
    },
    {
      key: 'numberFormat',
      label: 'Format',
      type: 'select',
      default: '{n}',
      choices: [
        { value: '{n}', label: '1' },
        { value: 'Page {n}', label: 'Page 1' },
        { value: '{n} / {total}', label: '1 / 10' },
        { value: 'Page {n} of {total}', label: 'Page 1 of 10' },
      ],
    },
    { key: 'startNumber', label: 'Start at', type: 'number', default: '1', min: 0, max: 1_000_000 },
    { key: 'fontSize', label: 'Font size (pt)', type: 'number', default: '10', min: 6, max: 48 },
    { key: 'textColor', label: 'Colour', type: 'color', default: '#333333' },
    PAGES_FIELD,
  ],
  'pdf.headerFooter': [
    {
      key: 'headerText',
      label: 'Header text',
      type: 'text',
      default: '',
      maxLength: 120,
      placeholder: 'Confidential report',
    },
    {
      key: 'footerText',
      label: 'Footer text',
      type: 'text',
      default: 'Page {page} of {pages}',
      maxLength: 120,
      help: 'Use {page} for the current page and {pages} for the total.',
    },
    {
      key: 'textAlign',
      label: 'Alignment',
      type: 'select',
      default: 'center',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Centre' },
        { value: 'right', label: 'Right' },
      ],
    },
    { key: 'fontSize', label: 'Font size (pt)', type: 'number', default: '9', min: 6, max: 36 },
    { key: 'textColor', label: 'Colour', type: 'color', default: '#333333' },
  ],
  'pdf.batesNumbering': [
    { key: 'batesPrefix', label: 'Prefix', type: 'text', default: 'APP-', maxLength: 24 },
    { key: 'batesSuffix', label: 'Suffix', type: 'text', default: '', maxLength: 24 },
    {
      key: 'batesStart',
      label: 'Starting number',
      type: 'number',
      default: '1',
      min: 0,
      max: 999_999_999,
    },
    { key: 'batesPadding', label: 'Number width', type: 'number', default: '6', min: 1, max: 12 },
    {
      key: 'batesPosition',
      label: 'Position',
      type: 'select',
      default: 'bottom-right',
      choices: POSITION_CHOICES,
    },
  ],
  'pdf.splitHalf': [
    {
      key: 'splitDirection',
      label: 'Cut each page',
      type: 'select',
      default: 'vertical',
      choices: [
        { value: 'vertical', label: 'Down the middle (left and right)' },
        { value: 'horizontal', label: 'Across the middle (top and bottom)' },
      ],
    },
  ],
  'pdf.splitBySize': [
    {
      key: 'maxSizeMb',
      label: 'Maximum size per file (MB)',
      type: 'number',
      default: '10',
      min: 0.5,
      max: 500,
      step: 0.5,
      help: 'A single page larger than the limit is kept whole in its own file.',
    },
  ],
  'pdf.splitByText': [
    {
      key: 'splitText',
      label: 'Start a new PDF at pages containing',
      type: 'text',
      default: '',
      maxLength: 200,
      placeholder: 'Invoice number',
      wide: true,
    },
    {
      key: 'caseSensitive',
      label: 'Match case',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
  ],
  'pdf.removeAnnotations': [
    {
      key: 'keepLinks',
      label: 'Keep hyperlinks',
      type: 'select',
      default: 'yes',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ],
  'pdf.flip': [
    {
      key: 'flipDirection',
      label: 'Flip',
      type: 'select',
      default: 'horizontal',
      choices: [
        { value: 'horizontal', label: 'Horizontally (mirror left–right)' },
        { value: 'vertical', label: 'Vertically (upside-down mirror)' },
      ],
    },
    PAGES_FIELD,
  ],
  'pdf.addBookmarks': [
    {
      key: 'bookmarks',
      label: 'Bookmarks — one per line: Title, page',
      type: 'textarea',
      default: 'Introduction, 1',
      maxLength: 10_000,
      help: 'Example: "Chapter 2, 14". Existing bookmarks are replaced.',
    },
  ],
  'pdf.compress': [
    {
      key: 'compressionLevel',
      label: 'Compression',
      type: 'select',
      default: 'recommended',
      choices: [
        { value: 'recommended', label: 'Recommended — good quality, smaller file' },
        { value: 'extreme', label: 'Extreme — smallest file, lower image quality' },
        { value: 'low', label: 'Light — keep images untouched' },
      ],
      wide: true,
    },
  ],
  'pdf.protect': [
    {
      ...PASSWORD_FIELD,
      label: 'Password to open the PDF',
      maxLength: 40,
      help: '4–40 characters. Encrypted with AES-256.',
    },
    {
      key: 'allowPrinting',
      label: 'Allow printing',
      type: 'select',
      default: 'yes',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
    {
      key: 'allowCopying',
      label: 'Allow copying text',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
    {
      key: 'allowEditing',
      label: 'Allow editing',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ],
  'pdf.unlock': [
    {
      ...PASSWORD_FIELD,
      label: 'Current PDF password',
      maxLength: 40,
      help: 'Only unlock files you are allowed to open.',
    },
  ],
  'pdf.ocrSearchable': [
    {
      key: 'ocrLanguage',
      label: 'Document language',
      type: 'select',
      default: 'eng',
      choices: [
        { value: 'eng', label: 'English' },
        { value: 'hin', label: 'Hindi' },
        { value: 'eng+hin', label: 'English + Hindi' },
        { value: 'deu', label: 'German' },
        { value: 'fra', label: 'French' },
        { value: 'spa', label: 'Spanish' },
        { value: 'ita', label: 'Italian' },
        { value: 'por', label: 'Portuguese' },
        { value: 'ara', label: 'Arabic' },
        { value: 'chi_sim', label: 'Chinese (Simplified)' },
      ],
    },
    {
      key: 'ocrMode',
      label: 'Pages to recognise',
      type: 'select',
      default: 'skip',
      choices: [
        { value: 'skip', label: 'Only pages without text' },
        { value: 'all', label: 'Every page' },
      ],
    },
  ],
  'pdf.redact': [
    {
      key: 'redactTerms',
      label: 'Words or phrases to remove',
      type: 'textarea',
      default: '',
      maxLength: 2000,
      placeholder: 'One per line or separated by commas',
      help: 'Matching text is permanently deleted, not just covered.',
    },
    {
      key: 'redactEmails',
      label: 'Email addresses',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'no', label: 'Keep' },
        { value: 'yes', label: 'Redact' },
      ],
    },
    {
      key: 'redactPhones',
      label: 'Phone numbers',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'no', label: 'Keep' },
        { value: 'yes', label: 'Redact' },
      ],
    },
    {
      key: 'redactCardNumbers',
      label: 'Card numbers',
      type: 'select',
      default: 'no',
      choices: [
        { value: 'no', label: 'Keep' },
        { value: 'yes', label: 'Redact' },
      ],
    },
  ],
  'pdf.toExcel': [
    {
      key: 'textFallback',
      label: 'If no tables are found',
      type: 'select',
      default: 'yes',
      choices: [
        { value: 'yes', label: 'Export each page’s text lines' },
        { value: 'no', label: 'Show an error' },
      ],
    },
  ],
  'pdf.toPdfA': [
    {
      key: 'pdfaLevel',
      label: 'PDF/A version',
      type: 'select',
      default: 'PDF/A-2b',
      choices: [
        { value: 'PDF/A-2b', label: 'PDF/A-2b (recommended)' },
        { value: 'PDF/A-1b', label: 'PDF/A-1b (maximum compatibility)' },
        { value: 'PDF/A-3b', label: 'PDF/A-3b (allows attachments)' },
      ],
    },
  ],
};

/** Fields reused when declaring further tools. */
export const COMMON_FIELDS = { PAGES_FIELD, PASSWORD_FIELD, POSITION_CHOICES };

export function defaultToolOptions(operation: string | undefined): Record<string, ToolOptionValue> {
  return Object.fromEntries(
    (TOOL_OPTION_FIELDS[operation || ''] || []).map((field) => [field.key, field.default]),
  );
}

export function isFieldVisible(field: ToolOptionField, values: Record<string, ToolOptionValue>) {
  return !field.showWhen || field.showWhen.equals.includes(values[field.showWhen.key] ?? '');
}

/** Values of the visible fields only, so hidden choices never reach the engine. */
export function visibleToolOptions(
  operation: string | undefined,
  values: Record<string, ToolOptionValue>,
): Record<string, ToolOptionValue> {
  return Object.fromEntries(
    (TOOL_OPTION_FIELDS[operation || ''] || [])
      .filter((field) => isFieldVisible(field, values))
      .map((field) => [field.key, values[field.key] ?? field.default]),
  );
}
