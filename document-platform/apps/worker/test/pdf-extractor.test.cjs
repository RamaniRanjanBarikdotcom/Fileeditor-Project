const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const JSZip = require('jszip');
const { PdfExtractorAdapter, extractedTextToMarkdown } = require('../dist/adapters/pdf-extractor');
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

test('creates an exact-visual DOCX containing a rendered image for every PDF page', async (t) => {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'ignore' });
  } catch {
    t.skip('pdftoppm is not installed on this test host');
    return;
  }
  const output = await toBuffer(
    await new PdfExtractorAdapter().convert(Readable.from(fixture), 'docx', {
      pdfFidelityMode: 'visual',
    }),
  );
  await validateOutputBuffer(output, 'docx');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-docx-test-'));
  const outputPath = path.join(directory, 'visual.docx');
  try {
    fs.writeFileSync(outputPath, output);
    const listing = execFileSync('unzip', ['-l', outputPath], { encoding: 'utf8' });
    assert.match(listing, /word\/media\/.*\.png/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('renders every PDF page to validated PNG and JPG archives with Poppler', async (t) => {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'ignore' });
  } catch {
    t.skip('pdftoppm is not installed on this test host');
    return;
  }

  for (const imageFormat of ['png', 'jpg']) {
    const output = await toBuffer(
      await new PdfExtractorAdapter().convert(Readable.from(fixture), 'zip', {
        imageFormat,
        imageDpi: 150,
      }),
    );
    await validateOutputBuffer(output, 'zip');
    const archive = await JSZip.loadAsync(output);
    const entries = Object.values(archive.files).filter((entry) => !entry.dir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, `page-001.${imageFormat}`);
    const image = await entries[0].async('nodebuffer');
    if (imageFormat === 'png') {
      assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    } else {
      assert.equal(image.subarray(0, 2).toString('hex'), 'ffd8');
    }
  }
});

test('creates a fixed-position DOCX with individually editable PDF text boxes', async () => {
  const output = await toBuffer(
    await new PdfExtractorAdapter().convert(Readable.from(fixture), 'docx', {
      pdfFidelityMode: 'fixed',
    }),
  );
  await validateOutputBuffer(output, 'docx');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixed-docx-test-'));
  const outputPath = path.join(directory, 'fixed.docx');
  try {
    fs.writeFileSync(outputPath, output);
    const documentXml = execFileSync('unzip', ['-p', outputPath, 'word/document.xml'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.match(documentXml, /<v:textbox/);
    assert.match(documentXml, /<v:shapetype[^>]+id="_x0000_t202"/);
    assert.match(documentXml, /AppToolkitLab PDF conversion fixture/);
    assert.match(documentXml, /behindDoc="1"/);
    assert.ok(
      documentXml.indexOf('<wp:extent') < documentXml.indexOf('<wp:wrapNone'),
      'Word requires wp:wrapNone to follow wp:extent inside wp:anchor',
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('normalizes extracted PDF content into readable Markdown', () => {
  const markdown = extractedTextToMarkdown(
    'PROJECT OVERVIEW\n\n• First capability\n2) Second capability\n\fNEXT PAGE\n\nDetails here.',
  );
  assert.match(markdown, /## Page 1/);
  assert.match(markdown, /### PROJECT OVERVIEW/);
  assert.match(markdown, /- First capability/);
  assert.match(markdown, /2\. Second capability/);
  assert.match(markdown, /## Page 2/);
});
