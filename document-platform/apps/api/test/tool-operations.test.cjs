const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { toolSettings } = require('../dist/tools/anonymous-tools.service');

test('the executed tool, not the client, decides the server PDF operation', () => {
  // A client cannot run OCR (or any other operation) through a different tool.
  assert.equal(toolSettings('compress-pdf', { pdfOperation: 'pdf.ocrSearchable' }).pdfOperation, 'pdf.compress');
  assert.equal('pdfOperation' in toolSettings('pdf-to-docx', { pdfOperation: 'pdf.ocrSearchable' }), false);
  assert.equal('pdfOperation' in toolSettings('unknown-tool', { pdfOperation: 'pdf.unlock' }), false);
});

test('other tool settings pass through unchanged', () => {
  assert.deepEqual(
    toolSettings('redact-pdf', { operationOptions: { redactTerms: 'secret' }, pageSize: 'A4' }),
    { operationOptions: { redactTerms: 'secret' }, pageSize: 'A4', pdfOperation: 'pdf.redact' },
  );
  assert.deepEqual(toolSettings('url-to-pdf', undefined), {});
});
