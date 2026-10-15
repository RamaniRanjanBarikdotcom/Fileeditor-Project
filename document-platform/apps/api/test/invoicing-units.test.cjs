const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { scheduledRun } = require('../dist/invoicing/automation.service');
const { parseCsv, csvRecords, toCsv } = require('../dist/invoicing/csv');

const day = (value) => value.toISOString().slice(0, 10);

test('recurring schedules are anchored to the start date (no month-end drift)', () => {
  const start = new Date('2026-01-31T00:00:00Z');
  assert.deepEqual([0, 1, 2, 3].map((index) => day(scheduledRun(start, 'MONTHLY', index))), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.equal(day(scheduledRun(start, 'QUARTERLY', 1)), '2026-04-30');
  assert.equal(day(scheduledRun(new Date('2028-02-29T00:00:00Z'), 'YEARLY', 1)), '2029-02-28');
  assert.equal(day(scheduledRun(new Date('2026-10-15T00:00:00Z'), 'WEEKLY', 2)), '2026-10-29');
});

test('CSV parsing handles quotes, commas, newlines and a BOM', () => {
  const text = '﻿name,sku,notes\r\n"Bolt, M8",B-1,"Line 1\nLine 2"\n"Say ""hi""",B-2,\n\n';
  assert.deepEqual(parseCsv(text), [['name', 'sku', 'notes'], ['Bolt, M8', 'B-1', 'Line 1\nLine 2'], ['Say "hi"', 'B-2', '']]);
  assert.deepEqual(csvRecords('Name,Sale Price\nBolt,12.5\n')[0], { name: 'Bolt', sale_price: '12.5' });
});

test('CSV export neutralises spreadsheet formulas', () => {
  const csv = toCsv(['name', 'price'], [['=HYPERLINK("http://evil")', 5], ['+cmd', null], ['Plain, with comma', '1']]);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil""\)",5/);
  assert.match(csv, /'\+cmd,/);
  assert.match(csv, /"Plain, with comma",1/);
});
