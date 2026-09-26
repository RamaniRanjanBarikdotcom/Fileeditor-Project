import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  containsMissingGlyphIndicators,
  estimateLocalProcessingBytes,
  processInBrowser,
} from '../src/lib/browser-processing-engine.ts';
import { PDFJS_DOCUMENT_OPTIONS } from '../src/lib/pdfjs-config.mjs';

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
    [
      new File([png], 'one.png', { type: 'image/png' }),
      new File([png], 'two.png', { type: 'image/png' }),
    ],
    { pageSize: 'Letter', orientation: 'landscape' },
  );
  assert.equal(result.success, true);
  assert.equal(await pageCount(result.blobs[0].blob), 2);
});

test('split, extract, and delete operations produce valid page counts', async () => {
  const source = await pdfFile('source.pdf', 4);
  const split = await processInBrowser('pdf.split', [source], {});
  assert.equal(split.blobs.length, 4);
  assert.deepEqual(
    await Promise.all(split.blobs.map((item) => pageCount(item.blob))),
    [1, 1, 1, 1],
  );

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

test('organize preserves requested order and supports duplicate pages', async () => {
  const source = await pdfFile('source.pdf', 3);
  const result = await processInBrowser('pdf.organize', [source], { pageOrder: '3,1,2,2' });
  assert.equal(result.success, true);
  assert.equal(await pageCount(result.blobs[0].blob), 4);
});

test('alternate mix interleaves unequal documents without losing pages', async () => {
  const result = await processInBrowser(
    'pdf.alternateMix',
    [await pdfFile('odd.pdf', 3), await pdfFile('even.pdf', 2)],
    {},
  );
  assert.equal(result.success, true);
  assert.equal(await pageCount(result.blobs[0].blob), 5);
});

test('crop validates margins and changes the visible page box', async () => {
  const source = await pdfFile('source.pdf', 1);
  const result = await processInBrowser('pdf.crop', [source], {
    cropTop: 10,
    cropRight: 20,
    cropBottom: 30,
    cropLeft: 40,
  });
  assert.equal(result.success, true);
  const output = await PDFDocument.load(await result.blobs[0].blob.arrayBuffer());
  assert.deepEqual(output.getPage(0).getCropBox(), { x: 40, y: 30, width: 240, height: 360 });
});

test('resize and N-up create the requested standard-sized sheets', async () => {
  const source = await pdfFile('source.pdf', 5);
  const resized = await processInBrowser('pdf.resize', [source], {
    pageSize: 'A4',
    orientation: 'portrait',
    marginPoints: 18,
  });
  assert.equal(resized.success, true);
  const resizedPdf = await PDFDocument.load(await resized.blobs[0].blob.arrayBuffer());
  assert.equal(resizedPdf.getPageCount(), 5);
  assert.ok(Math.abs(resizedPdf.getPage(0).getWidth() - 595.28) < 0.01);

  const nUp = await processInBrowser('pdf.nUp', [source], {
    pagesPerSheet: 4,
    pageSize: 'Letter',
    orientation: 'landscape',
    gutterPoints: 12,
  });
  assert.equal(nUp.success, true);
  const nUpPdf = await PDFDocument.load(await nUp.blobs[0].blob.arrayBuffer());
  assert.equal(nUpPdf.getPageCount(), 2);
  assert.equal(nUpPdf.getPage(0).getWidth(), 792);
  assert.equal(nUpPdf.getPage(0).getHeight(), 612);
});

test('header/footer and Bates numbering keep documents parseable', async () => {
  const source = await pdfFile('source.pdf', 3);
  const headerFooter = await processInBrowser('pdf.headerFooter', [source], {
    headerText: 'Case file',
    footerText: 'Page {page} of {pages}',
  });
  assert.equal(headerFooter.success, true);
  assert.equal(await pageCount(headerFooter.blobs[0].blob), 3);

  const bates = await processInBrowser('pdf.batesNumbering', [source], {
    batesPrefix: 'CASE-',
    batesStart: 42,
    batesPadding: 6,
  });
  assert.equal(bates.success, true);
  assert.equal(await pageCount(bates.blobs[0].blob), 3);
});

test('form flattening removes supported interactive fields', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  const field = document.getForm().createTextField('customer.name');
  field.setText('AppToolkitLab');
  field.addToPage(page, { x: 30, y: 320, width: 180, height: 24 });
  const source = new File([await document.save()], 'form.pdf', { type: 'application/pdf' });
  const result = await processInBrowser('pdf.flattenForms', [source], {});
  assert.equal(result.success, true);
  const output = await PDFDocument.load(await result.blobs[0].blob.arrayBuffer());
  assert.equal(output.getForm().getFields().length, 0);
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
  assert.equal(estimateLocalProcessingBytes('image.toPdf', [{ size: tenMiB }]), 112 * 1024 * 1024);
});

test('PDF.js has the runtime resources required for faithful font rendering', () => {
  assert.deepEqual(PDFJS_DOCUMENT_OPTIONS, {
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: true,
  });
});

test('missing glyph indicators trigger the server-renderer safety path', () => {
  assert.equal(containsMissingGlyphIndicators('Normal multilingual text नमस्ते مرحبا 你好'), false);
  assert.equal(containsMissingGlyphIndicators('Broken \uFFFD text'), true);
  assert.equal(containsMissingGlyphIndicators('Missing □□□ font'), true);
  assert.equal(containsMissingGlyphIndicators('Font .notdef entry'), true);
});
