/// <reference lib="webworker" />

import { processInBrowser } from './browser-processing-engine';

interface WorkerRequest {
  id: string;
  operation: string;
  files: File[];
  options: Record<string, unknown>;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, operation, files, options } = event.data;
  const result = await processInBrowser(operation, files, options);
  self.postMessage({ id, result });
};

export {};
