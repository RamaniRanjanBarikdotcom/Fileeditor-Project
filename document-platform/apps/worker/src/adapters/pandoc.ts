import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import * as os from 'os';
import { workerLogger } from '@docconv/logging';

const execFileAsync = promisify(execFile);

export class PandocAdapter {
  constructor() {}

  async convert(
    inputStream: Readable,
    sourceFormat: string,
    targetFormat: string,
  ): Promise<Readable> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docconv-pandoc-'));
    const inputPath = path.join(tmpDir, `input.${sourceFormat}`);
    const outputPath = path.join(tmpDir, `output.${targetFormat}`);

    try {
      // Persist the readable stream correctly. fs.writeFile does not consume
      // Node streams and caused every Pandoc conversion to fail at runtime.
      await pipeline(inputStream, createWriteStream(inputPath));

      // Pandoc's `gfm` reader already enables its supported table, task-list,
      // and strikeout syntax. Re-appending those names is version-sensitive
      // (Pandoc 3 rejects `tables` as an unknown extension).
      const from = sourceFormat === 'markdown' ? 'gfm' : sourceFormat;
      const args = [inputPath, '--from', from, '--to', targetFormat, '--output', outputPath];
      if (targetFormat === 'html') args.push('--standalone', '--mathml');
      workerLogger.debug({ executable: 'pandoc', args }, 'Executing pandoc');
      await execFileAsync('pandoc', args, {
        timeout: Number(process.env.CONVERSION_TIMEOUT_MS || 60_000),
        maxBuffer: 1024 * 1024,
      });

      // Read output into memory buffer (fine for small to medium docs)
      const outputBuffer = await fs.readFile(outputPath);

      // Return as Readable stream
      return Readable.from(outputBuffer);
    } finally {
      // Clean up temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch((err) => {
        workerLogger.warn({ err, tmpDir }, 'Failed to clean up pandoc temp dir');
      });
    }
  }
}
