const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

// Loading the root module evaluates every controller, service and module file
// in the API. Import-time failures (for example a constant that uses a module
// before its import is initialised) crash the container on startup, so they
// must fail here rather than only in a live deployment.
test('every API module loads without import-time errors', () => {
  const { AppModule } = require('../dist/app.module');
  assert.equal(typeof AppModule, 'function');
});
