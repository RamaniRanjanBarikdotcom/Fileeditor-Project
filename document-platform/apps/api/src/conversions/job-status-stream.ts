import { MessageEvent } from '@nestjs/common';
import {
  Observable,
  distinctUntilChanged,
  from,
  interval,
  map,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']);

type JobStatusSnapshot = {
  status: string;
  progress: number | null;
  errorMessage: string | null;
  outputFileId: string | null;
};

/**
 * Emits a conversion job's status as SSE `progress` events whenever it
 * changes, polling the database once per second, and completes after the
 * first terminal status. The subscription (and polling) stops when the
 * client disconnects.
 */
export function jobStatusStream<T extends JobStatusSnapshot>(
  loadStatus: () => Promise<T>,
): Observable<MessageEvent> {
  return interval(1_000).pipe(
    startWith(0),
    switchMap(() => from(loadStatus())),
    distinctUntilChanged(
      (previous, current) =>
        previous.status === current.status &&
        previous.progress === current.progress &&
        previous.errorMessage === current.errorMessage &&
        previous.outputFileId === current.outputFileId,
    ),
    takeWhile((job) => !TERMINAL_STATUSES.has(String(job.status)), true),
    map((job) => ({ type: 'progress', data: job }) as MessageEvent),
  );
}
