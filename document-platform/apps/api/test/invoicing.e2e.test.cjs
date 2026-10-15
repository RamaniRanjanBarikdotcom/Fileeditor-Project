// Live end-to-end test of Invoice Studio + Inventory (requires the running stack).
// Exercises the real database: numbering, locks, stock ledger, plans and isolation.
// Read before requiring Prisma: its client loads apps/api/.env, whose API_URL
// describes a different setting and must not redirect this test.
const API = process.env.E2E_API_URL || 'http://localhost:4201/api/v1';
const ORIGIN = process.env.E2E_ORIGIN || 'http://localhost:5173';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { validateGstin } = require('@docconv/invoice-engine');
const XLSX = require('sheetjs-style');
const DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://docconv:docconv_secret@127.0.0.1:5432/docconv?schema=public';
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
const today = new Date().toISOString().slice(0, 10);

async function register(label) {
  const response = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: `inv-${label}-${Date.now()}@example.com`, password: 'Invoice-2026-pass', firstName: 'Inv', lastName: label }),
  }).catch((error) => {
    throw new Error(`register failed: ${error.cause?.code ?? ''} ${error.cause?.message ?? error.message}`);
  });
  const { data } = await response.json();
  const claims = JSON.parse(Buffer.from(data.accessToken.split('.')[1], 'base64url'));
  return { token: data.accessToken, orgId: claims.orgId };
}

function client(user) {
  return async (method, path, body) => {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${user.token}`, Origin: ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, body: payload, data: payload?.data };
  };
}

/** A valid GSTIN for a state (computes the check character). */
function gstin(state, pan = 'AABCU9603R') {
  for (const check of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const candidate = `${state}${pan}1Z${check}`;
    if (validateGstin(candidate).valid) return candidate;
  }
  throw new Error('no check digit');
}

let a; // Pro user (purchasing enabled)
let b; // Free user
let api;
let apiB;
const ctx = {};

test.before(async () => {
  a = await register('pro');
  b = await register('free');
  api = client(a);
  apiB = client(b);
  const pro = await prisma.saasPlan.findFirstOrThrow({ where: { key: 'pro', product: { slug: 'invoice-studio' } } });
  await prisma.saasSubscription.create({
    data: {
      organizationId: a.orgId, productId: pro.productId, planId: pro.id, provider: 'STRIPE',
      providerSubId: `sub_e2e_${Date.now()}`, status: 'ACTIVE', currency: 'USD',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  });
});

test.after(() => prisma.$disconnect());

const lineFor = (item, quantity, extra = {}) => ({
  itemId: item.id, description: item.name, hsnSac: item.hsnSac ?? undefined, quantity: String(quantity),
  unit: item.unit, unitPrice: item.salePrice, taxRate: item.taxRate, supplyKind: item.kind, ...extra,
});
const invoice = (lines, extra = {}) => ({
  businessId: ctx.business.id, documentType: 'TAX_INVOICE', issueDate: today, contactId: ctx.customer.id, lines, ...extra,
});
const onHand = async (item) => (await api('GET', `/invoicing/items/${item.id}`)).data && (
  await prisma.invStockLevel.aggregate({ where: { itemId: item.id }, _sum: { onHand: true } })
)._sum.onHand?.toString();

test('business, contacts and items are validated and defaulted by country', async () => {
  const bad = await api('POST', '/invoicing/businesses', { name: 'Acme', country: 'IN', stateCode: '27', taxId: '27AAPFU0939F1ZA' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /check character/);

  const created = await api('POST', '/invoicing/businesses', {
    name: 'Acme Traders', country: 'IN', stateCode: '27', taxId: '27AAPFU0939F1ZV',
    address: { line1: '12 MG Road', city: 'Pune', postalCode: '411001' }, bank: { upiId: 'acme@okhdfc', ifsc: 'HDFC0001234', accountNumber: '1234567890' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  ctx.business = created.data;
  assert.equal(ctx.business.taxRegime, 'IN_GST');
  assert.equal(ctx.business.currency, 'INR');
  assert.equal(ctx.business.fyStartMonth, 4);
  ctx.warehouse = (await api('GET', '/inventory/warehouses')).data[0];
  assert.equal(ctx.warehouse.name, 'Main warehouse');

  ctx.customer = (await api('POST', '/invoicing/contacts', {
    name: 'Bengaluru Builders', country: 'IN', stateCode: '29', taxId: gstin('29'), billingAddress: { city: 'Bengaluru' },
  })).data;
  assert.ok(ctx.customer.id);
  ctx.supplier = (await api('POST', '/invoicing/contacts', {
    name: 'Steel Mills Ltd', country: 'IN', stateCode: '27', taxId: gstin('27', 'AAACS1234K'), isCustomer: false, isSupplier: true,
  })).data;

  ctx.bolt = (await api('POST', '/invoicing/items', {
    name: 'Steel bolt M8', sku: `BOLT-${Date.now()}`, hsnSac: '7318', salePrice: '12.50', purchasePrice: '8', taxRate: '18', trackInventory: true, reorderLevel: '20',
  })).data;
  ctx.service = (await api('POST', '/invoicing/items', { name: 'Installation', kind: 'SERVICES', hsnSac: '998719', salePrice: '1500', taxRate: '18', trackInventory: true })).data;
  assert.equal(ctx.service.trackInventory, false, 'services never carry stock');
  const duplicate = await api('POST', '/invoicing/items', { name: 'Copy', sku: ctx.bolt.sku });
  assert.equal(duplicate.status, 409);
});

test('opening stock, preview, issue with gapless number and stock deduction', async () => {
  const opening = await api('POST', '/inventory/adjustments', {
    itemId: ctx.bolt.id, warehouseId: ctx.warehouse.id, quantity: '100', unitCost: '8', type: 'OPENING', reason: 'Opening balance',
  });
  assert.equal(opening.status, 201, JSON.stringify(opening.body));
  assert.equal(await onHand(ctx.bolt), '100');

  const body = invoice([lineFor(ctx.bolt, 10), lineFor(ctx.service, 1)]);
  const preview = await api('POST', '/invoicing/documents/preview', body);
  assert.equal(preview.status, 201, JSON.stringify(preview.body));
  assert.equal(preview.data.calculation.treatment, 'INTER_STATE');
  // (125 + 1500) × 1.18 = 1917.50; Indian businesses round the total to whole rupees.
  assert.equal(preview.data.calculation.grandTotal, '1918.00');
  assert.equal(preview.data.calculation.roundOff, '0.50');
  assert.match(preview.data.html, /Tax Invoice/);

  const draft = await api('POST', '/invoicing/documents', body);
  assert.equal(draft.status, 201);
  assert.equal(await onHand(ctx.bolt), '100', 'drafts never move stock');
  const issued = await api('POST', `/invoicing/documents/${draft.data.id}/issue`, { idempotencyKey: `issue-${draft.data.id}` });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  ctx.invoice = issued.data.document;
  assert.match(ctx.invoice.number, /^INV\/\d{2}-\d{2}\/0001$/);
  assert.equal(ctx.invoice.status, 'ISSUED');
  assert.equal(ctx.invoice.stockPosted, true);
  assert.equal(await onHand(ctx.bolt), '90');

  const again = await api('POST', `/invoicing/documents/${draft.data.id}/issue`, { idempotencyKey: `issue-${draft.data.id}` });
  assert.equal(again.status, 201, 'same idempotency key returns the same document');
  assert.equal(again.data.document.number, ctx.invoice.number);
  const edit = await api('PUT', `/invoicing/documents/${draft.data.id}`, body);
  assert.equal(edit.status, 409, 'issued documents are immutable');
});

test('payments cannot exceed the balance and mark the invoice paid', async () => {
  const id = ctx.invoice.id;
  const over = await api('POST', `/invoicing/documents/${id}/payments`, { paidOn: today, amount: '5000', method: 'UPI' });
  assert.equal(over.status, 400);
  const part = await api('POST', `/invoicing/documents/${id}/payments`, { paidOn: today, amount: '918', method: 'UPI', reference: 'UTR123' });
  assert.equal(part.data.status, 'PARTIALLY_PAID');
  const rest = await api('POST', `/invoicing/documents/${id}/payments`, { paidOn: today, amount: '1000', method: 'BANK' });
  assert.equal(rest.data.status, 'PAID');
  const voidPaid = await api('POST', `/invoicing/documents/${id}/void`, { reason: 'mistake' });
  assert.equal(voidPaid.status, 409, 'paid invoices are corrected with a credit note, not voided');
});

test('credit notes return goods to stock; voiding reverses an invoice', async () => {
  const note = await api('POST', '/invoicing/documents', {
    ...invoice([lineFor(ctx.bolt, 2)]), documentType: 'CREDIT_NOTE', referenceDocumentId: ctx.invoice.id, returnToStock: true,
  });
  assert.equal(note.status, 201, JSON.stringify(note.body));
  const issuedNote = await api('POST', `/invoicing/documents/${note.data.id}/issue`, {});
  assert.match(issuedNote.data.document.number, /^CN\//);
  assert.equal(await onHand(ctx.bolt), '92');
  const html = await api('GET', `/invoicing/documents/${note.data.id}/html`);
  assert.match(html.data.html, new RegExp(ctx.invoice.number.replace(/\//g, '\\/')), 'credit note prints the original invoice number');

  const second = await api('POST', '/invoicing/documents', invoice([lineFor(ctx.bolt, 5)]));
  const issuedSecond = await api('POST', `/invoicing/documents/${second.data.id}/issue`, {});
  assert.match(issuedSecond.data.document.number, /0002$/);
  assert.equal(await onHand(ctx.bolt), '87');
  const voided = await api('POST', `/invoicing/documents/${second.data.id}/void`, { reason: 'Customer cancelled' });
  assert.equal(voided.status, 201, JSON.stringify(voided.body));
  assert.equal(voided.data.status, 'VOID');
  assert.equal(await onHand(ctx.bolt), '92');
});

test('parallel issuing never duplicates or skips numbers', async () => {
  const drafts = await Promise.all(
    Array.from({ length: 12 }, () => api('POST', '/invoicing/documents', { ...invoice([lineFor(ctx.service, 1)]), documentType: 'QUOTATION' })),
  );
  const results = await Promise.all(drafts.map((draft) => api('POST', `/invoicing/documents/${draft.data.id}/issue`, {})));
  assert.ok(results.every((result) => result.status === 201), JSON.stringify(results.map((r) => r.status)));
  const sequences = results.map((result) => Number(result.data.document.number.split('/').pop())).sort((x, y) => x - y);
  assert.deepEqual(sequences, Array.from({ length: 12 }, (_, index) => index + 1));
});

test('two simultaneous sales of the last unit: only one succeeds (block policy)', async () => {
  const widget = (await api('POST', '/invoicing/items', { name: 'Last widget', salePrice: '100', taxRate: '18', trackInventory: true })).data;
  await api('POST', '/inventory/adjustments', { itemId: widget.id, warehouseId: ctx.warehouse.id, quantity: '1', unitCost: '50', type: 'OPENING', reason: 'open' });
  const drafts = await Promise.all([1, 2].map(() => api('POST', '/invoicing/documents', invoice([lineFor(widget, 1)]))));
  const results = await Promise.all(drafts.map((draft) => api('POST', `/invoicing/documents/${draft.data.id}/issue`, {})));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.match(results.find((result) => result.status === 409).body.message, /Not enough stock of Last widget/);
  assert.equal(await onHand(widget), '0');
  const statuses = await Promise.all(drafts.map((draft) => api('GET', `/invoicing/documents/${draft.data.id}`)));
  assert.deepEqual(statuses.map((s) => s.data.status).sort(), ['DRAFT', 'ISSUED'], 'the blocked invoice stays a draft and used no number');
});

test('purchase order → goods receipts raise stock and average cost; cancelling reverses', async () => {
  const order = await api('POST', '/invoicing/documents', {
    businessId: ctx.business.id, documentType: 'PURCHASE_ORDER', issueDate: today, contactId: ctx.supplier.id,
    lines: [lineFor(ctx.bolt, 50, { unitPrice: '9' })],
  });
  assert.equal(order.status, 201, JSON.stringify(order.body));
  const issued = await api('POST', `/invoicing/documents/${order.data.id}/issue`, {});
  assert.match(issued.data.document.number, /^PO\//);
  assert.equal(issued.data.document.stockPosted, false, 'orders do not move stock');
  const orderLine = issued.data.document.lines[0];

  const first = await api('POST', '/inventory/receipts', {
    purchaseOrderId: order.data.id, warehouseId: ctx.warehouse.id, receivedOn: today,
    lines: [{ itemId: ctx.bolt.id, purchaseOrderLineId: orderLine.id, quantity: '30', unitCost: '9' }],
  });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(await onHand(ctx.bolt), '122');
  const item = (await api('GET', `/invoicing/items/${ctx.bolt.id}`)).data;
  // (92 × 8 + 30 × 9) / 122 = 8.2459
  assert.equal(Number(item.averageCost).toFixed(4), '8.2459');
  assert.equal((await api('GET', `/invoicing/documents/${order.data.id}`)).data.status, 'PARTIALLY_RECEIVED');

  const over = await api('POST', '/inventory/receipts', {
    purchaseOrderId: order.data.id, warehouseId: ctx.warehouse.id, receivedOn: today,
    lines: [{ itemId: ctx.bolt.id, purchaseOrderLineId: orderLine.id, quantity: '21', unitCost: '9' }],
  });
  assert.equal(over.status, 400);
  const second = await api('POST', '/inventory/receipts', {
    purchaseOrderId: order.data.id, warehouseId: ctx.warehouse.id, receivedOn: today,
    lines: [{ itemId: ctx.bolt.id, purchaseOrderLineId: orderLine.id, quantity: '20', unitCost: '9' }],
  });
  assert.equal((await api('GET', `/invoicing/documents/${order.data.id}`)).data.status, 'RECEIVED');
  assert.equal(await onHand(ctx.bolt), '142');

  const cancel = await api('POST', `/inventory/receipts/${second.data.id}/cancel`, {});
  assert.equal(cancel.status, 201, JSON.stringify(cancel.body));
  assert.equal(await onHand(ctx.bolt), '122');
  assert.equal((await api('GET', `/invoicing/documents/${order.data.id}`)).data.status, 'PARTIALLY_RECEIVED');

  const bill = await api('POST', `/invoicing/documents/${order.data.id}/convert`, { targetType: 'PURCHASE_BILL' });
  assert.equal(bill.status, 201, JSON.stringify(bill.body));
  const billIssued = await api('POST', `/invoicing/documents/${bill.data.id}/issue`, {});
  assert.equal(billIssued.data.document.stockPosted, false, 'stock for ordered goods arrives through receipts');
  assert.equal(await onHand(ctx.bolt), '122');
  assert.equal((await api('GET', `/invoicing/documents/${order.data.id}`)).data.status, 'CLOSED');
});

test('share links, archived original and PDFs', async () => {
  const link = await api('POST', `/invoicing/documents/${ctx.invoice.id}/share-links`, { expiresInDays: 7 });
  assert.equal(link.status, 201);
  const view = await fetch(`${API}/public/invoices/${link.data.token}`).then((response) => response.json());
  assert.match(view.data.html, new RegExp(ctx.invoice.number.replace(/\//g, '\\/')));
  const pdf = Buffer.from(await (await fetch(`${API}/public/invoices/${link.data.token}/pdf`)).arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await api('DELETE', `/invoicing/documents/${ctx.invoice.id}/share-links/${link.data.id}`);
  assert.equal((await fetch(`${API}/public/invoices/${link.data.token}`)).status, 404);
  assert.equal((await fetch(`${API}/public/invoices/not-a-real-token-1234567890`)).status, 404);

  const original = await api('GET', `/invoicing/documents/${ctx.invoice.id}/original`);
  assert.equal(original.status, 200, JSON.stringify(original.body));
  const archived = Buffer.from(await (await fetch(original.data.url)).arrayBuffer());
  assert.equal(createHash('sha256').update(archived).digest('hex'), original.data.sha256);
  const current = await api('GET', `/invoicing/documents/${ctx.invoice.id}/pdf`);
  assert.equal(current.status, 200);
  assert.equal(current.body.subarray(0, 5).toString(), '%PDF-');
});

test('documents print in the chosen language', async () => {
  const preview = await api('POST', '/invoicing/documents/preview', invoice([lineFor(ctx.bolt, 1)], { language: 'hi', secondaryLanguage: 'en' }));
  assert.match(preview.data.html, /कर बीजक/);
  assert.match(preview.data.html, /lang="hi"/);
});

test('GSTR-1 export, receivables ageing and CSV round trip', async () => {
  const report = await api('GET', `/invoicing/reports/gstr1?businessId=${ctx.business.id}&from=${today.slice(0, 8)}01&to=${today}`);
  assert.equal(report.status, 200, String(report.body));
  const book = XLSX.read(report.body, { type: 'buffer' });
  assert.deepEqual(book.SheetNames, ['b2b', 'b2cl', 'b2cs', 'exp', 'cdnr', 'hsn']);
  const b2b = XLSX.utils.sheet_to_json(book.Sheets.b2b);
  const first = b2b.find((row) => row['Invoice Number'] === ctx.invoice.number);
  assert.ok(first, 'issued B2B invoice is listed');
  assert.equal(first['GSTIN/UIN of Recipient'], ctx.customer.taxId);
  assert.equal(first['Place Of Supply'], '29-Karnataka');
  assert.equal(first.Rate, 18);
  assert.ok(XLSX.utils.sheet_to_json(book.Sheets.cdnr).some((row) => row['Note Type'] === 'C'), 'credit note in CDNR');
  assert.ok(XLSX.utils.sheet_to_json(book.Sheets.hsn).some((row) => row.HSN === '7318'));
  const vatForGst = await api('GET', `/invoicing/reports/vat?businessId=${ctx.business.id}`);
  assert.equal(vatForGst.status, 400, 'VAT report is for EU businesses');

  const ageing = await api('GET', '/invoicing/reports/receivables');
  assert.equal(ageing.status, 200);
  assert.ok(Array.isArray(ageing.data));

  const exported = await api('GET', '/invoicing/items/export');
  assert.equal(exported.status, 200);
  const csv = exported.body.toString('utf8');
  assert.match(csv, /name,kind,sku/);
  assert.match(csv, new RegExp(ctx.bolt.sku));
  const form = new FormData();
  form.set('file', new Blob([`name,sku,tax_rate,sale_price,track_stock\nImported washer,WASH-${Date.now()},18,2.50,yes\n,NO-NAME,18,1,no\n${ctx.bolt.name},${ctx.bolt.sku},18,13.00,yes\n`]), 'items.csv');
  const imported = await fetch(`${API}/invoicing/items/import`, { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, Origin: ORIGIN }, body: form }).then((response) => response.json());
  assert.equal(imported.data.created, 1);
  assert.equal(imported.data.updated, 1, 'existing SKU is updated');
  assert.equal(imported.data.errors.length, 1);
  assert.equal(imported.data.errors[0].row, 3);
  assert.equal((await api('GET', `/invoicing/items/${ctx.bolt.id}`)).data.salePrice, '13');
});

test('recurring invoices: create now issues the next numbered invoice', async () => {
  const profile = await api('POST', '/invoicing/recurring', { sourceDocumentId: ctx.invoice.id, frequency: 'MONTHLY', startOn: today, autoIssue: true });
  assert.equal(profile.status, 201, JSON.stringify(profile.body));
  const run = await api('POST', `/invoicing/recurring/${profile.data.id}/run`, {});
  assert.equal(run.status, 201, JSON.stringify(run.body));
  assert.equal(run.data.created, 1);
  assert.equal(run.data.profile.lastError, null);
  const created = (await api('GET', `/invoicing/documents/${run.data.profile.lastDocumentId}`)).data;
  assert.equal(created.status, 'ISSUED');
  assert.equal(created.documentType, 'TAX_INVOICE');
  assert.match(created.number, /^INV\//);
  assert.notEqual(created.number, ctx.invoice.number);
  assert.equal(run.data.profile.runCount, 1);
  assert.ok(run.data.profile.nextRunOn > today);
  assert.equal((await apiB('POST', '/invoicing/recurring', { sourceDocumentId: ctx.invoice.id, frequency: 'MONTHLY', startOn: today })).status, 402, 'recurring needs a paid plan (and B cannot see A anyway)');
});

test('workspaces are isolated and the free plan is enforced', async () => {
  assert.equal((await apiB('GET', `/invoicing/documents/${ctx.invoice.id}`)).status, 404);
  assert.equal((await apiB('GET', '/invoicing/documents')).data.total, 0);
  assert.equal((await apiB('POST', '/invoicing/documents', invoice([{ description: 'x', quantity: '1', unitPrice: '1' }]))).status, 404);
  assert.equal((await apiB('POST', '/inventory/adjustments', { itemId: ctx.bolt.id, warehouseId: ctx.warehouse.id, quantity: '5', type: 'ADJUSTMENT', reason: 'steal' })).status, 404);

  const created = await apiB('POST', '/invoicing/businesses', { name: 'Free Shop', country: 'DE', taxId: 'DE123456789' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const business = created.data;
  assert.equal(business.taxRegime, 'EU_VAT');
  assert.equal(business.currency, 'EUR');
  assert.equal((await apiB('POST', '/invoicing/businesses', { name: 'Second', country: 'DE' })).status, 402);
  const customer = (await apiB('POST', '/invoicing/contacts', { name: 'Kunde', country: 'DE' })).data;
  const freeInvoice = { businessId: business.id, documentType: 'TAX_INVOICE', issueDate: today, contactId: customer.id, lines: [{ description: 'Beratung', quantity: '1', unitPrice: '100', taxRate: '19', supplyKind: 'SERVICES' }] };
  const results = [];
  for (let index = 0; index < 21; index += 1) {
    const draft = await apiB('POST', '/invoicing/documents', freeInvoice);
    results.push((await apiB('POST', `/invoicing/documents/${draft.data.id}/issue`, {})).status);
  }
  assert.deepEqual(results.slice(0, 20), Array(20).fill(201));
  assert.equal(results[20], 402, 'the 21st invoice this month needs an upgrade');
  const order = await apiB('POST', '/invoicing/documents', { ...freeInvoice, documentType: 'PURCHASE_ORDER', contactId: undefined, buyer: { name: 'Lieferant', country: 'DE' } });
  assert.equal((await apiB('POST', `/invoicing/documents/${order.data.id}/issue`, {})).status, 402, 'purchasing is a paid feature');
  const usage = (await apiB('GET', '/invoicing/usage')).data;
  assert.equal(usage.plan.key, 'free');
  assert.equal(usage.usageThisMonth.invoicesPerMonth, 20);
});

test('input validation and the stock ledger reconciliation', async () => {
  assert.equal((await api('POST', '/invoicing/documents', invoice([{ description: 'x', quantity: '-1', unitPrice: '1' }]))).status, 400);
  assert.equal((await api('POST', '/invoicing/documents', invoice([{ description: 'x', quantity: '1', unitPrice: '1' }], { documentType: 'MAGIC' }))).status, 400);
  assert.equal((await api('POST', '/invoicing/documents', invoice([{ description: 'x', quantity: '1', unitPrice: '1' }], { platformRole: 'ADMIN' }))).status, 400);
  const reconcile = await api('GET', '/inventory/reconcile');
  assert.deepEqual(reconcile.data, [], 'stock levels always equal the sum of the ledger');
});
