const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { PDFDocument } = require('pdf-lib');
const { ImagePdfAdapter } = require('../dist/adapters/image-pdf');

const image = fs.readFileSync(path.resolve(__dirname, '../../../tests/fixtures/images/test.png'));
const toBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

test('fits image on an A4 portrait page', async () => {
  const output = await toBuffer(await new ImagePdfAdapter().convert(Readable.from(image), 'png', {
    pageSize: 'A4', orientation: 'portrait',
  }));
  const pdf = await PDFDocument.load(output);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.1);
  assert.ok(Math.abs(height - 841.89) < 0.1);
});

test('applies landscape orientation', async () => {
  const output = await toBuffer(await new ImagePdfAdapter().convert(Readable.from(image), 'png', {
    pageSize: 'Letter', orientation: 'landscape',
  }));
  const pdf = await PDFDocument.load(output);
  const { width, height } = pdf.getPage(0).getSize();
  assert.equal(width, 792);
  assert.equal(height, 612);
});
