const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDocument } = require('@docconv/invoice-engine');
const t = require('../dist');

function gstModel(overrides = {}) {
  const lines = [
    { description: 'Steel bolts', hsnSac: '7318', quantity: '100', unit: 'pcs', unitPrice: '12.50', taxRate: 18 },
    { description: 'Installation service', hsnSac: '998719', quantity: '1', unitPrice: '1500', taxRate: 18 },
  ];
  const calculation = calculateDocument({
    regime: 'IN_GST', currency: 'INR', documentType: 'TAX_INVOICE',
    seller: { country: 'IN', state: '27' }, buyer: { country: 'IN', state: '29' },
    lines: lines.map(({ quantity, unitPrice, taxRate }) => ({ quantity, unitPrice, taxRate })),
  });
  return {
    documentType: 'TAX_INVOICE', status: 'ISSUED', regime: 'IN_GST', number: 'INV/2026-27/0001',
    issueDate: '2026-10-15', dueDate: '2026-10-30', placeOfSupply: 'Karnataka (29)', currency: 'INR', calculation,
    seller: { name: 'Acme Traders', address: ['12 MG Road', 'Pune 411001'], taxId: '27AAPFU0939F1ZV', taxIdKind: 'gstin' },
    buyer: { name: 'Bengaluru Builders', address: ['Bengaluru'], taxIdKind: 'gstin' },
    lines: lines.map(({ taxRate: _taxRate, ...line }) => line),
    bank: { accountName: 'Acme Traders', accountNumber: '1234567890', ifsc: 'HDFC0001234', upiId: 'acme@okhdfc' },
    paymentQr: 'upi',
    ...overrides,
  };
}

test('every language pack defines exactly the reference keys', () => {
  for (const [code, info] of Object.entries(t.LANGUAGES)) {
    assert.deepEqual(Object.keys(info.pack).sort(), [...t.LABEL_KEYS].sort(), `pack ${code}`);
    for (const key of t.LABEL_KEYS) assert.ok(info.pack[key].trim(), `${code}: ${key} is empty`);
  }
});

test('user data is escaped and the document cannot load anything', async () => {
  const model = gstModel();
  model.lines[0].description = '<script>alert(1)</script>';
  model.buyer.name = '"><img src=x onerror=alert(1)>';
  model.notes = '</style><script>steal()</script>';
  model.seller.logoDataUri = 'https://evil.example/logo.png';
  const html = await t.renderDocument(model, { template: 'classic', language: 'en', country: 'IN' });
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img src=x/i.test(html));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('evil.example'));
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; img-src data:/);
});

test('every template renders a GST invoice; GST detailed adds the HSN summary', async () => {
  for (const id of Object.keys(t.TEMPLATES)) {
    const html = await t.renderDocument(gstModel(), { template: id, language: 'en', country: 'IN' });
    assert.match(html, /Tax Invoice/, id);
    assert.match(html, /INV\/2026-27\/0001/, id);
  }
  const detailed = await t.renderDocument(gstModel(), { template: 'gst-detailed', language: 'en', country: 'IN' });
  assert.match(detailed, /<th class="num">IGST<\/th>/);
  assert.match(detailed, /998719/);
  const thermal = await t.renderDocument(gstModel(), { template: 'thermal-80', language: 'en', country: 'IN' });
  assert.match(thermal, /@page \{ size: 80mm 297mm; margin: 0; \}/);
  assert.equal(t.TEMPLATES['thermal-80'].singlePage, true);
});

test('Indian invoices show lakh grouping, amount in words, reverse-charge field and a UPI QR', async () => {
  const html = await t.renderDocument(gstModel(), { template: 'classic', language: 'en', country: 'IN' });
  assert.match(html, /₹3,245\.00/); // 2,750 taxable + IGST 18% (495)
  assert.match(html, /Rupees Three Thousand Two Hundred Forty-Five Only/);
  assert.match(html, /Tax payable on reverse charge<\/th><td>No/);
  assert.match(html, /data:image\/svg\+xml;charset=utf-8,/);
});

test('Arabic documents are right-to-left; bilingual documents show both languages', async () => {
  const arabic = await t.renderDocument(gstModel({ regime: 'GENERIC' }), { template: 'modern', language: 'ar' });
  assert.match(arabic, /<html lang="ar" dir="rtl">/);
  assert.match(arabic, /فاتورة/);
  const bilingual = await t.renderDocument(gstModel(), { template: 'classic', language: 'en', secondaryLanguage: 'hi', country: 'IN' });
  assert.match(bilingual, /Tax Invoice<span class="l2" lang="hi" dir="ltr">कर बीजक<\/span>/);
});

test('custom labels work for any language, including ones without a shipped pack', async () => {
  const html = await t.renderDocument(gstModel(), {
    template: 'classic', language: 'sw', labelOverrides: { 'doc.taxInvoice': 'Ankara ya Kodi', 'field.billTo': 'Mteja' },
  });
  assert.match(html, /<html lang="sw" dir="ltr">/);
  assert.match(html, /Ankara ya Kodi/);
  assert.match(html, /Mteja/);
  assert.equal(t.languageInfo('ur').dir, 'rtl');
});

test('amounts in words', () => {
  assert.equal(t.amountInWords('120050.50', 'INR', 'en'), 'Rupees One Lakh Twenty Thousand Fifty and Fifty Paise Only');
  assert.equal(t.amountInWords('25000000', 'INR', 'en'), 'Rupees Two Crore Fifty Lakh Only');
  assert.equal(t.amountInWords('120050.50', 'INR', 'hi'), 'एक लाख बीस हज़ार पचास रुपये और पचास पैसे मात्र');
  assert.equal(t.amountInWords('1234.45', 'USD', 'en'), 'US Dollar One Thousand Two Hundred Thirty-Four and 45/100 Only');
  assert.equal(t.amountInWords('1.297', 'KWD', 'en'), 'Kuwaiti Dinar One and 297/1000 Only');
  assert.equal(t.amountInWords('10', 'EUR', 'de'), null); // no converter: the row is omitted
});

test('numbers and dates follow the document locale', () => {
  assert.equal(t.createFormatter({ language: 'en', country: 'IN' }).money('1234567.5', 'INR'), '₹12,34,567.50');
  assert.equal(t.createFormatter({ language: 'de', country: 'DE' }).money('1234.5', 'EUR').replace(/\s/g, ' '), '1.234,50 €');
  assert.equal(t.createFormatter({ language: 'ar' }).number('1234.5'), '1,234.5'); // Latin digits by default
  assert.equal(t.createFormatter({ language: 'ar', digits: 'native' }).number('12'), '١٢');
  assert.equal(t.createFormatter({ language: 'hi', digits: 'native' }).number('12'), '१२');
  assert.equal(t.createFormatter({ language: 'en', country: 'IN' }).money('120000', 'INR'), '₹1,20,000.00');
  assert.equal(t.createFormatter({ language: 'en', country: 'GB' }).date('2026-10-15'), '15 Oct 2026');
});

test('payment QR payloads', async () => {
  assert.equal(
    t.upiPaymentUri({ vpa: 'acme@okhdfc', payeeName: 'Acme Traders', amount: '3245', note: 'INV 1' }),
    'upi://pay?pa=acme%40okhdfc&pn=Acme%20Traders&am=3245.00&cu=INR&tn=INV%201',
  );
  assert.throws(() => t.upiPaymentUri({ vpa: 'not a vpa', payeeName: 'x', amount: '1' }), /UPI ID/);
  assert.equal(
    t.epcPaymentPayload({ name: 'Muster GmbH', iban: 'DE89 3704 0044 0532 0130 00', amount: '119', remittance: 'RE-1' }),
    'BCD\n002\n1\nSCT\n\nMuster GmbH\nDE89370400440532013000\nEUR119.00\n\n\nRE-1',
  );
  assert.match(await t.qrDataUri('hello'), /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
});
