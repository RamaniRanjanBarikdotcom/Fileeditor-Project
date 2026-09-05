const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateOutputBuffer } = require('../dist/output-validator');

const fixtures = path.resolve(__dirname, '../../../tests/fixtures');

for (const [format, relative] of [
  ['pdf', 'pdf/basic.pdf'],
  ['docx', 'docx/basic.docx'],
  ['xlsx', 'xlsx/basic.xlsx'],
  ['png', 'images/test.png'],
]) {
  test(`accepts structurally valid ${format} fixture`, async () => {
    await validateOutputBuffer(fs.readFileSync(path.join(fixtures, relative)), format);
  });
}

test('rejects fake ZIP files masquerading as DOCX', async () => {
  await assert.rejects(() => validateOutputBuffer(Buffer.from('PK\x03\x04not-a-docx'), 'docx'), /valid DOCX/);
});

test('rejects signature-only invalid PDF output', async () => {
  await assert.rejects(() => validateOutputBuffer(Buffer.from('%PDF-not-a-document'), 'pdf'), /cannot be parsed/);
});
