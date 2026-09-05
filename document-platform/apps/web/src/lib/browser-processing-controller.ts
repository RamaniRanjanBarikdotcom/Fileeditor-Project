import type { BrowserProcessingOutput } from './browser-processing-engine';
import { processInBrowser } from './browser-processing-engine';

interface ActiveBrowserTask {
  worker: Worker;
  reject: (reason: Error) => void;
}

let activeTask: ActiveBrowserTask | null = null;

export async function processInBrowserWorker(
  operation: string,
  files: File[],
  options: Record<string, unknown>,
): Promise<BrowserProcessingOutput> {
  if (typeof Worker === 'undefined') return processInBrowser(operation, files, options);
  if (activeTask) throw new Error('Another private browser conversion is already running.');

  return new Promise<BrowserProcessingOutput>((resolve, reject) => {
    const worker = new Worker(new URL('./browser-processing.worker.ts', import.meta.url), {
      type: 'module',
    });
    const id = crypto.randomUUID();
    activeTask = { worker, reject };

    const finish = () => {
      worker.terminate();
      activeTask = null;
    };
    worker.onmessage = (event: MessageEvent<{ id: string; result: BrowserProcessingOutput }>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data.result);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || 'The private browser worker failed.'));
    };
    worker.postMessage({ id, operation, files, options });
  });
}

export function cancelBrowserProcessing(): boolean {
  if (!activeTask) return false;
  const task = activeTask;
  activeTask = null;
  task.worker.terminate();
  task.reject(new Error('The conversion was cancelled.'));
  return true;
}
