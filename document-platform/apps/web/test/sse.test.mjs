import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSseEvents } from '../src/lib/sse.ts';

test('SSE parser returns complete events and keeps a partial remainder', () => {
  const { payloads, rest } = parseSseEvents(
    'event: progress\ndata: {"status":"PROCESSING","progress":30}\n\ndata: {"status":"COMP',
  );
  assert.deepEqual(payloads, [{ status: 'PROCESSING', progress: 30 }]);
  assert.equal(rest, 'data: {"status":"COMP');

  const next = parseSseEvents(`${rest}LETED"}\r\n\r\n`);
  assert.deepEqual(next.payloads, [{ status: 'COMPLETED' }]);
  assert.equal(next.rest, '');
});

test('SSE parser ignores comments and joins multi-line data', () => {
  const { payloads } = parseSseEvents(': keep-alive\n\ndata: {"a":\ndata: 1}\n\n');
  assert.deepEqual(payloads, [{ a: 1 }]);
});
