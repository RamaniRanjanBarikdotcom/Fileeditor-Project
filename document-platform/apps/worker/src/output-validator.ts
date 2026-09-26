import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'sheetjs-style';
import { Readable } from 'stream';
import JSZip from 'jszip';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const execFileAsync = promisify(execFile);

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
    if (output.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new Error('Generated output is not a valid DOCX package');
    }
    try {
      const zip = await JSZip.loadAsync(output);
      const contentTypes = zip.file('[Content_Types].xml');
      const documentXml = zip.file('word/document.xml');
      const rels = zip.file('_rels/.rels');

      if (!contentTypes || !documentXml || !rels) {
        throw new Error('DOCX package is missing required OOXML parts');
      }

      const docXmlText = await documentXml.async('string');
      if (!docXmlText.includes('<w:document') || !docXmlText.includes('</w:document>')) {
        throw new Error('DOCX document.xml is corrupted or incomplete');
      }

      const ctText = await contentTypes.async('string');
      if (!ctText.includes('<Types') || !ctText.includes('</Types>')) {
        throw new Error('DOCX [Content_Types].xml is corrupted');
      }

      await validateDocxWithLibreOffice(output);
    } catch (error: any) {
      throw new Error(
        `Generated output is not a valid DOCX package: ${error?.message || 'invalid package'}`,
      );
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
  if (format === 'zip') {
    if (output.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new Error('Generated output is not a ZIP archive');
    }
    try {
      const archive = await JSZip.loadAsync(output);
      const entries = Object.values(archive.files).filter((entry) => !entry.dir);
      if (!entries.length) throw new Error('Archive has no files');
      for (const entry of entries) {
        if (!/\.png$|\.jpe?g$/i.test(entry.name)) {
          throw new Error(`Unexpected archive entry '${entry.name}'`);
        }
        const bytes = await entry.async('nodebuffer');
        if (!bytes.length) throw new Error(`Archive entry '${entry.name}' is empty`);
      }
    } catch (error: any) {
      throw new Error(`Generated ZIP cannot be parsed: ${error?.message || 'invalid archive'}`);
    }
    return;
  }
  if (['html', 'markdown', 'md', 'txt', 'csv', 'json'].includes(format)) {
    if (output.includes(0)) throw new Error('Generated text output contains binary null bytes');
  }
}

async function validateDocxWithLibreOffice(output: Buffer): Promise<void> {
  const required =
    process.env.DOCX_COMPATIBILITY_VALIDATION_REQUIRED === 'true' ||
    process.env.NODE_ENV === 'production';
  const executable = process.env.LIBREOFFICE_BIN || 'libreoffice';
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docconv-docx-validate-'));
  try {
    const inputPath = path.join(tmpDir, 'document.docx');
    await fs.writeFile(inputPath, output);
    try {
      await execFileAsync(
        executable,
        ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, inputPath],
        {
          timeout: Number(process.env.DOCX_VALIDATION_TIMEOUT_MS || 60_000),
          maxBuffer: 5 * 1024 * 1024,
        },
      );
    } catch (error: any) {
      if (!required && error?.code === 'ENOENT') return;
      throw new Error(`LibreOffice could not open the DOCX: ${error?.message || 'unknown error'}`);
    }
    const rendered = await fs.readFile(path.join(tmpDir, 'document.pdf')).catch(() => null);
    if (!rendered || rendered.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('LibreOffice did not produce a valid PDF from the DOCX');
    }
    const pdf = await PDFDocument.load(rendered, { updateMetadata: false });
    if (pdf.getPageCount() < 1) throw new Error('LibreOffice rendered an empty DOCX');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
