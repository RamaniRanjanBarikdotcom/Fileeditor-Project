const test = require('node:test');
const assert = require('node:assert/strict');
const { ProcessingRouter, createProcessingContext } = require('../dist');

const engine = (id, location, accepts = true) => ({
  id, location,
  async canProcess() { return accepts; },
  async process() { return { success: true, engine: id, processingLocation: location, durationMs: 1 }; },
});

test('browser-preferred operation remains local when available', async () => {
  const router = new ProcessingRouter([engine('browser', 'BROWSER'), engine('native', 'NATIVE')]);
  const selected = await router.resolve({
    operation: 'image.toPdf',
    files: [{ name: 'a.png', extension: 'png', sizeBytes: 10 }],
    options: {},
  }, createProcessingContext({ DEPLOYMENT_MODE: 'DOCKER_NATIVE' }));
  assert.equal(selected.id, 'browser');
});

test('explicit browser request never silently uploads to native', async () => {
  const router = new ProcessingRouter([engine('browser', 'BROWSER', false), engine('native', 'NATIVE')]);
  await assert.rejects(() => router.resolve({
    operation: 'image.toPdf', requestedLocation: 'BROWSER',
    files: [{ name: 'a.png', extension: 'png', sizeBytes: 10 }], options: {},
  }, createProcessingContext({ DEPLOYMENT_MODE: 'DOCKER_NATIVE' })), /No enabled processing engine/);
});
