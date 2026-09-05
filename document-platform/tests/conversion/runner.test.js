const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { ConversionClient } = require('./client');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

test('Baseline Conversion Test Runner', async (t) => {
  const client = new ConversionClient();

  await t.test('Authentication', async () => {
    await client.loginOrRegister();
    assert.ok(client.token, 'Client should receive an authentication token');
  });

  // HTML -> PDF
  await t.test('Convert HTML to PDF', async () => {
    const filePath = path.join(FIXTURES_DIR, 'html', 'basic.html');
    const sourceFileId = await client.uploadFile(filePath, 'html');
    assert.ok(sourceFileId, 'Should receive a sourceFileId after upload');

    const conversionId = await client.startConversion(sourceFileId, 'pdf');
    assert.ok(conversionId, 'Should receive a conversionId');

    await client.waitForCompletion(conversionId);
    const outputBuffer = await client.downloadResult(conversionId);

    assert.ok(outputBuffer.length > 0, 'Output PDF should not be empty');

    // Check PDF magic bytes (%PDF-)
    const signature = outputBuffer.slice(0, 5).toString('utf-8');
    assert.strictEqual(signature, '%PDF-', 'Output file should be a valid PDF');
  });

  // Markdown -> PDF
  await t.test('Convert Markdown to PDF', async () => {
    const filePath = path.join(FIXTURES_DIR, 'markdown', 'basic.md');
    const sourceFileId = await client.uploadFile(filePath, 'markdown');
    const conversionId = await client.startConversion(sourceFileId, 'pdf');

    await client.waitForCompletion(conversionId);
    const outputBuffer = await client.downloadResult(conversionId);

    assert.ok(outputBuffer.length > 0, 'Output PDF should not be empty');

    const signature = outputBuffer.slice(0, 5).toString('utf-8');
    assert.strictEqual(signature, '%PDF-', 'Output file should be a valid PDF');
  });

  await t.test('Convert PDF to DOCX with a structurally valid result', async () => {
    const sourceFileId = await client.uploadFile(path.join(FIXTURES_DIR, 'pdf', 'basic.pdf'), 'pdf');
    const conversionId = await client.startConversion(sourceFileId, 'docx');
    await client.waitForCompletion(conversionId, 180000);
    const outputBuffer = await client.downloadResult(conversionId);
    assert.strictEqual(outputBuffer.subarray(0, 2).toString('ascii'), 'PK');
    assert.ok(outputBuffer.includes(Buffer.from('word/document.xml')));
  });

  await t.test('Convert CSV to a parseable XLSX package', async () => {
    const sourceFileId = await client.uploadFile(path.join(FIXTURES_DIR, 'csv', 'basic.csv'), 'csv');
    const conversionId = await client.startConversion(sourceFileId, 'xlsx');
    await client.waitForCompletion(conversionId, 120000);
    const outputBuffer = await client.downloadResult(conversionId);
    assert.strictEqual(outputBuffer.subarray(0, 2).toString('ascii'), 'PK');
    assert.ok(outputBuffer.includes(Buffer.from('xl/workbook.xml')));
  });
});
