const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { PdfExtractorAdapter } = require('../dist/adapters/pdf-extractor');
const { validateOutputBuffer } = require('../dist/output-validator');

const fixture = fs.readFileSync(path.resolve(__dirname, '../../../tests/fixtures/pdf/basic.pdf'));
const toBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

test('extracts readable text from a digital PDF', async () => {
  const output = await toBuffer(await new PdfExtractorAdapter().convert(Readable.from(fixture), 'txt'));
  assert.match(output.toString('utf8'), /AppToolkitLab PDF conversion fixture/);
});

test('creates a structurally valid editable DOCX from a digital PDF', async () => {
  const output = await toBuffer(await new PdfExtractorAdapter().convert(Readable.from(fixture), 'docx'));
  await validateOutputBuffer(output, 'docx');
  assert.ok(output.length > 1000);
});
