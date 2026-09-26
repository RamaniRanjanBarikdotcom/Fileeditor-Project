const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const fixturePath = path.join(__dirname, '..', 'fixtures', 'pdf', 'multilingual-visual.json');

function unpack(value) {
  return zlib.gunzipSync(Buffer.from(value, 'base64'));
}

function parsePpm(buffer) {
  let offset = 0;
  const token = () => {
    while (offset < buffer.length) {
      if (buffer[offset] === 35) {
        while (offset < buffer.length && buffer[offset] !== 10) offset += 1;
      } else if (buffer[offset] <= 32) {
        offset += 1;
      } else {
        break;
      }
    }
    const start = offset;
    while (offset < buffer.length && buffer[offset] > 32 && buffer[offset] !== 35) offset += 1;
    return buffer.subarray(start, offset).toString('ascii');
  };

  assert.equal(token(), 'P6', 'Visual fixture must be a binary RGB PPM image');
  const width = Number(token());
  const height = Number(token());
  assert.equal(Number(token()), 255, 'Only 8-bit PPM fixtures are supported');
  while (offset < buffer.length && buffer[offset] <= 32) offset += 1;
  const pixels = buffer.subarray(offset);
  assert.equal(pixels.length, width * height * 3, 'PPM payload size must match its dimensions');
  return { width, height, pixels };
}

function comparePixels(actualBuffer, expectedBuffer) {
  const actual = parsePpm(actualBuffer);
  const expected = parsePpm(expectedBuffer);
  assert.equal(actual.width, expected.width, 'Rendered width changed');
  assert.equal(actual.height, expected.height, 'Rendered height changed');

  let totalDifference = 0;
  let changedChannels = 0;
  for (let index = 0; index < actual.pixels.length; index += 1) {
    const difference = Math.abs(actual.pixels[index] - expected.pixels[index]);
    totalDifference += difference;
    if (difference > 18) changedChannels += 1;
  }
  return {
    meanAbsoluteDifference: totalDifference / actual.pixels.length,
    changedChannelRatio: changedChannels / actual.pixels.length,
  };
}

test('Poppler preserves multilingual, subset-font, transparent, rotated, and scanned PDFs', (t) => {
  const available = spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' });
  if (available.error?.code === 'ENOENT') {
    if (process.env.CI) assert.fail('pdftoppm is required for PDF visual-regression tests in CI.');
    t.skip('Install Poppler to run PDF visual-regression tests.');
    return;
  }

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const pdf = unpack(fixture.pdfGzipBase64);
  assert.equal(
    crypto.createHash('sha256').update(pdf).digest('hex'),
    fixture.pdfSha256,
    'The checked-in PDF fixture is corrupt',
  );

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'apptoolkit-pdf-visual-'));
  try {
    const input = path.join(folder, 'fixture.pdf');
    const prefix = path.join(folder, 'actual');
    fs.writeFileSync(input, pdf);
    const rendered = spawnSync('pdftoppm', ['-r', String(fixture.dpi), input, prefix], {
      encoding: 'utf8',
    });
    assert.equal(rendered.status, 0, rendered.stderr || 'pdftoppm failed');

    const actualPages = fs
      .readdirSync(folder)
      .filter((name) => /^actual-\d+\.ppm$/.test(name))
      .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
    assert.equal(actualPages.length, fixture.referencePpmGzipBase64.length, 'Page count changed');

    actualPages.forEach((name, index) => {
      const metrics = comparePixels(
        fs.readFileSync(path.join(folder, name)),
        unpack(fixture.referencePpmGzipBase64[index]),
      );
      assert.ok(
        metrics.meanAbsoluteDifference <= 3,
        `Page ${index + 1} mean pixel difference ${metrics.meanAbsoluteDifference.toFixed(3)} exceeds 3`,
      );
      assert.ok(
        metrics.changedChannelRatio <= 0.025,
        `Page ${index + 1} changed-channel ratio ${(metrics.changedChannelRatio * 100).toFixed(2)}% exceeds 2.5%`,
      );
    });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
