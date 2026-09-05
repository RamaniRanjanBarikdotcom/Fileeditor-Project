import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'sheetjs-style';
import { Readable } from 'stream';

export async function streamToValidatedBuffer(
  stream: Readable,
  targetFormat: string,
  maxBytes = Number(process.env.MAX_OUTPUT_SIZE_BYTES || 100 * 1024 * 1024),
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error('Generated output exceeds the configured size limit');
    chunks.push(buffer);
  }
  const output = Buffer.concat(chunks);
  if (!output.length) throw new Error('Conversion produced an empty output');
  await validateOutputBuffer(output, targetFormat);
  return output;
}

export async function validateOutputBuffer(output: Buffer, targetFormat: string): Promise<void> {
  const format = targetFormat.toLowerCase().replace(/^\./, '');
  if (format === 'pdf') {
    if (output.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Generated output is not a PDF');
    }
    try {
      const pdf = await PDFDocument.load(output, { updateMetadata: false });
      if (pdf.getPageCount() < 1) throw new Error('PDF has no pages');
    } catch (error: any) {
      throw new Error(`Generated PDF cannot be parsed: ${error?.message || 'invalid document'}`);
    }
    return;
  }
  if (format === 'docx') {
    const requiredParts = ['[Content_Types].xml', 'word/document.xml', '_rels/.rels'];
    if (
      output.subarray(0, 2).toString('ascii') !== 'PK' ||
      requiredParts.some((part) => !output.includes(Buffer.from(part)))
    ) {
      throw new Error('Generated output is not a valid DOCX package');
    }
    return;
  }
  if (format === 'xlsx') {
    try {
      const workbook = XLSX.read(output, { type: 'buffer' });
      if (!workbook.SheetNames.length) throw new Error('Workbook has no sheets');
    } catch (error: any) {
      throw new Error(`Generated XLSX cannot be parsed: ${error?.message || 'invalid workbook'}`);
    }
    return;
  }
  if (format === 'png') {
    if (!output.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('Generated PNG has an invalid signature');
    }
    return;
  }
  if (format === 'jpg' || format === 'jpeg') {
    if (output[0] !== 0xff || output[1] !== 0xd8 || output.at(-2) !== 0xff || output.at(-1) !== 0xd9) {
      throw new Error('Generated JPEG has an invalid structure');
    }
    return;
  }
  if (['html', 'markdown', 'md', 'txt', 'csv', 'json'].includes(format)) {
    if (output.includes(0)) throw new Error('Generated text output contains binary null bytes');
  }
}
