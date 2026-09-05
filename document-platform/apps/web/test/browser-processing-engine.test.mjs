import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  estimateLocalProcessingBytes,
  processInBrowser,
} from '../src/lib/browser-processing-engine.ts';

async function pdfFile(name, pages) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage([300, 400]);
  return new File([await document.save()], name, { type: 'application/pdf' });
}

async function pageCount(blob) {
  return (await PDFDocument.load(await blob.arrayBuffer())).getPageCount();
}

test('browser router merges PDFs and preserves every page', async () => {
  const result = await processInBrowser(
    'pdf.merge',
    [await pdfFile('one.pdf', 2), await pdfFile('two.pdf', 3)],
    {},
  );
  assert.equal(result.success, true);
  assert.equal(result.processingLocation, 'BROWSER');
  assert.equal(await pageCount(result.blobs[0].blob), 5);
});

test('multiple PNG images become a multi-page PDF', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const result = await processInBrowser(
    'image.toPdf',
    [new File([png], 'one.png', { type: 'image/png' }), new File([png], 'two.png', { type: 'image/png' })],
    { pageSize: 'Letter', orientation: 'landscape' },
  );
  assert.equal(result.success, true);
  assert.equal(await pageCount(result.blobs[0].blob), 2);
});

test('split, extract, and delete operations produce valid page counts', async () => {
  const source = await pdfFile('source.pdf', 4);
  const split = await processInBrowser('pdf.split', [source], {});
  assert.equal(split.blobs.length, 4);
  assert.deepEqual(await Promise.all(split.blobs.map((item) => pageCount(item.blob))), [1, 1, 1, 1]);

  const extracted = await processInBrowser('pdf.extractPages', [source], { pages: '1-2,4' });
  assert.equal(await pageCount(extracted.blobs[0].blob), 3);

  const deleted = await processInBrowser('pdf.deletePages', [source], { pages: '2,4' });
  assert.equal(await pageCount(deleted.blobs[0].blob), 2);
});

test('rotation, watermark, numbering, and metadata operations remain parseable', async () => {
  const source = await pdfFile('source.pdf', 2);
  for (const [operation, options] of [
    ['pdf.rotate', { rotation: 90 }],
    ['pdf.watermark', { watermarkText: 'PRIVATE' }],
    ['pdf.addPageNumbers', {}],
    ['pdf.editMetadata', { title: 'Quarterly report', author: 'AppToolkitLab' }],
  ]) {
    const result = await processInBrowser(operation, [source], options);
    assert.equal(result.success, true, `${operation} should succeed`);
    assert.equal(await pageCount(result.blobs[0].blob), 2);
  }
});

test('invalid page ranges and deleting all pages fail safely', async () => {
  const source = await pdfFile('source.pdf', 2);
  const invalid = await processInBrowser('pdf.extractPages', [source], { pages: '3' });
  assert.equal(invalid.success, false);
  assert.match(invalid.error.message, /between 1 and 2/);

  const empty = await processInBrowser('pdf.deletePages', [source], { pages: '1-2' });
  assert.equal(empty.success, false);
  assert.match(empty.error.message, /At least one page/);
});

test('browser memory estimation accounts for aggregate inputs and operation overhead', () => {
  const tenMiB = 10 * 1024 * 1024;
  assert.equal(
    estimateLocalProcessingBytes('pdf.merge', [{ size: tenMiB }, { size: tenMiB }]),
    132 * 1024 * 1024,
  );
  assert.equal(
    estimateLocalProcessingBytes('image.toPdf', [{ size: tenMiB }]),
    112 * 1024 * 1024,
  );
});
