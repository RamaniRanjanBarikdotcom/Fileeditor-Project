export const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    keyPrefix: 'sk-',
    models: [
      'gpt-5-mini',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4-turbo',
      'o3',
      'o3-mini',
      'o1',
      'o1-mini',
    ],
    imageModels: ['gpt-image-1', 'dall-e-3'],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'google',
    name: 'Google AI',
    keyPrefix: 'AIza',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    imageModels: ['imagen-3.0-generate-002'],
    supportsGeneration: true,
    supportsResearch: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyPrefix: 'sk-or-',
    models: [
      'openrouter/auto',
      'openai/gpt-4o',
      'openai/gpt-4.1',
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
      'mistralai/mistral-large',
    ],
    imageModels: ['openai/gpt-image-1', 'google/imagen-3.0-generate-002'],
    supportsGeneration: true,
    supportsResearch: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    keyPrefix: 'sk-ant-',
    models: [
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
    ],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    keyPrefix: 'gsk_',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    keyPrefix: 'xai-',
    models: ['grok-2-latest', 'grok-2-mini-latest', 'grok-beta'],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    keyPrefix: 'hf_',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
    ],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    keyPrefix: '',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    keyPrefix: '',
    models: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    keyPrefix: '',
    models: [
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/deepseek-r1',
    ],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    keyPrefix: 'pplx-',
    models: ['sonar', 'sonar-pro'],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'sarvam',
    name: 'Sarvam AI',
    keyPrefix: '',
    models: ['sarvam-m'],
    imageModels: [],
    supportsGeneration: true,
    supportsResearch: true,
  },
  {
    id: 'tavily',
    name: 'Tavily',
    keyPrefix: 'tvly-',
    models: [],
    imageModels: [],
    supportsGeneration: false,
    supportsResearch: true,
  },
];

export const GENERATION_PROVIDERS = PROVIDERS.filter((provider) => provider.supportsGeneration);

export const SERP_PROVIDERS = [
  { id: 'none', name: 'None' },
  { id: 'openai', name: 'OpenAI (Web Search)' },
  { id: 'tavily', name: 'Tavily' },
];

export const DEEP_RESEARCH_PROVIDERS = [
  { id: 'none', name: 'None' },
  ...PROVIDERS.filter((provider) => provider.supportsGeneration || provider.id === 'perplexity').map(
    (provider) => ({
      id: provider.id,
      name: provider.name,
    })
  ),
];

export const DEFAULT_PROMPTS = {
  styleGuardrails:
    'You are an expert SEO content writer focused on human-first, high-quality blog posts that feel natural, non-repetitive, and trustworthy.',
  seoStructureGuardrails:
    'Use clear sections, short paragraphs, and purposeful lists. Avoid fluff, repetition, or filler.',
  seoResearchPrompt:
    'You are an SEO expert. Analyze this topic and provide keyword research in {{language}}.\n\nTopic: "{{topic}}"\nKeywords: "{{keywords}}"\nFocus keyword: "{{focusKeyword}}"\n\nRespond with JSON:\n{\n  "primaryKeyword": "main keyword",\n  "secondaryKeywords": ["keyword1", "keyword2", "keyword3"],\n  "searchIntent": "informational/transactional",\n  "relatedTopics": ["topic1", "topic2"]\n}',
  keyTakeawaysPrompt:
    'Summarize 4-6 qualitative key takeaways for the topic "{{topic}}" in {{language}} as bullet points. Avoid statistics or specific numbers.',
  researchSynthesisPrompt:
    'Synthesize research for "{{topic}}" in {{language}} using the context below. Focus on qualitative insights, influencing factors, and practical guidance. Avoid statistics, percentages, or numeric claims. Provide a concise research brief with:\n- key themes\n- audience pain points\n- trustworthy sources to cite (with URLs from context)\n- recommended angles for the blog\n\nContext:\n{{researchContext}}',
  outlinePrompt:
    'Create a detailed blog outline in {{language}} for: "{{topic}}"\n\nKeywords to include: {{secondaryKeywords}}\n\nRespond with JSON:\n{\n  "sections": [\n    {"heading": "Introduction", "subsections": ["Hook", "Overview"]},\n    {"heading": "Main Section 1", "subsections": ["Point A", "Point B"]}\n  ]\n}',
  blogPrompt: `Write a comprehensive blog post in {{language}}.

Topic: "{{topic}}"
Style: {{writingStyle}}
Tone: {{writingTone}}
Target word count: {{targetWordCount}}

Primary keyword: {{primaryKeyword}}
Secondary keywords: {{secondaryKeywords}}

Outline:
{{outline}}

Formatting rules:
- Output valid HTML only. Use <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tbody>, <tr>, <th>, <td>, <blockquote>, and <pre><code>.
- Do not wrap the output in Markdown code fences like \`\`\` or \`\`\`html.
- Include a single <h1> at the top of the content.
- All H2 headings must be max 9 words and formatted exactly like:
  - <h2>[Number] [Keyword] for [Benefit]</h2> or <h2>What [Keyword] are there?</h2>
- Use sequential numbers when listing (1, 2, 3, 4, 5).
- After every H2, add an introductory sentence of 20-30 words in a <p> tag. Do not repeat the H2 text and do not say "Here are".
- If the section is a list, include 5-7 points, each 15-25 words, each point starts with a noun, and all points have parallel structure and consistent punctuation.
- For processes or troubleshooting, use a numbered list (<ol>).
- Add a small FAQ section with 3-5 Q&A entries using <p><strong>Q:</strong> ...</p><p><strong>A:</strong> ...</p>.
- Include one comparison table (<table>).
- Include one expert quote in <blockquote>.
- Include one short code block in <pre><code> only if the topic is technical; otherwise omit it.
- Include one callout in the format: <p><strong>Pro Tip:</strong> ...</p>.

Content rules:
- FACTS RULE: No specific numbers, percentages, or statistics in body content. Use qualitative descriptions and factors instead.
- Avoid repetition and keep language natural and human.
- Conclude with a gentle suggestion to seek individualized consultation for unique situations.
- If research context includes sources, cite them with inline links like <a href="URL">Source</a>.
- If internal site URL is provided, include a few natural internal links using that base.
- If product context is provided, link product names to their URLs.
- Ensure troubleshooting topics provide step-by-step guidance.

Include:
- Engaging title
- Meta description (under 160 characters)
- Introduction with hook
- Main body sections based on outline
- Practical conclusion with CTA

Format as JSON:
{
  "title": "Blog Title",
  "metaDescription": "Description",
  "content": "Full blog content in HTML format"
}`,
  repairPrompt:
    'You are a senior editor. Rewrite this draft into a full blog post with complete paragraphs, not an outline.\n\nDraft:\n{{draft}}\n\nRespond with JSON:\n{\n  "title": "Blog Title",\n  "metaDescription": "Description",\n  "content": "Full blog content in HTML format"\n}',
  humanizePrompt:
    'Improve the following blog post for natural flow, readability, and human tone without changing facts.\n\nContent:\n{{draft}}\n\nReturn the improved content only.',
  compliancePrompt:
    'You are a strict editor. Revise the draft to comply with all formatting and content rules.\n\nRules:\n- Output valid HTML only. Use <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tbody>, <tr>, <th>, <td>, <blockquote>, and <pre><code>.\n- Do not use Markdown markers like #, ##, ###, -, *, or ``` for formatting.\n- Do not wrap the output in Markdown code fences like \\`\\`\\` or \\`\\`\\`html.\n- Include a single <h1> at the top of the content.\n- H2 rules: max 9 words, format as "[Number] [Keyword] for [Benefit]" or "What [Keyword] are there?", use sequential numbers (1, 2, 3, 4, 5).\n- After each H2, add a 20-30 word intro sentence.\n- Lists: 5-7 items, 15-25 words each, noun-led, parallel structure, consistent punctuation.\n- Processes use numbered lists.\n- Include FAQ (3-5 Q&A), a comparison table, one blockquote, a code block only if the topic is technical, and a "Pro Tip" callout.\n- FACTS RULE: No statistics, percentages, or specific numeric claims in body content.\n- Add a gentle suggestion for individualized consultation.\n- Keep content natural, non-repetitive, and useful.\n\nDraft:\n{{draft}}\n\nReturn the revised content only.',
  imagePrompt: `You are an expert AI prompt engineer specialized in generating high-quality photorealistic featured image prompts for professional blog articles.

Your task is to convert a blog topic paragraph into one polished image-generation prompt.

Instructions:

Analyze the input text and extract:

A clear, specific visual subject

A natural action being performed

A realistic setting or environment

Supporting visual details such as lighting, mood, composition, and color tones

If the topic is abstract (SEO, AI, marketing, strategy, analytics, etc.), convert it into a realistic visual metaphor that can be photographed naturally.

Generate exactly ONE single-line prompt using this structure:

[Specific subject], [natural action], in [clear setting], with [lighting, mood, composition, visual details]. The image must be natural, realistic, in 2018, style raw, 8K, taken on iPhone, --ar 16:9

Strict Rules:

Output ONLY the final image prompt.

No explanations.

No extra text.

No formatting.

No text overlays.

No logos.

No UI elements.

Must be photorealistic.

Must be landscape orientation (16:9).

Must end exactly with:

The image must be natural, realistic, in 2018, style raw, 8K, taken on iPhone, --ar 16:9
|

Input text:
{{topicParagraph}}`,
};
