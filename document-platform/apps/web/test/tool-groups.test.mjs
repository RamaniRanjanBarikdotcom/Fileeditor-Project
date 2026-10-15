import test from 'node:test';
import assert from 'node:assert/strict';
import toolRegistry from '@docconv/tool-registry';
import { TOOL_GROUPS, groupTools, groupIdForSlug } from '../src/lib/tool-groups.ts';

const registrySlugs = toolRegistry.listToolDefinitions().map((tool) => tool.slug);

test('every registered tool belongs to exactly one tool group', () => {
  const grouped = TOOL_GROUPS.flatMap((group) => group.slugs);
  assert.equal(new Set(grouped).size, grouped.length, 'a tool is listed in more than one group');
  assert.deepEqual([...grouped].sort(), [...registrySlugs].sort());
});

test('grouping keeps catalogue order and surfaces unknown tools under "More tools"', () => {
  const sections = groupTools([
    { slug: 'pdf-ocr' },
    { slug: 'merge-pdf' },
    { slug: 'brand-new-tool' },
    { slug: 'split-pdf' },
  ]);
  assert.deepEqual(
    sections.map((section) => [section.group.id, section.tools.map((tool) => tool.slug)]),
    [
      ['organize-pdf', ['merge-pdf']],
      ['split-pdf', ['split-pdf']],
      ['convert-from-pdf', ['pdf-ocr']],
      ['more', ['brand-new-tool']],
    ],
  );
  assert.equal(groupIdForSlug('image-to-pdf'), 'image');
});
