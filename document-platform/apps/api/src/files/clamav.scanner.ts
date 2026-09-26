import * as net from 'net';
import { Logger } from '@nestjs/common';

export interface ScanResult {
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  virus?: string;
  error?: string;
}

export class ClamAvScanner {
  private readonly logger = new Logger('ClamAvScanner');

  constructor(
    private readonly host: string = process.env.CLAMAV_HOST || 'localhost',
    private readonly port: number = parseInt(process.env.CLAMAV_PORT || '3310', 10),
    private readonly enabled: boolean =
      process.env.CLAMAV_ENABLED === 'true' || process.env.NODE_ENV === 'production',
  ) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Verify that clamd is reachable and accepting commands. */
  async ping(timeoutMs = 3000): Promise<boolean> {
    if (!this.enabled) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value);
      };
      const socket = net.createConnection({ host: this.host, port: this.port });
      socket.setTimeout(timeoutMs);
      socket.on('connect', () => socket.write(Buffer.from('zPING\0', 'binary')));
      socket.on('data', (data) => finish(data.toString('utf8').includes('PONG')));
      socket.on('timeout', () => finish(false));
      socket.on('error', () => finish(false));
      socket.on('end', () => finish(false));
    });
  }

  /**
   * Scan an in-memory buffer using ClamAV TCP INSTREAM protocol.
   */
  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    if (!this.enabled) {
      return { status: 'SKIPPED' };
    }

    return new Promise<ScanResult>((resolve) => {
      let resolved = false;
      const safeResolve = (res: ScanResult) => {
        if (!resolved) {
          resolved = true;
          resolve(res);
        }
      };

      const socket = net.createConnection({ host: this.host, port: this.port });
      socket.setTimeout(15000);

      let response = '';

      socket.on('connect', () => {
        try {
          // ClamAV INSTREAM command: zINSTREAM\0
          socket.write(Buffer.from('zINSTREAM\0', 'binary'));

          // Send data in chunks with 4-byte big-endian prefix
          const chunkSize = 64 * 1024; // 64KB
          let offset = 0;

          while (offset < buffer.length) {
            const chunk = buffer.subarray(offset, offset + chunkSize);
            const header = Buffer.alloc(4);
            header.writeUInt32BE(chunk.length, 0);
            socket.write(header);
            socket.write(chunk);
            offset += chunk.length;
          }

          // Terminate stream with 4 zero bytes
          const term = Buffer.alloc(4, 0);
          socket.write(term);
        } catch (err: any) {
          this.logger.error(`Error sending stream to ClamAV: ${err.message}`);
          socket.destroy();
          safeResolve({ status: 'FAILED', error: err.message });
        }
      });

      socket.on('data', (data) => {
        response += data.toString('utf8');
      });

      socket.on('end', () => {
        socket.destroy();
        const trimmed = response.trim();
        if (/stream:\s*OK/i.test(trimmed)) {
          safeResolve({ status: 'PASSED' });
        } else {
          const foundMatch = trimmed.match(/stream:\s*(.+?)\s+FOUND/i);
          if (foundMatch) {
            this.logger.warn(`Malware detected: ${foundMatch[1]}`);
            safeResolve({ status: 'FAILED', virus: foundMatch[1] });
          } else {
            safeResolve({ status: 'FAILED', error: trimmed || 'Unknown scanner response' });
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        this.logger.warn('ClamAV scan timed out');
        safeResolve({ status: 'FAILED', error: 'Scan timed out' });
      });

      socket.on('error', (err: any) => {
        socket.destroy();
        this.logger.warn(`ClamAV connection error: ${err.message}`);
        safeResolve({ status: 'FAILED', error: err.message });
      });
    });
  }
}
