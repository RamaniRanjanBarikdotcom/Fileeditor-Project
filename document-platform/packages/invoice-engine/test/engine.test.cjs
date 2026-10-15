const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../dist');
const { Dec, calculateDocument, formatDocumentNumber, periodKey, validatePattern } = engine;

const IN_SELLER = { country: 'IN', state: '27' }; // Maharashtra
const DE_SELLER = { country: 'DE' };

function gst(lines, buyer = { country: 'IN', state: '27' }, extra = {}) {
  return calculateDocument({ regime: 'IN_GST', currency: 'INR', documentType: 'TAX_INVOICE', seller: IN_SELLER, buyer, lines, ...extra });
}
function vat(lines, buyer, extra = {}) {
  return calculateDocument({ regime: 'EU_VAT', currency: 'EUR', documentType: 'TAX_INVOICE', seller: DE_SELLER, buyer, lines, ...extra });
}
const taxes = (result) => result.taxBreakdown.map((t) => `${t.code}@${t.rate}=${t.amount}`);

// ── Decimal ────────────────────────────────────────────────────
test('decimal arithmetic is exact and rounds as specified', () => {
  assert.equal(Dec.of('0.1').add('0.2').toString(), '0.3');
  assert.equal(Dec.of(0.1).add(0.2).toString(), '0.3');
  assert.equal(Dec.of('2.675').round(2).toFixed(), '2.68');
  assert.equal(Dec.of('-2.675').round(2).toFixed(), '-2.68');
  assert.equal(Dec.of('2.665').round(2, 'HALF_EVEN').toFixed(), '2.66');
  assert.equal(Dec.of('10').div('3', 4).toFixed(), '3.3333');
  assert.equal(Dec.of('1.5').mul('1.5').toString(), '2.25');
  assert.equal(Dec.of('.5').toFixed(2), '0.50');
  assert.throws(() => Dec.of('1,5'), /not a decimal/);
});

// ── India GST ──────────────────────────────────────────────────
test('GST intra-state splits into CGST + SGST', () => {
  const result = gst([{ quantity: 2, unitPrice: '500', taxRate: 18 }]);
  assert.equal(result.treatment, 'INTRA_STATE');
  assert.deepEqual(taxes(result), ['CGST@9=90.00', 'SGST@9=90.00']);
  assert.equal(result.grandTotal, '1180.00');
});

test('GST inter-state charges IGST', () => {
  const result = gst([{ quantity: 2, unitPrice: '500', taxRate: 18 }], { country: 'IN', state: '29' });
  assert.equal(result.treatment, 'INTER_STATE');
  assert.deepEqual(taxes(result), ['IGST@18=180.00']);
  assert.equal(result.grandTotal, '1180.00');
});

test('union territories without a legislature use UTGST', () => {
  const result = calculateDocument({
    regime: 'IN_GST', currency: 'INR', documentType: 'TAX_INVOICE',
    seller: { country: 'IN', state: '04' }, buyer: { country: 'IN', state: '04' },
    lines: [{ quantity: 1, unitPrice: 100, taxRate: 5 }],
  });
  assert.deepEqual(taxes(result), ['CGST@2.5=2.50', 'UTGST@2.5=2.50']);
});

test('exports are zero-rated under LUT or charge IGST when paid', () => {
  const lut = gst([{ quantity: 1, unitPrice: 1000, taxRate: 18 }], { country: 'US' });
  assert.equal(lut.treatment, 'EXPORT');
  assert.equal(lut.taxTotal, '0.00');
  assert.ok(lut.notes.includes('note.exportLut'));
  assert.equal(lut.lines[0].zeroReason, 'reason.zeroRatedLut');

  const paid = gst([{ quantity: 1, unitPrice: 1000, taxRate: 18 }], { country: 'US' }, { exportWithPayment: true });
  assert.deepEqual(taxes(paid), ['IGST@18=180.00']);
  assert.ok(paid.notes.includes('note.exportWithPayment'));

  const sez = gst([{ quantity: 1, unitPrice: 1000, taxRate: 18 }], { country: 'IN', state: '27', isSez: true });
  assert.equal(sez.treatment, 'SEZ');
  assert.equal(sez.taxTotal, '0.00');
});

test('reverse charge shows the tax but does not collect it', () => {
  const result = gst([{ quantity: 1, unitPrice: 1000, taxRate: 18 }], { country: 'IN', state: '29' }, { reverseCharge: true });
  assert.equal(result.taxTotal, '0.00');
  assert.equal(result.reverseChargeTaxTotal, '180.00');
  assert.equal(result.grandTotal, '1000.00');
  assert.ok(result.notes.includes('note.reverseCharge'));
});

test('compensation cess is added on the taxable value', () => {
  const result = gst([{ quantity: 1, unitPrice: 1000, taxRate: 28, cessRate: 12 }]);
  assert.deepEqual(taxes(result), ['CGST@14=140.00', 'SGST@14=140.00', 'CESS@12=120.00']);
  assert.equal(result.grandTotal, '1400.00');
});

test('round-off rounds the total to whole rupees and shows the difference', () => {
  const result = gst([{ quantity: 3, unitPrice: '33.33', taxRate: 18 }], undefined, { roundOffTotal: true });
  assert.equal(result.taxableTotal, '99.99');
  assert.deepEqual(taxes(result), ['CGST@9=9.00', 'SGST@9=9.00']);
  assert.equal(result.roundOff, '0.01');
  assert.equal(result.grandTotal, '118.00');
});

test('tax-inclusive prices are split back into taxable value and tax exactly', () => {
  const result = gst([{ quantity: 1, unitPrice: '118', taxRate: 18 }], undefined, { pricesIncludeTax: true });
  assert.equal(result.taxableTotal, '100.00');
  assert.equal(result.grandTotal, '118.00');
  const odd = gst([{ quantity: 1, unitPrice: '99.99', taxRate: 18 }], undefined, { pricesIncludeTax: true });
  assert.equal(odd.grandTotal, '99.99'); // never off by a paisa
});

test('composition dealers and bills of supply charge no GST', () => {
  const composition = calculateDocument({
    regime: 'IN_GST', currency: 'INR', documentType: 'TAX_INVOICE',
    seller: { ...IN_SELLER, gstComposition: true }, buyer: { country: 'IN', state: '27' },
    lines: [{ quantity: 1, unitPrice: 500, taxRate: 18 }],
  });
  assert.equal(composition.taxTotal, '0.00');
  assert.ok(composition.notes.includes('note.composition'));
  const billOfSupply = calculateDocument({
    regime: 'IN_GST', currency: 'INR', documentType: 'BILL_OF_SUPPLY', seller: IN_SELLER,
    buyer: { country: 'IN', state: '27' }, lines: [{ quantity: 1, unitPrice: 500, taxRate: 18 }],
  });
  assert.equal(billOfSupply.grandTotal, '500.00');
  assert.ok(billOfSupply.notes.includes('note.billOfSupply'));
});

test('discounts reduce the taxable value; exempt lines carry no tax', () => {
  const result = gst([
    { quantity: 1, unitPrice: 1000, taxRate: 18, discount: { type: 'PERCENT', value: 10 } },
    { quantity: 1, unitPrice: 200, taxRate: 5, discount: { type: 'AMOUNT', value: 50 } },
    { quantity: 1, unitPrice: 300, taxRate: 0, taxCategory: 'EXEMPT' },
  ]);
  assert.equal(result.discountTotal, '150.00');
  assert.equal(result.taxableTotal, '1350.00');
  assert.equal(result.taxTotal, '169.50'); // 900 × 18% + 150 × 5%
  assert.equal(result.lines[2].zeroReason, 'reason.exempt');
});

test('GST requires the seller state and place of supply', () => {
  assert.throws(() => gst([{ quantity: 1, unitPrice: 1, taxRate: 18 }], { country: 'IN' }), /place of supply/);
});

// ── EU VAT ─────────────────────────────────────────────────────
test('EU domestic VAT rounds per rate on the document by default', () => {
  const lines = [0, 1, 2].map(() => ({ quantity: 1, unitPrice: '0.07', taxRate: 19 }));
  const documentRounded = vat(lines, { country: 'DE' });
  assert.equal(documentRounded.treatment, 'DOMESTIC');
  assert.deepEqual(taxes(documentRounded), ['VAT@19=0.04']);
  const lineRounded = vat(lines, { country: 'DE' }, { taxRounding: 'LINE' });
  assert.deepEqual(taxes(lineRounded), ['VAT@19=0.03']);
});

test('intra-EU B2B supplies use the reverse charge with the right legal note', () => {
  const buyer = { country: 'FR', isBusiness: true, taxId: 'FR40303265045' };
  const services = vat([{ quantity: 1, unitPrice: 1000, taxRate: 19, supplyKind: 'SERVICES' }], buyer);
  assert.equal(services.treatment, 'INTRA_EU_B2B');
  assert.equal(services.taxTotal, '0.00');
  assert.ok(services.notes.includes('note.intraEuServices'));
  const goods = vat([{ quantity: 1, unitPrice: 1000, taxRate: 19, supplyKind: 'GOODS' }], buyer);
  assert.ok(goods.notes.includes('note.intraEuGoods'));
  assert.deepEqual(taxes(goods), ['VAT@0=0.00']); // the 0% line is still shown
});

test('an EU business without a valid VAT ID is charged VAT, with a warning', () => {
  const result = vat([{ quantity: 1, unitPrice: 100, taxRate: 19 }], { country: 'FR', isBusiness: true, taxId: 'FR123' });
  assert.equal(result.taxTotal, '19.00');
  assert.equal(result.warnings.length, 1);
});

test('EU B2C distance sales can use OSS destination rates', () => {
  const result = vat([{ quantity: 1, unitPrice: 100, taxRate: 20 }], { country: 'FR' }, { euOss: true });
  assert.equal(result.treatment, 'EU_OSS');
  assert.deepEqual(taxes(result), ['VAT@20=20.00']);
  assert.ok(result.notes.includes('note.oss'));
});

test('sales outside the EU: goods exported, B2B services outside scope, B2C services taxed', () => {
  const goods = vat([{ quantity: 1, unitPrice: 100, taxRate: 19, supplyKind: 'GOODS' }], { country: 'US' });
  assert.equal(goods.treatment, 'EXPORT_OUTSIDE_EU');
  assert.equal(goods.taxTotal, '0.00');
  assert.ok(goods.notes.includes('note.exportEu'));
  const b2b = vat([{ quantity: 1, unitPrice: 100, taxRate: 19, supplyKind: 'SERVICES' }], { country: 'US', isBusiness: true });
  assert.ok(b2b.notes.includes('note.outsideScope'));
  assert.equal(b2b.taxTotal, '0.00');
  const b2c = vat([{ quantity: 1, unitPrice: 100, taxRate: 19, supplyKind: 'SERVICES' }], { country: 'US' });
  assert.equal(b2c.taxTotal, '19.00');
});

test('EU VAT requires an EU seller', () => {
  assert.throws(() => calculateDocument({
    regime: 'EU_VAT', currency: 'USD', documentType: 'TAX_INVOICE', seller: { country: 'US' },
    buyer: { country: 'DE' }, lines: [{ quantity: 1, unitPrice: 1 }],
  }), /EU country/);
});

// ── Generic, currencies, document types ────────────────────────
test('generic regime applies any named taxes', () => {
  const result = calculateDocument({
    regime: 'GENERIC', currency: 'USD', documentType: 'TAX_INVOICE', seller: { country: 'US' }, buyer: { country: 'US' },
    lines: [{ quantity: 1, unitPrice: 100, genericTaxes: [{ name: 'State tax', rate: '6.25' }, { name: 'City tax', rate: 2 }] }],
  });
  assert.deepEqual(taxes(result), ['State tax@6.25=6.25', 'City tax@2=2.00']);
  assert.equal(result.grandTotal, '108.25');
});

test('currencies use their own minor units', () => {
  const yen = calculateDocument({ regime: 'GENERIC', currency: 'JPY', documentType: 'TAX_INVOICE', seller: { country: 'JP' }, buyer: { country: 'JP' }, lines: [{ quantity: 3, unitPrice: '333.5', taxRate: 10 }] });
  assert.equal(yen.grandTotal, '1101'); // 1001 taxable (rounded) + 100 tax
  const dinar = calculateDocument({ regime: 'GENERIC', currency: 'KWD', documentType: 'TAX_INVOICE', seller: { country: 'KW' }, buyer: { country: 'KW' }, lines: [{ quantity: 1, unitPrice: '1.2345', taxRate: 5 }] });
  assert.equal(dinar.grandTotal, '1.297');
  assert.equal(engine.isCurrencyCode('EUR'), true);
  assert.equal(engine.isCurrencyCode('XYZ'), false);
});

test('non-taxable document types never charge tax; unknown types are rejected', () => {
  const challan = gst([{ quantity: 5, unitPrice: 10, taxRate: 18 }], undefined, { documentType: 'DELIVERY_CHALLAN' });
  assert.equal(challan.taxTotal, '0.00');
  assert.throws(() => gst([{ quantity: 1, unitPrice: 1 }], undefined, { documentType: 'MAGIC' }), /Unknown document type/);
  assert.throws(() => gst([{ quantity: -1, unitPrice: 1 }]), /credit note/);
});

// ── Tax IDs ────────────────────────────────────────────────────
test('GSTIN and EU VAT ID validation', () => {
  assert.equal(engine.validateGstin('27aapfu0939f1zv').valid, true); // official sample, normalised
  assert.equal(engine.validateGstin('27AAPFU0939F1ZV', '29').valid, false);
  assert.equal(engine.validateGstin('99AAPFU0939F1ZV').valid, false);
  assert.equal(engine.validateEuVatId('DE 123 456 789').valid, true);
  assert.equal(engine.validateEuVatId('EL123456789', 'GR').valid, true);
  assert.equal(engine.validateEuVatId('DE12345').valid, false);
  assert.equal(engine.validateEuVatId('NL123456789B01', 'DE').valid, false);
});

// ── Numbering ──────────────────────────────────────────────────
test('numbering follows the Indian financial year and resets with its period', () => {
  const march = new Date('2026-03-31T12:00:00Z');
  const april = new Date('2026-04-01T12:00:00Z');
  assert.equal(formatDocumentNumber('INV/{FY}/{SEQ:4}', 42, march), 'INV/2025-26/0042');
  assert.equal(formatDocumentNumber('INV/{FY}/{SEQ:4}', 1, april), 'INV/2026-27/0001');
  assert.notEqual(periodKey('INV/{FY}/{SEQ}', march), periodKey('INV/{FY}/{SEQ}', april));
  assert.equal(periodKey('INV-{SEQ:5}', march), periodKey('INV-{SEQ:5}', april)); // never resets
  assert.equal(formatDocumentNumber('{YY}{MM}-{SEQ:3}', 7, april), '2604-007');
  assert.equal(validatePattern('INV-{SEQ:5}'), null);
  assert.match(validatePattern('INV-{DATE}'), /needs a \{SEQ\}|Unknown token/);
  assert.equal(engine.isGstCompliantNumber('INV/2026-27/0001'), true);
  assert.equal(engine.isGstCompliantNumber('INVOICE/2026-27/000001'), false);
});
