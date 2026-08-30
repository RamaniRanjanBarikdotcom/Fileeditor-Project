import { exec } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import * as os from 'os';
import { workerLogger } from '@docconv/logging';

const execAsync = promisify(exec);

export class PandocAdapter {
  constructor() {}

  async convert(
    inputStream: Readable,
    sourceFormat: string,
    targetFormat: string
  ): Promise<Readable> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docconv-pandoc-'));
    const inputPath = path.join(tmpDir, `input.${sourceFormat}`);
    const outputPath = path.join(tmpDir, `output.${targetFormat}`);

    try {
      // Persist the readable stream correctly. fs.writeFile does not consume
      // Node streams and caused every Pandoc conversion to fail at runtime.
      await pipeline(inputStream, createWriteStream(inputPath));

      // Execute Pandoc
      const command = `pandoc "${inputPath}" -o "${outputPath}"`;
      workerLogger.debug({ command }, 'Executing pandoc');
      await execAsync(command, {
        timeout: Number(process.env.CONVERSION_TIMEOUT_MS || 60_000),
        maxBuffer: 1024 * 1024,
      });

      // Read output into memory buffer (fine for small to medium docs)
      const outputBuffer = await fs.readFile(outputPath);
      
      // Return as Readable stream
      return Readable.from(outputBuffer);
    } finally {
      // Clean up temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(err => {
        workerLogger.warn({ err, tmpDir }, 'Failed to clean up pandoc temp dir');
      });
    }
  }
}
