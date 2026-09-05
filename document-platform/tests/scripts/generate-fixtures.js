const fs = require('node:fs');
const path = require('node:path');
const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = require('../../apps/worker/node_modules/docx');
const XLSX = require('../../apps/worker/node_modules/sheetjs-style');
const { PDFDocument, StandardFonts, rgb } = require('../../apps/worker/node_modules/pdf-lib');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const ensure = (dir) => fs.mkdirSync(path.join(FIXTURES_DIR, dir), { recursive: true });
const write = (relative, value) => {
  fs.writeFileSync(path.join(FIXTURES_DIR, relative), value);
  console.log(`Generated ${relative}`);
};

async function createPdfs(png) {
  const basic = await PDFDocument.create();
  basic.setTitle('AppToolkitLab deterministic text fixture');
  const font = await basic.embedFont(StandardFonts.Helvetica);
  const page = basic.addPage([595.28, 841.89]);
  page.drawText('AppToolkitLab PDF conversion fixture', { x: 48, y: 780, size: 18, font });
  page.drawText('Invoice: ATL-2026-0001', { x: 48, y: 740, size: 12, font });
  page.drawText('A deterministic text layer for extraction tests.', { x: 48, y: 715, size: 11, font });
  write('pdf/basic.pdf', await basic.save({ useObjectStreams: false }));

  const imageOnly = await PDFDocument.create();
  const embedded = await imageOnly.embedPng(png);
  const scanPage = imageOnly.addPage([300, 300]);
  scanPage.drawImage(embedded, { x: 0, y: 0, width: 300, height: 300 });
  write('pdf/image-only.pdf', await imageOnly.save({ useObjectStreams: false }));

  const mixed = await PDFDocument.create();
  mixed.addPage([595.28, 841.89]).drawRectangle({ x: 20, y: 20, width: 555, height: 801, borderColor: rgb(0, 0, 0) });
  const mixedFont = await mixed.embedFont(StandardFonts.Helvetica);
  mixed.addPage([841.89, 595.28]).drawText('Landscape page', { x: 40, y: 540, size: 16, font: mixedFont });
  write('pdf/mixed-page-sizes.pdf', await mixed.save({ useObjectStreams: false }));
  write('pdf/corrupt-truncated.pdf', Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>'));
}

async function createDocx() {
  const doc = new Document({
    creator: 'AppToolkitLab Tests', title: 'DOCX conversion fixture',
    sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: 'AppToolkitLab DOCX fixture', bold: true, size: 32 })] }),
      new Paragraph('Paragraph with bold, table, and Unicode: ₹ — café.'),
      new Table({ rows: [
        new TableRow({ children: [new TableCell({ children: [new Paragraph('Item')] }), new TableCell({ children: [new Paragraph('Amount')] })] }),
        new TableRow({ children: [new TableCell({ children: [new Paragraph('Toolkit')] }), new TableCell({ children: [new Paragraph('749')] })] }),
      ] }),
    ] }],
  });
  write('docx/basic.docx', await Packer.toBuffer(doc));
}

function createXlsx() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Product', 'Quantity', 'Price'], ['Toolkit', 2, 749], ['Automation', 1, 2499],
  ]), 'Products');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { month: 'January', operations: 120 }, { month: 'February', operations: 180 },
  ]), 'Usage');
  write('xlsx/basic.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

function createWav() {
  const sampleRate = 8000;
  const samples = sampleRate / 4;
  const dataSize = samples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 8000), 44 + i * 2);
  write('audio/tone.wav', wav);
}

async function main() {
  ['pdf', 'docx', 'xlsx', 'images', 'audio', 'url'].forEach(ensure);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  write('images/test.png', png);
  await createPdfs(png);
  await createDocx();
  createXlsx();
  createWav();
  write('url/static.html', '<!doctype html><title>Static fixture</title><main><h1>Controlled URL fixture</h1></main>');
  write('url/spa.html', '<!doctype html><title>SPA fixture</title><div id="app">Loading</div><script>setTimeout(()=>document.querySelector("#app").textContent="SPA ready",50)</script>');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
