import { spawn } from 'child_process';
import { promises as fs, createWriteStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as XLSX from 'sheetjs-style';
import { ServerPdfOperation } from '@docconv/shared-types';
import { GotenbergAdapter } from './gotenberg';

/** An error whose message is written for customers and must not be retried. */
export class UserFacingConversionError extends Error {
  readonly userFacing = true;
}

const SAFE_PREFIX = 'USER_ERROR:';
const PYTHON_OPERATIONS = new Set<ServerPdfOperation>([
  'pdf.compress',
  'pdf.protect',
  'pdf.unlock',
  'pdf.repair',
  'pdf.grayscale',
  'pdf.ocrSearchable',
  'pdf.redact',
  'pdf.extractImages',
  'pdf.toExcel',
]);

function scriptPath() {
  // dist/adapters → ../../scripts (built) and src/adapters → ../../scripts (ts-node).
  return path.resolve(__dirname, '../../scripts/pdf_ops.py');
}

function pythonBin() {
  // PyMuPDF ships in the pdf2docx virtualenv in Docker; native installs may
  // point PDF_OPS_PYTHON at any interpreter that has PyMuPDF.
  return process.env.PDF_OPS_PYTHON || process.env.PDF2DOCX_PYTHON || '/opt/pdf2docx/bin/python3';
}

function run(
  command: string,
  args: string[],
  options: { input?: string; timeoutMs: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv },
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      env: { ...process.env, ...options.env },
    });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('The conversion timed out.'));
    }, options.timeoutMs);
    const onAbort = () => {
      child.kill('SIGKILL');
      reject(new Error('Conversion cancelled'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(`Required engine not found: ${command}`)
          : error,
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({ code, stderr });
    });
    child.stdin.end(options.input ?? '');
  });
}

function userError(stderr: string): string | null {
  const line = stderr
    .split('\n')
    .reverse()
    .find((entry) => entry.startsWith(SAFE_PREFIX));
  return line ? line.slice(SAFE_PREFIX.length).trim() : null;
}

/**
 * Keeps numbers as numbers so spreadsheets can calculate with them, but only
 * when unambiguous: "1,234" is a thousands separator (not 1.234), and values
 * with leading zeros (IDs, postcodes, "007") stay text.
 */
export function spreadsheetValue(cell: unknown): string | number {
  const text = String(cell ?? '').trim();
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(text)) return Number(text);
  if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ''));
  return text;
}

export class PdfOpsAdapter {
  private readonly timeoutMs = Number(process.env.PDF_OPS_TIMEOUT_MS || 240_000);

  constructor(private readonly gotenberg: GotenbergAdapter) {}

  async convert(
    input: Readable,
    operation: ServerPdfOperation,
    options: Record<string, string>,
    secret: { password?: string } | null,
    signal?: AbortSignal,
  ): Promise<Readable> {
    if (operation === 'pdf.toPdfA') {
      const level = (options.pdfaLevel || 'PDF/A-2b') as 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b';
      return this.gotenberg.convertPdfToPdfA(input, level, signal);
    }

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ops-'));
    try {
      const inputPath = path.join(workDir, 'input.pdf');
      await pipeline(input, createWriteStream(inputPath));

      if (operation === 'pdf.toPptx') return await this.toPowerPoint(workDir, inputPath, signal);
      if (!PYTHON_OPERATIONS.has(operation)) {
        throw new Error(`Unsupported PDF operation: ${operation}`);
      }

      const outputPath = path.join(workDir, operation === 'pdf.toExcel' ? 'tables.json' : 'output.bin');
      const { code, stderr } = await run(pythonBin(), [scriptPath(), operation, inputPath, outputPath], {
        // Options and passwords travel on stdin, never in process arguments.
        input: JSON.stringify({ options, secret }),
        timeoutMs: this.timeoutMs,
        signal,
      });
      if (code !== 0) {
        const message = userError(stderr);
        if (message) throw new UserFacingConversionError(message);
        throw new Error(`PDF operation ${operation} failed: ${stderr.slice(-500)}`);
      }

      if (operation === 'pdf.toExcel') {
        return Readable.from(await this.tablesToWorkbook(outputPath));
      }
      return Readable.from(await fs.readFile(outputPath));
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async tablesToWorkbook(jsonPath: string): Promise<Buffer> {
    const { tables } = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as {
      tables: Array<{ page: number; index: number; rows: string[][] }>;
    };
    const workbook = XLSX.utils.book_new();
    const used = new Set<string>();
    for (const table of tables) {
      let name = table.index ? `Page ${table.page} Table ${table.index}` : `Page ${table.page} Text`;
      name = name.slice(0, 31);
      for (let suffix = 2; used.has(name); suffix += 1) name = `${name.slice(0, 27)} (${suffix})`;
      used.add(name);
      const rows = table.rows.map((row) => row.map((cell) => spreadsheetValue(cell)));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    }
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private async toPowerPoint(workDir: string, inputPath: string, signal?: AbortSignal) {
    const outDir = path.join(workDir, 'out');
    await fs.mkdir(outDir);
    const { code, stderr } = await run(
      process.env.SOFFICE_BIN || 'soffice',
      [
        '--headless',
        '--norestore',
        // A private profile per job lets several conversions run concurrently.
        `-env:UserInstallation=file://${path.join(workDir, 'profile')}`,
        '--infilter=impress_pdf_import',
        '--convert-to',
        'pptx',
        '--outdir',
        outDir,
        inputPath,
      ],
      { timeoutMs: this.timeoutMs, signal },
    );
    const output = path.join(outDir, 'input.pptx');
    const exists = await fs
      .stat(output)
      .then((stat) => stat.size > 0)
      .catch(() => false);
    if (code !== 0 || !exists) {
      throw new Error(`LibreOffice could not convert the PDF to PowerPoint: ${stderr.slice(-500)}`);
    }
    return Readable.from(await fs.readFile(output));
  }
}
