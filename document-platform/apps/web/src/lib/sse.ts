// Dependency-free so it can be unit-tested directly under Node type stripping.

/**
 * Parses complete Server-Sent Events from a buffer. Returns the JSON payloads
 * of complete events and the unconsumed remainder.
 */
export function parseSseEvents(buffer: string): { payloads: unknown[]; rest: string } {
  const events = buffer.split(/\r?\n\r?\n/);
  const rest = events.pop() || '';
  const payloads: unknown[] = [];
  for (const event of events) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data) payloads.push(JSON.parse(data));
  }
  return { payloads, rest };
}
