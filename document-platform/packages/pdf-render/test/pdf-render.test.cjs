const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { htmlToPdf, PdfRenderError } = require('../dist');

function fakeGotenberg(responses) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      requests.push({ url: req.url, body });
      const next = responses.shift();
      res.writeHead(next.status, { 'Content-Type': 'application/pdf' });
      res.end(next.body);
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

test('renders HTML through the Chromium route with CSS page size and backgrounds', async () => {
  const fake = await fakeGotenberg([{ status: 200, body: '%PDF-1.7 fake' }]);
  try {
    const pdf = await htmlToPdf('<p>Hi</p>', { gotenbergUrl: fake.url });
    assert.equal(pdf.toString(), '%PDF-1.7 fake');
    assert.equal(fake.requests[0].url, '/forms/chromium/convert/html');
    assert.match(fake.requests[0].body, /name="preferCssPageSize"\r\n\r\ntrue/);
    assert.match(fake.requests[0].body, /name="printBackground"\r\n\r\ntrue/);
    assert.match(fake.requests[0].body, /<p>Hi<\/p>/);
  } finally {
    fake.server.close();
  }
});

test('retries while Chromium is busy, then rejects invalid output', async () => {
  const fake = await fakeGotenberg([
    { status: 409, body: 'busy' },
    { status: 200, body: '%PDF-1.7 ok' },
    { status: 200, body: '<html>not a pdf</html>' },
    { status: 500, body: 'boom' },
  ]);
  try {
    assert.equal((await htmlToPdf('x', { gotenbergUrl: fake.url })).toString(), '%PDF-1.7 ok');
    await assert.rejects(htmlToPdf('x', { gotenbergUrl: fake.url }), /invalid document/);
    await assert.rejects(htmlToPdf('x', { gotenbergUrl: fake.url, busyRetries: 0 }), (error) => error instanceof PdfRenderError && error.status === 500);
  } finally {
    fake.server.close();
  }
});
