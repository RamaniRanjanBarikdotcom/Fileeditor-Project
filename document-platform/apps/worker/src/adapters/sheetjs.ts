import { Readable } from 'stream';
import * as XLSX from 'sheetjs-style';

export class SheetJSAdapter {
  constructor() {}

  async convert(
    inputStream: Readable,
    sourceFormat: string,
    targetFormat: string
  ): Promise<Readable> {
    // Read stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of inputStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const inputBuffer = Buffer.concat(chunks);

    let workbook: XLSX.WorkBook;
    if (sourceFormat.toLowerCase() === 'json') {
      const parsed = JSON.parse(inputBuffer.toString('utf-8'));
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    } else {
      workbook = XLSX.read(inputBuffer, { type: 'buffer' });
    }

    // Write workbook to target format
    let bookType: XLSX.BookType;
    switch (targetFormat.toLowerCase()) {
      case 'csv': bookType = 'csv'; break;
      case 'xlsx': bookType = 'xlsx'; break;
      case 'html': bookType = 'html'; break;
      case 'txt': bookType = 'txt'; break;
      default: throw new Error(`Unsupported output format: ${targetFormat}`);
    }

    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType });
    return Readable.from(outputBuffer);
  }
}
