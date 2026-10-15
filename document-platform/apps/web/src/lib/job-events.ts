import { fetchWithAuth, getAccessToken, restoreAccessToken, setAccessToken } from './api';
import { parseSseEvents } from './sse';

export const TERMINAL_JOB_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']);

export interface JobStatusEvent {
  status: string;
  progress?: number;
  errorMessage?: string | null;
  outputFilename?: string | null;
  [key: string]: unknown;
}

/** A stream failure that reconnecting cannot fix (missing job, lost session). */
export class JobEventsError extends Error {}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Follows a conversion job's progress stream until it reaches a terminal
 * status. Dropped connections and transient server errors are reconnected;
 * an expired access token is refreshed once per failure. Resolves with the
 * terminal status, and rejects when `signal` aborts or the job is unavailable.
 */
export async function followJobEvents(
  path: string,
  options: {
    signal: AbortSignal;
    onStatus?: (status: JobStatusEvent) => void | Promise<void>;
    reconnectDelayMs?: number;
  },
): Promise<JobStatusEvent> {
  const { signal, onStatus, reconnectDelayMs = 1_000 } = options;
  await restoreAccessToken();

  while (!signal.aborted) {
    try {
      let response = await fetchWithAuth(path, {
        headers: { Accept: 'text/event-stream' },
        signal,
      });
      if (response.status === 401 && getAccessToken()) {
        setAccessToken(null);
        if (!(await restoreAccessToken())) {
          throw new JobEventsError('Your session expired. Sign in again to follow this job.');
        }
        response = await fetchWithAuth(path, { headers: { Accept: 'text/event-stream' }, signal });
      }
      if ([401, 403, 404].includes(response.status)) {
        throw new JobEventsError('This conversion is no longer available.');
      }
      if (!response.ok || !response.body) {
        throw new Error(`Progress stream returned HTTP ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.rest;
        for (const payload of parsed.payloads) {
          const status = payload as JobStatusEvent;
          await onStatus?.(status);
          if (TERMINAL_JOB_STATUSES.has(status.status)) {
            await reader.cancel().catch(() => undefined);
            return status;
          }
        }
      }
    } catch (error) {
      if (signal.aborted || error instanceof JobEventsError) throw error;
      // Network drop or transient server error: reconnect below.
    }
    await wait(reconnectDelayMs, signal);
  }
  throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}
