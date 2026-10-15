const test = require('node:test');
const assert = require('node:assert/strict');
const { spreadsheetValue } = require('../dist/adapters/pdf-ops');

test('PDF to Excel keeps unambiguous numbers numeric', () => {
  assert.equal(spreadsheetValue('42'), 42);
  assert.equal(spreadsheetValue('-3.5'), -3.5);
  assert.equal(spreadsheetValue('0.25'), 0.25);
  assert.equal(spreadsheetValue('1,234'), 1234);
  assert.equal(spreadsheetValue('1,234,567.89'), 1234567.89);
});

test('PDF to Excel never corrupts identifiers or ambiguous values', () => {
  assert.equal(spreadsheetValue('007'), '007');
  assert.equal(spreadsheetValue('01234'), '01234');
  assert.equal(spreadsheetValue('1,5'), '1,5');
  assert.equal(spreadsheetValue('4111111111111111'), '4111111111111111');
  assert.equal(spreadsheetValue(' Total '), 'Total');
  assert.equal(spreadsheetValue(null), '');
});
