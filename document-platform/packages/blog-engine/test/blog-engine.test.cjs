const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BLOG_PIPELINE_STAGES,
  BlogEngine,
  estimateBlogCredits,
  isBlogGenerationModel,
  normalizeProviderModelId,
  sanitizeGeneratedHtml,
  usageToCredits,
} = require('../dist');

test('provider model discovery normalizes Google IDs and excludes non-writing models', () => {
  assert.equal(
    normalizeProviderModelId('GOOGLE', 'models/gemini-3.8-flash'),
    'gemini-3.8-flash',
  );
  assert.equal(isBlogGenerationModel('gpt-6-luna'), true);
  assert.equal(isBlogGenerationModel('claude-sonnet-5'), true);
  assert.equal(isBlogGenerationModel('text-embedding-3-small'), false);
  assert.equal(isBlogGenerationModel('gpt-image-2'), false);
  assert.equal(isBlogGenerationModel('whisper-large-v3'), false);
});

const input = {
  topic: 'Reliable document automation',
  keywords: ['document tools'],
  language: 'English',
  writingStyle: 'Educational',
  tone: 'Professional',
  targetLength: 1200,
};

test('pipeline is deterministic, checkpointed, and returns a structured article', async () => {
  const stages = [];
  const checkpoints = [];
  const engine = new BlogEngine({
    ai: {
      async generateStructured({ stage }) {
        stages.push(stage);
        const value =
          stage === 'finalize'
            ? {
                title: 'Reliable automation',
                html: '<h1>Reliable automation</h1><p>Useful content.</p>',
                seoTitle: 'Reliable automation guide',
                metaDescription: 'A practical guide.',
                slug: 'reliable-automation',
                keywords: ['automation'],
                seoScore: 91,
              }
            : stage === 'draft'
              ? { title: 'Draft', html: '<p>Draft</p>' }
              : stage === 'outline'
                ? { sections: ['Introduction'] }
                : stage === 'takeaways'
                  ? { takeaways: ['Be reliable'] }
                  : stage === 'research'
                    ? { seoIntent: 'informational', questions: ['How?'] }
                    : stage === 'sources'
                      ? { synthesis: 'Source synthesis' }
                      : stage === 'quality'
                        ? { html: '<p>Good</p>', issues: [] }
                        : { html: '<p>Good</p>' };
        return { value, inputTokens: 10, outputTokens: 20, model: 'test-model' };
      },
    },
    checkpoint: {
      async load() {
        return null;
      },
      async save(value) {
        checkpoints.push(structuredClone(value));
      },
    },
  });
  const result = await engine.generate(input);
  assert.deepEqual(stages, BLOG_PIPELINE_STAGES);
  assert.equal(checkpoints.length, BLOG_PIPELINE_STAGES.length);
  assert.equal(result.title, 'Reliable automation');
  assert.equal(result.usage.outputTokens, 200);
});

test('credit estimation and settlement always round up', () => {
  assert.equal(estimateBlogCredits(input), 22);
  assert.equal(
    usageToCredits(
      { inputTokens: 1000, outputTokens: 1000, imageCount: 0 },
      { inputPerMillionUsd: 1, outputPerMillionUsd: 2, imageUsd: 0.04 },
    ),
    1,
  );
});

test('generated HTML removes active content', () => {
  const safe = sanitizeGeneratedHtml(
    '<p onclick="bad()">Safe</p><script>alert(1)</script><a href="javascript:bad()">x</a><a href=java&#x73;cript:bad()>y</a><img src="data:image/svg+xml;base64,PHN2Zz4=" onerror=bad()>',
  );
  assert.doesNotMatch(safe, /onclick|onerror|script|javascript|svg\+xml/i);
  assert.doesNotMatch(safe, /alert\(1\)/i);
});

test('an aborted signal stops generation before another provider stage', async () => {
  const controller = new AbortController();
  let calls = 0;
  const engine = new BlogEngine({
    abortSignal: controller.signal,
    ai: {
      async generateStructured() {
        calls += 1;
        controller.abort();
        return { value: { seoIntent: 'informational', questions: [] } };
      },
    },
  });
  await assert.rejects(() => engine.generate(input), /cancelled/i);
  assert.equal(calls, 1);
});

test('invalid structured stage output is retried without changing the prompt', async () => {
  const prompts = [];
  let attempts = 0;
  const engine = new BlogEngine({
    maxStageAttempts: 2,
    retryDelayMs: 0,
    ai: {
      async generateStructured({ stage, prompt }) {
        prompts.push({ stage, prompt });
        if (stage === 'research' && attempts++ === 0) {
          return { value: { seoIntent: '', questions: 'not-an-array' } };
        }
        const value =
          stage === 'finalize'
            ? {
                title: 'Retried article',
                html: '<p>Complete.</p>',
                seoTitle: 'Retried article',
                metaDescription: 'A valid final result.',
                slug: 'retried-article',
                keywords: ['retry'],
                seoScore: 80,
              }
            : stage === 'draft'
              ? { title: 'Draft', html: '<p>Draft</p>' }
              : stage === 'outline'
                ? { sections: ['Section'] }
                : stage === 'takeaways'
                  ? { takeaways: ['Takeaway'] }
                  : stage === 'research'
                    ? { seoIntent: 'informational', questions: ['Why?'] }
                    : stage === 'sources'
                      ? { synthesis: 'Synthesis' }
                      : stage === 'quality'
                        ? { html: '<p>Complete.</p>', issues: [] }
                        : { html: '<p>Complete.</p>' };
        return { value };
      },
    },
  });

  const result = await engine.generate(input);
  assert.equal(result.title, 'Retried article');
  assert.equal(prompts.filter(({ stage }) => stage === 'research').length, 2);
  assert.equal(prompts[0].prompt, prompts[1].prompt);
});
