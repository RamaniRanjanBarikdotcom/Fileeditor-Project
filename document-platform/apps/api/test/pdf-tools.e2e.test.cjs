// Live end-to-end test of the server PDF tools (requires `corepack pnpm start`).
// Each tool runs through the public tool API and its real output is inspected.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const API_URL = process.env.API_URL || 'http://localhost:4201/api/v1';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';
const FIXTURES = path.resolve(__dirname, '../../../tests/fixtures');

let token;

function hasPdftotext() {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pdfText(buffer) {
  const file = path.join(require('node:os').tmpdir(), `pdf-tools-${process.pid}-${Date.now()}.pdf`);
  fs.writeFileSync(file, buffer);
  try {
    return execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function runTool(slug, { fixture, buffer, name, operation, options = {}, password, targetFormat }) {
  const form = new FormData();
  const bytes = buffer ?? fs.readFileSync(path.join(FIXTURES, fixture));
  form.set('file', new Blob([bytes]), name ?? path.basename(fixture));
  if (targetFormat) form.set('targetFormat', targetFormat);
  form.set(
    'settings',
    JSON.stringify(operation ? { pdfOperation: operation, operationOptions: options } : {}),
  );
  if (password) form.set('password', password);
  const headers = { Origin: ORIGIN, Authorization: `Bearer ${token}` };
  const created = await (
    await fetch(`${API_URL}/tools/${slug}/execute`, { method: 'POST', headers, body: form })
  ).json();
  assert.equal(created.success, true, JSON.stringify(created));
  let status;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const polled = await fetch(`${API_URL}/tools/jobs/${created.data.id}`, { headers });
    if (polled.status !== 200) throw new Error(`status poll ${polled.status}: ${await polled.text()}`);
    status = (await polled.json()).data;
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (status.status !== 'COMPLETED') return { status };
  const link = await (
    await fetch(`${API_URL}/tools/jobs/${created.data.id}/download-url`, { method: 'POST', headers })
  ).json();
  const output = Buffer.from(await (await fetch(link.data.url)).arrayBuffer());
  return { status, output };
}

test.before(async () => {
  const email = `pdf-tools-${Date.now()}@example.com`;
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password: 'PdfTools-2026-pass', firstName: 'Pdf', lastName: 'Tools' }),
  });
  token = (await response.json()).data.accessToken;
  assert.ok(token, 'registration failed');
});

test('compress returns a valid, smaller PDF', async () => {
  const input = fs.readFileSync(path.join(FIXTURES, 'pdf/pii-table-image.pdf'));
  const { status, output } = await runTool('compress-pdf', {
    fixture: 'pdf/pii-table-image.pdf',
    operation: 'pdf.compress',
    options: { compressionLevel: 'extreme' },
  });
  assert.equal(status.status, 'COMPLETED', status.errorMessage);
  assert.equal(output.subarray(0, 5).toString(), '%PDF-');
  assert.ok(output.length <= input.length);
  assert.match(status.outputFilename, /-compressed\.pdf$/);
});

test('protect encrypts and unlock removes the password', async () => {
  const locked = await runTool('protect-pdf', {
    fixture: 'pdf/basic.pdf',
    operation: 'pdf.protect',
    options: { allowPrinting: 'yes' },
    password: 'opensesame',
  });
  assert.equal(locked.status.status, 'COMPLETED', locked.status.errorMessage);
  assert.ok(locked.output.includes('/Encrypt'), 'protected PDF must be encrypted');

  const wrong = await runTool('unlock-pdf', {
    buffer: locked.output,
    name: 'locked.pdf',
    operation: 'pdf.unlock',
    password: 'not-the-password',
  });
  assert.equal(wrong.status.status, 'FAILED');
  assert.equal(wrong.status.errorMessage, 'The password is incorrect.');

  const unlocked = await runTool('unlock-pdf', {
    buffer: locked.output,
    name: 'locked.pdf',
    operation: 'pdf.unlock',
    password: 'opensesame',
  });
  assert.equal(unlocked.status.status, 'COMPLETED', unlocked.status.errorMessage);
  assert.ok(!unlocked.output.includes('/Encrypt'), 'unlocked PDF must not be encrypted');
});

test('redaction removes the matching text from the file', async () => {
  const { status, output } = await runTool('redact-pdf', {
    fixture: 'pdf/pii-table-image.pdf',
    operation: 'pdf.redact',
    options: { redactTerms: 'NIGHTJAR', redactEmails: 'yes', redactPhones: 'yes' },
  });
  assert.equal(status.status, 'COMPLETED', status.errorMessage);
  if (hasPdftotext()) {
    const text = pdfText(output);
    assert.ok(!text.includes('NIGHTJAR'));
    assert.ok(!text.includes('ada@example.com'));
    assert.ok(!text.includes('7946'));
    assert.ok(text.includes('Invoice'), 'unrelated text must remain');
  }
  const none = await runTool('redact-pdf', {
    fixture: 'pdf/basic.pdf',
    operation: 'pdf.redact',
    options: { redactTerms: 'zz-not-present-zz' },
  });
  assert.equal(none.status.status, 'FAILED');
  assert.match(none.status.errorMessage, /nothing was redacted/);
});

test('OCR adds a searchable text layer to a scanned page', async () => {
  const { status, output } = await runTool('ocr-pdf', {
    fixture: 'pdf/scanned-text.pdf',
    operation: 'pdf.ocrSearchable',
    options: { ocrLanguage: 'eng' },
  });
  assert.equal(status.status, 'COMPLETED', status.errorMessage);
  if (hasPdftotext()) assert.match(pdfText(output), /quarterly report/i);
});

test('PDF to Excel, PowerPoint and PDF/A produce valid files', async () => {
  const excel = await runTool('pdf-to-excel', { fixture: 'pdf/pii-table-image.pdf', operation: 'pdf.toExcel' });
  assert.equal(excel.status.status, 'COMPLETED', excel.status.errorMessage);
  assert.ok(excel.output.includes('xl/workbook.xml'));

  const slides = await runTool('pdf-to-powerpoint', { fixture: 'pdf/pii-table-image.pdf', operation: 'pdf.toPptx' });
  assert.equal(slides.status.status, 'COMPLETED', slides.status.errorMessage);
  assert.ok(slides.output.includes('ppt/presentation.xml'));

  // The generated deck round-trips through PowerPoint to PDF.
  const deck = await runTool('powerpoint-to-pdf', { buffer: slides.output, name: 'deck.pptx', targetFormat: 'pdf' });
  assert.equal(deck.status.status, 'COMPLETED', deck.status.errorMessage);
  assert.equal(deck.output.subarray(0, 5).toString(), '%PDF-');

  const archive = await runTool('pdf-to-pdfa', {
    fixture: 'pdf/basic.pdf',
    operation: 'pdf.toPdfA',
    options: { pdfaLevel: 'PDF/A-2b' },
  });
  assert.equal(archive.status.status, 'COMPLETED', archive.status.errorMessage);
  assert.ok(archive.output.includes('pdfaid'), 'PDF/A identification metadata is required');
});

test('repair, grayscale, image extraction and Excel to PDF complete', async () => {
  for (const [slug, request] of [
    ['repair-pdf', { fixture: 'pdf/basic.pdf', operation: 'pdf.repair' }],
    ['grayscale-pdf', { fixture: 'pdf/pii-table-image.pdf', operation: 'pdf.grayscale' }],
    ['extract-images-from-pdf', { fixture: 'pdf/pii-table-image.pdf', operation: 'pdf.extractImages' }],
    ['excel-to-pdf', { fixture: 'xlsx/basic.xlsx', targetFormat: 'pdf' }],
  ]) {
    const { status, output } = await runTool(slug, request);
    assert.equal(status.status, 'COMPLETED', `${slug}: ${status.errorMessage}`);
    assert.ok(output.length > 0, slug);
  }
});
