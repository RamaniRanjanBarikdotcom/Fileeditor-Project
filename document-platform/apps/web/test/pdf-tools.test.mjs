import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { processInBrowser } from '../src/lib/browser-processing-engine.ts';

const ENCRYPTED = new URL('../../../tests/fixtures/pdf/encrypted-aes256.pdf', import.meta.url);

async function makePdf(pages, { rotate = 0, text = (index) => `Page ${index + 1}`, size = [595, 842] } = {}) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = document.addPage(size);
    page.drawText(text(index), { x: 72, y: size[1] - 100, size: 18, font });
    if (rotate) page.setRotation({ type: 'degrees', angle: rotate });
  }
  return new File([await document.save()], 'sample.pdf', { type: 'application/pdf' });
}

async function run(operation, files, options = {}) {
  const result = await processInBrowser(operation, files, options);
  assert.equal(result.success, true, result.error?.message);
  return result;
}

const load = async (output) => PDFDocument.load(await output.blob.arrayBuffer());

test('password-protected input gets an actionable message', async () => {
  const locked = new File([fs.readFileSync(ENCRYPTED)], 'locked.pdf', { type: 'application/pdf' });
  const result = await processInBrowser('pdf.merge', [await makePdf(1), locked], {});
  assert.equal(result.success, false);
  assert.match(result.error.message, /password-protected.*Unlock PDF/);
});

test('split supports custom ranges and every N pages', async () => {
  const source = await makePdf(5);
  const ranges = await run('pdf.split', [source], { splitMode: 'ranges', ranges: '1-2,3-5' });
  assert.deepEqual(
    await Promise.all(ranges.blobs.map(async (output) => (await load(output)).getPageCount())),
    [2, 3],
  );
  assert.equal(ranges.blobs[1].name, 'sample-pages-3-5.pdf');
  const everyTwo = await run('pdf.split', [source], { splitMode: 'everyN', everyN: '2' });
  assert.deepEqual(
    await Promise.all(everyTwo.blobs.map(async (output) => (await load(output)).getPageCount())),
    [2, 2, 1],
  );
});

test('rotate only touches the selected pages', async () => {
  const result = await run('pdf.rotate', [await makePdf(4)], { rotation: '90', pages: '2,4' });
  const angles = (await load(result.blobs[0])).getPages().map((page) => page.getRotation().angle);
  assert.deepEqual(angles, [0, 90, 0, 90]);
});

test('2-up places portrait pages side by side on a landscape sheet', async () => {
  const result = await run('pdf.nUp', [await makePdf(4)], { pagesPerSheet: '2', pageSize: 'A4' });
  const sheet = (await load(result.blobs[0])).getPage(0);
  assert.ok(sheet.getWidth() > sheet.getHeight(), 'sheet should be landscape');
});

test('watermark, page numbers, header/footer and Bates accept their options', async () => {
  const source = await makePdf(3, { rotate: 90 });
  for (const [operation, options] of [
    ['pdf.watermark', { watermarkText: 'DRAFT', watermarkOpacity: '50', watermarkAngle: '30', watermarkColor: '#cc0000', pages: '1-2' }],
    ['pdf.watermark', { watermarkText: 'DRAFT', watermarkPosition: 'top-right' }],
    ['pdf.addPageNumbers', { numberPosition: 'top-right', numberFormat: 'Page {n} of {total}', startNumber: '5' }],
    ['pdf.headerFooter', { headerText: 'Café – {page}/{pages}', textAlign: 'left' }],
    ['pdf.batesNumbering', { batesPrefix: 'ABC', batesPosition: 'top-left' }],
  ]) {
    const result = await run(operation, [source], options);
    assert.equal((await load(result.blobs[0])).getPageCount(), 3, operation);
  }
});

test('split in half doubles the pages and halves their width', async () => {
  const result = await run('pdf.splitHalf', [await makePdf(2, { size: [842, 595] })], {
    splitDirection: 'vertical',
  });
  const output = await load(result.blobs[0]);
  assert.equal(output.getPageCount(), 4);
  assert.equal(Math.round(output.getPage(0).getWidth()), 421);
});

test('split by size keeps every part under the limit', async () => {
  // Pages with incompressible content so each is roughly 120 KB.
  const document = await PDFDocument.create();
  for (let index = 0; index < 6; index += 1) {
    const page = document.addPage([300, 300]);
    const noise = new Uint8Array(120_000).map(() => Math.floor(Math.random() * 256));
    const stream = document.context.stream(noise);
    page.node.set(PDFName.of('PieceInfo'), document.context.register(stream));
  }
  const source = new File([await document.save()], 'big.pdf', { type: 'application/pdf' });
  const result = await run('pdf.splitBySize', [source], { maxSizeMb: '0.5' });
  assert.ok(result.blobs.length >= 2, `expected several parts, got ${result.blobs.length}`);
  for (const output of result.blobs) assert.ok(output.blob.size <= 0.5 * 1024 * 1024);
  const pages = await Promise.all(result.blobs.map(async (output) => (await load(output)).getPageCount()));
  assert.equal(pages.reduce((a, b) => a + b, 0), 6);
});

test('split by text starts a new PDF at each matching page', async () => {
  const titles = ['Intro', 'Chapter one', 'more', 'Chapter two', 'end'];
  const result = await run('pdf.splitByText', [await makePdf(5, { text: (index) => titles[index] })], {
    splitText: 'chapter',
  });
  assert.deepEqual(
    await Promise.all(result.blobs.map(async (output) => (await load(output)).getPageCount())),
    [1, 2, 2],
  );
});

test('bookmarks added by one tool split correctly with another', async () => {
  const bookmarked = await run('pdf.addBookmarks', [await makePdf(6)], {
    bookmarks: 'Introduction, 1\nMethods | 3\nResults: 5',
  });
  const file = new File([await bookmarked.blobs[0].blob.arrayBuffer()], 'book.pdf', {
    type: 'application/pdf',
  });
  const split = await run('pdf.splitByBookmarks', [file]);
  assert.deepEqual(
    split.blobs.map((output) => output.name),
    ['01-Introduction.pdf', '02-Methods.pdf', '03-Results.pdf'],
  );
  assert.deepEqual(
    await Promise.all(split.blobs.map(async (output) => (await load(output)).getPageCount())),
    [2, 2, 2],
  );
});

test('remove annotations keeps links and form fields', async () => {
  const document = await PDFDocument.load(await (await makePdf(1)).arrayBuffer());
  const page = document.getPage(0);
  const annotation = (subtype) =>
    document.context.register(
      document.context.obj({ Type: 'Annot', Subtype: subtype, Rect: [10, 10, 50, 50] }),
    );
  page.node.set(
    PDFName.of('Annots'),
    document.context.obj([annotation('Highlight'), annotation('Text'), annotation('Link')]),
  );
  const source = new File([await document.save()], 'annotated.pdf', { type: 'application/pdf' });
  const result = await run('pdf.removeAnnotations', [source], { keepLinks: 'yes' });
  const annots = (await load(result.blobs[0])).getPage(0).node.Annots();
  assert.equal(annots?.size(), 1);
});

test('flip mirrors pages without losing any', async () => {
  const result = await run('pdf.flip', [await makePdf(3)], { flipDirection: 'vertical', pages: '2' });
  assert.equal((await load(result.blobs[0])).getPageCount(), 3);
});

test('PDF to text extracts each page', async () => {
  const result = await run('pdf.toText', [await makePdf(2, { text: (index) => `Hello page ${index + 1}` })]);
  const text = await result.blobs[0].blob.text();
  assert.match(text, /--- Page 1 ---\nHello page 1/);
  assert.match(text, /--- Page 2 ---\nHello page 2/);
});
