const test = require('node:test');
const assert = require('node:assert/strict');
const { conversionRouter } = require('@docconv/conversion-router');

test('normalizes markdown aliases consistently', () => {
  assert.equal(conversionRouter.normalizeFormat('md'), 'markdown');
  assert.equal(conversionRouter.normalizeFormat('.MD'), 'markdown');
});

test('routes the verified HTML to PDF path through Chromium', () => {
  const route = conversionRouter.findAdapter('html', 'pdf');
  assert.ok(route);
  assert.equal(route.engine, 'chromium');
  assert.equal(conversionRouter.getQueueName(route.engine), 'conversion-html');
});

test('rejects conversion pairs that are not implemented', () => {
  assert.equal(conversionRouter.isSupported('json', 'docx'), false);
});

test('routes PDF to editable Word through the PDF extractor', () => {
  const route = conversionRouter.findAdapter('pdf', 'docx');
  assert.ok(route);
  assert.equal(route.engine, 'pdf-extractor');
  assert.equal(conversionRouter.getQueueName(route.engine), 'conversion-pdf');
});

test('routes URL to Word through Chromium before extraction', () => {
  const route = conversionRouter.findAdapter('url', 'docx');
  assert.ok(route);
  assert.equal(route.engine, 'chromium');
});
