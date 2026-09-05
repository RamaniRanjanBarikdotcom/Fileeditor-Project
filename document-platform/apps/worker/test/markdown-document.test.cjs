const test = require('node:test');
const assert = require('node:assert/strict');
const { styleMarkdownHtml } = require('../dist/markdown-document');

test('injects the print stylesheet into standalone HTML', () => {
  const result = styleMarkdownHtml('<html><head><title>X</title></head><body><h1>X</h1></body></html>');
  assert.match(result, /border-collapse/);
  assert.ok(result.indexOf('<style>') < result.indexOf('</head>'));
});
