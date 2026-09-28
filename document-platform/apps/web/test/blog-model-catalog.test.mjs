import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_PROVIDERS,
  PROVIDERS,
  mergeModelOptions,
} from '../src/app/app/blog-studio/settings/constants.ts';

test('Blog Studio offers current flagship text and image models', () => {
  const openai = PROVIDERS.find((provider) => provider.id === 'openai');
  const anthropic = PROVIDERS.find((provider) => provider.id === 'anthropic');
  const google = PROVIDERS.find((provider) => provider.id === 'google');
  const xai = PROVIDERS.find((provider) => provider.id === 'xai');

  assert.ok(openai.models.includes('gpt-6-luna'));
  assert.ok(openai.models.includes('gpt-6-sol'));
  assert.ok(anthropic.models.includes('claude-sonnet-5'));
  assert.ok(google.models.includes('gemini-3.8-flash'));
  assert.ok(xai.models.includes('grok-4.7'));
  assert.ok(IMAGE_PROVIDERS.some((provider) => provider.id === 'openai'));
  assert.ok(openai.imageModels.includes('gpt-image-2.5-flare'));
});

test('custom and live-discovered model IDs are retained without duplicates', () => {
  assert.deepEqual(
    mergeModelOptions(
      ['gpt-6-luna', 'gpt-6-sol'],
      ['gpt-6-sol', 'future-model-1'],
      'customer-fine-tune',
    ),
    ['customer-fine-tune', 'gpt-6-luna', 'gpt-6-sol', 'future-model-1'],
  );
});
