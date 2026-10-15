/** Minimal RFC 4180 CSV reader/writer for item and contact import/export. */

export const MAX_IMPORT_ROWS = 2000;

/** Parses CSV text into rows of cells (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

/** Rows as objects keyed by the (lower-cased, trimmed) header row. */
export function csvRecords(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((key) => key.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? '').trim()])));
}

/**
 * Serialises rows. Cells that a spreadsheet would treat as a formula
 * (=, +, -, @, tab, CR) are prefixed with an apostrophe (CSV injection).
 */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
