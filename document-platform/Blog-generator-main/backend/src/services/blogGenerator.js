// Blog generation pipeline — ported from src/main/index.js (the `generate-blog` and
// `generate-blog-image` IPC handlers + their helpers). Pure logic: side effects
// (logging, progress, persistence) are done via the injected data-layer actions and
// the `onProgress` callback so the same pipeline runs server-side and streams progress
// over the user's WebSocket.

import { createRequire } from 'node:module';
import {
  addLog,
  saveBlog,
  updateBlog,
  getBlogById,
  trackApiUsage,
  logActivity,
  addNotification,
} from '../db/actions.js';
import { fetchSiteContext } from './siteContext.js';

const require = createRequire(import.meta.url);
const {
  chatCompletion,
  generateImage,
  testConnection,
  listProviderModels,
  estimateCost,
  parseJsonContent,
  tavilySearch,
  openaiWebSearch,
  wikipediaSummary,
  getProvider,
  customBaseUrl,
  resolveProviderInfo,
  IMAGE_DEFAULT_MODEL,
} = require('./aiProviders.cjs');

// Generation temperature: clamp to a sane 0–2 range; default 0.7. Reasoning models that
// ignore custom temperatures are handled inside aiProviders.chatCompletion.
function normalizeTemperature(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.7;
  return Math.min(2, Math.max(0, n));
}

export { testConnection, listProviderModels, getProvider };

/* ============================ prompt templates ============================ */

const DEFAULT_PROMPTS = {
  styleGuardrails:
    'You are an expert SEO content writer. Output should feel human: varied sentence lengths, concrete mini-scenarios, light opinion with humility, conversational contractions, no cliches, no filler, no invented facts or stats. Ensure the primary keyword appears naturally in the first 120 words and 3-5 times across the post.',
  seoStructureGuardrails:
    'Structure every post: (1) H1 title + meta description, (2) Intro with hook/promise, (3) Context section, (4) 3-6 H2 body sections each with explanation + example + practical step, (5) Common mistakes section, (6) How to apply section with steps, (7) FAQ (3-5 Q&A), (8) Conclusion with CTA. Keep paragraphs short (2-5 lines), headings concise (<9 words).',
  seoResearchPrompt: `You are an SEO strategist. Analyze the topic and return tight keyword + intent data in {{language}}.

Topic: "{{topic}}"
Keywords: "{{keywords}}"
Focus keyword: "{{focusKeyword}}"

Respond with JSON:
{
  "primaryKeyword": "main keyword",
  "secondaryKeywords": ["keyword1", "keyword2", "keyword3"],
  "searchIntent": "informational | commercial | comparison | transactional",
  "relatedTopics": ["topic1", "topic2"],
  "questions": ["question1", "question2"],
  "painPoints": ["pain1", "pain2"]
}`,
  keyTakeawaysPrompt:
    'List 5 qualitative takeaways for "{{topic}}" in {{language}} as bullets. No numbers or statistics.',
  researchSynthesisPrompt: `Synthesize research for "{{topic}}" in {{language}} using the context below. Focus on qualitative insights and practical guidance. Avoid statistics or numeric claims. Provide:
- key themes
- audience pain points
- trustworthy sources to cite (with URLs from context)
- recommended angles for the blog

Context:
{{researchContext}}`,
  outlinePrompt: `Create a long-form blog outline in {{language}} for "{{topic}}".

Include the primary idea, 4-6 body H2s, one "Common mistakes" H2, one "How to apply" H2, and an FAQ H2.

Respond with JSON:
{
  "sections": [
    {"heading": "Introduction", "subsections": ["Hook", "What readers will learn"]},
    {"heading": "Context", "subsections": ["Why it matters", "Current challenge"]},
    {"heading": "Main Section", "subsections": ["Point A", "Point B"]}
  ]
}`,
  blogPrompt: `Write a comprehensive, human-sounding blog post in {{language}}.

Topic: "{{topic}}"
Style: {{writingStyle}}
Tone: {{writingTone}}
Target word count: {{targetWordCount}}

Primary keyword: {{primaryKeyword}}
Secondary keywords: {{secondaryKeywords}}

Keyword usage rules:
- Include the primary keyword in the first 120 words, in one H2, and a few times naturally in body paragraphs.
- If an image is generated, include primary keyword in its alt text placeholder.

Outline:
{{outline}}

Formatting rules:
- Output valid HTML only. Use <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>.
- Do not wrap output in code fences.
- Single <h1> at top. H2 headings concise (<9 words), natural language (no forced numbering). After each H2, include a 20-30 word lead paragraph.
- Lists: 4-7 items, 15-25 words each, parallel structure. Use <ol> for steps.
- FAQ: 3-5 Q&A entries using <p><strong>Q:</strong> ...</p><p><strong>A:</strong> ...</p>.
- Include one short <blockquote> quote (no fake attribution) and one <p><strong>Pro Tip:</strong> ...</p> callout.
- Add a comparison table only if clearly useful; otherwise skip.
- Only include <pre><code> if the topic is technical.

Content rules:
- FACTS RULE: Do not invent statistics, years, or percentages. Keep claims qualitative or cite provided sources with <a href="URL">text</a>.
- Use varied sentence lengths, mini-scenarios, and concrete examples. Avoid cliches and filler.
- Cover: intro hook, context, core sections, common mistakes, how to apply (steps), FAQ, conclusion with CTA.
- Internal links: if an internal site URL is provided, add 2-3 natural links using it. If product context is provided, link product names to their URLs.

Return JSON:
{
  "title": "Blog Title",
  "metaDescription": "Description",
  "content": "Full blog content in HTML format"
}`,
  repairPrompt: `You are a senior editor. Turn the draft into a full blog post with complete paragraphs, natural flow, and the required structure (intro, context, core sections, mistakes, how-to apply, FAQ, conclusion).

Draft:
{{draft}}

Respond with JSON:
{
  "title": "Blog Title",
  "metaDescription": "Description",
  "content": "Full blog content in HTML format"
}`,
  humanizePrompt: `Polish this blog post for natural flow and human tone. Vary sentence length, add subtle transitions, remove cliches, keep facts unchanged. Use light contractions (don't, can't, it's), and avoid formulaic openings/closings. Keep HTML tags intact.

Content:
{{draft}}

Return the improved content only.`,
  compliancePrompt: `You are a strict editor. Make sure the draft follows formatting + content rules.

Rules:
- Valid HTML only (<h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, optional <table>). No code fences.
- Single <h1>. H2 concise (<9 words), natural language. After each H2 add a 20-30 word lead paragraph.
- Lists: 4-7 items, 15-25 words, parallel structure; use <ol> for steps.
- Include FAQ (3-5 Q&A), one blockquote, one <p><strong>Pro Tip:</strong> ...</p>. Table only if useful. Code block only if technical.
- No invented statistics/percentages/years. Keep facts qualitative or cite provided sources with links.
- Required sections: intro, context, core sections, common mistakes, how to apply, FAQ, conclusion with CTA.
- Keep tone human, avoid repetition and cliches.

Draft:
{{draft}}

Return the revised content only.`,
  expandPrompt: `You are an editor. Expand this blog post to at least {{targetWordCount}} words.

Requirements:
- Keep all existing structure and HTML tags (<h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, optional <table>).
- Add depth with concrete examples, mini-scenarios, and step-by-step detail where relevant.
- Keep tone human and avoid cliches.
- Do NOT add statistics, percentages, or made-up facts.

Draft:
{{draft}}

Return expanded HTML content only.`,
  padPrompt: `You are an editor. Enrich this blog post to reach at least {{targetWordCount}} words while keeping its structure unchanged.

Add:
- Extra concrete examples and mini-scenarios inside existing sections
- More step-by-step detail where relevant
- Clarifying sentences that keep flow natural

Keep HTML tags intact (<h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, optional <table>). Do NOT add statistics, percentages, years, or made-up facts.

Draft:
{{draft}}

Return the enriched HTML content only.`,
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

/* ============================ pure helpers ============================ */

function renderTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (variables[key] === undefined || variables[key] === null) return '';
    return String(variables[key]);
  });
}

function getPromptTemplates(settings) {
  const overrides = settings?.promptTemplates || {};
  const merged = { ...DEFAULT_PROMPTS, ...overrides };
  merged.blogPrompt = DEFAULT_PROMPTS.blogPrompt;
  merged.repairPrompt = DEFAULT_PROMPTS.repairPrompt;
  merged.compliancePrompt = DEFAULT_PROMPTS.compliancePrompt;
  return merged;
}

function stripHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ');
}

function stripMarkdownFences(text) {
  if (!text) return '';
  let cleaned = text.replace(/```[a-z]*\n?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  return cleaned.trim();
}

function stripCodeBlocks(html) {
  if (!html) return '';
  return html.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/gi, '').trim();
}

function renumberH2Headings(html) {
  if (!html) return '';
  let index = 0;
  return html.replace(/<h2>(\s*)(\d+)(\s+)/gi, (match, leading, _num, spacing) => {
    index += 1;
    return `<h2>${leading}${index}${spacing}`;
  });
}

function buildImagePrompt({ title, content, template }) {
  const baseTemplate = template || DEFAULT_PROMPTS.imagePrompt;
  const cleanText = stripHtmlTags(content || '').trim();
  const topicParagraph = cleanText || (title || '').trim() || 'Professional blog topic';
  return renderTemplate(baseTemplate, { topic: (title || '').trim(), topicParagraph });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LINK_STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'by',
  'at', 'from', 'as', 'is', 'are', 'be', 'this', 'that', 'these', 'those',
  'der', 'die', 'das', 'und', 'oder', 'mit', 'fur', 'für', 'von', 'im', 'am',
]);
const MAX_LINKS_PER_PRODUCT = 2;

function slugWordsFromUrl(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '';
    const last = segments[segments.length - 1];
    return decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function buildLinkPhrases(product) {
  const phrases = new Set();
  const add = (val) => {
    const cleaned = String(val || '').trim();
    if (cleaned.length >= 4) phrases.add(cleaned);
  };
  add(product.title);
  if (Array.isArray(product.keywords)) product.keywords.forEach(add);
  const slug = slugWordsFromUrl(product.url);
  if (slug) {
    add(slug);
    const slugWords = slug.split(/\s+/).filter((w) => w && !LINK_STOP_WORDS.has(w.toLowerCase()));
    if (slugWords.length >= 2) {
      add(slugWords.slice(0, 3).join(' '));
      add(slugWords.slice(0, 2).join(' '));
    }
  }
  if (product.title) {
    const titleWords = product.title.split(/\s+/).filter((w) => w && !LINK_STOP_WORDS.has(w.toLowerCase()));
    if (titleWords.length >= 2) {
      add(titleWords.slice(0, 3).join(' '));
      add(titleWords.slice(0, 2).join(' '));
    }
  }
  return Array.from(phrases).sort((a, b) => b.length - a.length);
}

function linkProducts(content, products) {
  if (!content || !Array.isArray(products) || products.length === 0) return content;
  const candidates = products
    .filter((item) => item?.url && (item?.title || item?.url))
    .map((product) => ({ product, phrases: buildLinkPhrases(product), remaining: MAX_LINKS_PER_PRODUCT }))
    .filter((c) => c.phrases.length > 0);
  if (candidates.length === 0) return content;

  const segments = content.split(/(<[^>]+>)/g);
  let inAnchor = false;
  const skipStack = [];
  const isSkippedTag = (tag) => /^<\s*(a|h1|h2|h3)\b/i.test(tag);
  const isClosingSkippedTag = (tag) => /^<\s*\/\s*(a|h1|h2|h3)\s*>/i.test(tag);

  const linked = segments.map((segment) => {
    if (!segment) return segment;
    if (segment.startsWith('<')) {
      if (isSkippedTag(segment)) {
        skipStack.push(segment);
        if (/^<\s*a\b/i.test(segment)) inAnchor = true;
      } else if (isClosingSkippedTag(segment)) {
        skipStack.pop();
        if (/^<\s*\/\s*a\s*>/i.test(segment)) inAnchor = false;
      }
      return segment;
    }
    if (skipStack.length > 0 || inAnchor) return segment;
    let updated = segment;
    candidates.forEach((cand) => {
      if (cand.remaining <= 0) return;
      for (const phrase of cand.phrases) {
        if (cand.remaining <= 0) break;
        const regex = new RegExp(`(?<![\\w-])${escapeRegExp(phrase)}(?![\\w-])`, 'i');
        const match = updated.match(regex);
        if (!match) continue;
        const matched = match[0];
        const before = updated.slice(0, match.index);
        const after = updated.slice(match.index + matched.length);
        updated = `${before}<a href="${cand.product.url}" target="_blank" rel="noreferrer">${matched}</a>${after}`;
        cand.remaining -= 1;
      }
    });
    return updated;
  });
  return linked.join('');
}

function normalizeUrlForMatch(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return '';
  }
}

function keepOnlyScrapedLinks(content, products) {
  if (!content) return content;
  const allowed = new Set(
    (Array.isArray(products) ? products : []).map((item) => normalizeUrlForMatch(item?.url)).filter(Boolean)
  );
  return content.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, inner) => {
    const normalizedHref = normalizeUrlForMatch(href);
    if (normalizedHref && allowed.has(normalizedHref)) return match;
    return inner;
  });
}

function normalizeSeoData(raw) {
  return {
    primaryKeyword: raw?.primaryKeyword || '',
    secondaryKeywords: Array.isArray(raw?.secondaryKeywords) ? raw.secondaryKeywords : [],
    searchIntent: raw?.searchIntent || '',
    relatedTopics: Array.isArray(raw?.relatedTopics) ? raw.relatedTopics : [],
  };
}

export function normalizeMaxTokens(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const safe = Math.floor(parsed);
  if (safe <= 0) return null;
  return safe;
}

function isTechnicalTopic(topic, keywords) {
  const combined = `${topic || ''} ${keywords || ''}`.toLowerCase();
  const signals = [
    'driver', 'printer', 'software', 'install', 'api', 'code', 'debug', 'error',
    'troubleshoot', 'network', 'database', 'script', 'linux', 'windows',
  ];
  return signals.some((signal) => combined.includes(signal));
}

function calculateSeoScore(content, title, metaDescription, keywords, focusKeyword) {
  let score = 0;
  if (title) {
    if (title.length >= 30 && title.length <= 60) score += 10;
    if (focusKeyword && title.toLowerCase().includes(focusKeyword.toLowerCase())) score += 10;
  }
  if (metaDescription) {
    if (metaDescription.length >= 120 && metaDescription.length <= 160) score += 10;
    if (focusKeyword && metaDescription.toLowerCase().includes(focusKeyword.toLowerCase())) score += 5;
  }
  if (content) {
    const textContent = stripHtmlTags(content);
    const words = textContent.split(/\s+/).filter(Boolean);
    if (words.length >= 1500) score += 15;
    if (words.length >= 1000 && words.length < 1500) score += 10;
    const markdownHeadings = (content.match(/^#{2,3}\s+/gm) || []).length;
    const htmlHeadings = (content.match(/<h[23]\b[^>]*>/gi) || []).length;
    const textHeadings = (content.match(/^\s*H[23]:\s+/gim) || []).length;
    const headings = markdownHeadings + htmlHeadings + textHeadings;
    if (headings >= 4) score += 10;
    const lists =
      /^\s*[-*]\s+/m.test(content) ||
      /^\d+\.\s+/m.test(content) ||
      /<ul\b[^>]*>/.test(content) ||
      /<ol\b[^>]*>/.test(content);
    if (lists) score += 10;
    const paragraphs = textContent.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 0) {
      const avgLength = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length;
      if (avgLength <= 100) score += 10;
    }
  }
  if (keywords && keywords.length > 0) score += 10;
  return Math.min(score, 100);
}

function ensureFocusKeywordUsage(content, keyword) {
  if (!content || !keyword) return content;
  let updated = content;
  const kw = keyword.trim();
  if (!kw) return content;
  const hasKw = (text) => text.toLowerCase().includes(kw.toLowerCase());
  updated = updated.replace(/<p>([^<]*)<\/p>/i, (match, p1) => {
    if (hasKw(p1)) return match;
    return `<p>${kw} - ${p1}</p>`;
  });
  updated = updated.replace(/(<h2[^>]*>[^<]*<\/h2>\s*<p>)([^<]*)(<\/p>)/i, (match, h2start, pText, pend) => {
    if (hasKw(pText)) return match;
    return `${h2start}${kw} - ${pText}${pend}`;
  });
  return updated;
}

async function ensureWordTarget({ content, targetWords, provider, apiKey, model, promptTemplates, maxTokens = null, temperature = 0.7, baseUrl = null }) {
  let draft = content || '';
  const minWords = Math.max(200, Math.floor(targetWords * 0.96));
  for (let i = 0; i < 2; i += 1) {
    const count = stripHtmlTags(draft).split(/\s+/).filter(Boolean).length;
    if (count >= minWords) return draft;
    const promptTemplate = i === 0 ? promptTemplates.expandPrompt : promptTemplates.padPrompt;
    const expandPrompt = renderTemplate(promptTemplate, { draft, targetWordCount: targetWords });
    const expandResponse = await chatCompletion({ provider, apiKey, model, maxTokens, temperature, baseUrl, messages: [{ role: 'user', content: expandPrompt }] });
    draft = expandResponse.text || draft;
  }
  return draft;
}

function normalizeImageGallery(gallery, imageUrl = null) {
  let list = [];
  if (Array.isArray(gallery)) {
    list = gallery.filter(Boolean);
  } else if (typeof gallery === 'string') {
    try {
      const parsed = JSON.parse(gallery);
      if (Array.isArray(parsed)) list = parsed.filter(Boolean);
    } catch {
      list = [];
    }
  }
  if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl);
  return list;
}

function appendImageToGallery(gallery, imageUrl) {
  const list = normalizeImageGallery(gallery);
  if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl);
  return list;
}

/* ============================ generate blog ============================ */

/**
 * Run the full generation pipeline.
 * @param {object} o
 * @param {object} o.user           authenticated user { id }
 * @param {string} o.ownerId        workspace owner id (for autosave scoping)
 * @param {function} o.onProgress   (step, message) => void  (streams to the client)
 * @param {function} o.getProviderApiKey  async (providerId) => key|null
 * @param {Array}  o.products       product context (already loaded for the workspace)
 */
export async function generateBlog(o) {
  const {
    topic,
    keywords,
    categories = [],
    settings,
    resumeState = null,
    mergedSettings,
    user,
    ownerId,
    onProgress = () => {},
    getProviderApiKey,
    products = [],
    destinationUrl = '',
    isAdmin = false,
    // When set, regenerate the content of this existing blog IN PLACE (update the same
    // history record) instead of creating a new one. Images are not touched.
    regenerateBlogId = '',
  } = o;

  let checkpoint = null;
  try {
    const provider = mergedSettings.aiProvider || 'openai';
    const apiKey = await getProviderApiKey(provider);
    if (!apiKey) throw new Error('API key not configured for selected provider');

    // NEVER log the raw settings object here — it carries API keys, publish-destination
    // tokens/app-passwords and OAuth secrets. Log only a non-sensitive summary.
    await addLog({
      level: 'info',
      category: 'generation',
      message: `Starting generation for "${topic}"`,
      details: {
        keywords,
        provider,
        model: mergedSettings.aiModel || 'gpt-4o',
        language: mergedSettings.language || 'English',
        writingStyle: mergedSettings.writingStyle || '',
        writingTone: mergedSettings.writingTone || '',
        targetWordCount: mergedSettings.targetWordCount || null,
        useProductContext: !!mergedSettings.useProductContext,
      },
      userId: user.id,
    });

    const chatModel = mergedSettings.aiModel || 'gpt-4o';
    const maxTokens = normalizeMaxTokens(mergedSettings.maxTokens);
    const temperature = normalizeTemperature(mergedSettings.temperature);
    const customProviders = Array.isArray(mergedSettings.customProviders) ? mergedSettings.customProviders : [];
    const providerBaseUrl = customBaseUrl(customProviders, provider);
    const promptTemplates = getPromptTemplates(mergedSettings);
    const sendProgress = (step, message) => onProgress(step, message);

    const language = mergedSettings.language || 'English';
    const canResume =
      resumeState &&
      resumeState.topic === topic &&
      JSON.stringify(resumeState.keywords || '') === JSON.stringify(keywords || '') &&
      resumeState.language === language;
    checkpoint = canResume
      ? { ...resumeState, responses: resumeState.responses || {} }
      : { topic, keywords, language, completedStep: -1, responses: {} };
    const markCheckpoint = (step, patch = {}) => {
      Object.assign(checkpoint, patch);
      checkpoint.completedStep = Math.max(checkpoint.completedStep || -1, step);
    };
    const focusKeyword = mergedSettings.focusKeyword || (Array.isArray(keywords) ? keywords[0] : keywords) || topic || '';
    const siteBaseUrl = mergedSettings.siteBaseUrl || '';

    // Pull a short brand/site context from the publishing destination (preferred) or the
    // store/website link the user supplied, so the blog carries that site's voice and
    // offerings. Best-effort, cached, no extra AI cost; skipped when fully resuming.
    let siteContextText = '';
    const knowledgeUrl = String(destinationUrl || mergedSettings.websiteUrl || siteBaseUrl || '').trim();
    if (knowledgeUrl && !checkpoint.blogContent) {
      try {
        const siteContext = await fetchSiteContext(knowledgeUrl);
        if (siteContext) {
          siteContextText = `\n\nPublishing site context — match this brand's voice, audience and offerings, and reference it naturally where it adds value (never fabricate details). Source: ${knowledgeUrl}\n${siteContext}`;
        }
      } catch (_siteContextError) {
        // Non-fatal: generation proceeds without site context.
      }
    }

    // ── Step 0: SEO research ──
    let seoResponse = checkpoint.responses.seoResponse || null;
    let seoData = checkpoint.seoData || null;
    if (!seoData) {
      sendProgress(0, 'Researching topic...');
      const seoPrompt = renderTemplate(promptTemplates.seoResearchPrompt, { topic, keywords: keywords || '', focusKeyword, language });
      seoResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: seoPrompt }] });
      seoData = normalizeSeoData(parseJsonContent(seoResponse.text));
      markCheckpoint(0, { seoData, responses: { ...checkpoint.responses, seoResponse: { usage: seoResponse?.usage || {} } } });
    } else {
      sendProgress(0, 'Resuming from saved topic research...');
    }

    // ── Step 1: source gathering + synthesis ──
    let researchSynthesisResponse = checkpoint.responses.researchSynthesisResponse || null;
    let researchContextText = checkpoint.researchContextText || '';
    if (!researchContextText) {
      sendProgress(1, 'Gathering sources...');
      const researchContextParts = [];
      const serpProvider = mergedSettings.serpProvider || 'openai';
      const serpModel = mergedSettings.serpModel || 'gpt-4o-mini';
      const deepResearchProvider = mergedSettings.deepResearchProvider || 'openai';
      const deepResearchModel = mergedSettings.deepResearchModel || 'gpt-4o-mini';

      if (serpProvider === 'openai') {
        const openaiKey = await getProviderApiKey('openai');
        if (openaiKey) {
          try {
            const openaiResult = await openaiWebSearch({ apiKey: openaiKey, query: `${topic} ${keywords || ''}`.trim(), model: serpModel });
            if (openaiResult.answer) researchContextParts.push(`OpenAI web search summary:\n${openaiResult.answer}`);
            if (openaiResult.results.length > 0) {
              const sources = openaiResult.results.map((item) => `- ${item.title} (${item.url})`).join('\n');
              researchContextParts.push(`OpenAI web sources:\n${sources}`);
            }
          } catch (error) {
            await addLog({ level: 'warn', category: 'generation', message: 'OpenAI web research failed', details: { error: error.message }, userId: user.id });
          }
        }
      }

      if (serpProvider === 'tavily') {
        const tavilyKey = await getProviderApiKey('tavily');
        if (tavilyKey) {
          try {
            const tavilyResult = await tavilySearch({ apiKey: tavilyKey, query: `${topic} ${keywords || ''}`.trim() });
            if (tavilyResult.answer) researchContextParts.push(`Tavily summary:\n${tavilyResult.answer}`);
            if (tavilyResult.results.length > 0) {
              const sources = tavilyResult.results.map((item) => `- ${item.title} (${item.url})`).join('\n');
              researchContextParts.push(`Tavily sources:\n${sources}`);
            }
          } catch (error) {
            await addLog({ level: 'warn', category: 'generation', message: 'Tavily research failed', details: { error: error.message }, userId: user.id });
          }
        }
      }

      if (mergedSettings.useWikipedia !== false) {
        try {
          const wiki = await wikipediaSummary(topic);
          if (wiki?.extract) {
            const wikiLine = wiki.url ? `${wiki.extract} (${wiki.url})` : wiki.extract;
            researchContextParts.push(`Wikipedia:\n${wikiLine}`);
          }
        } catch {
          /* best-effort */
        }
      }

      let researchSynthesis = '';
      const researchContext = researchContextParts.join('\n\n');
      if (deepResearchProvider && deepResearchProvider !== 'none') {
        const deepKey = await getProviderApiKey(deepResearchProvider);
        if (deepKey) {
          try {
            const synthesisPrompt = renderTemplate(promptTemplates.researchSynthesisPrompt, { topic, language, researchContext: researchContext || 'No external sources available.' });
            researchSynthesisResponse = await chatCompletion({ provider: deepResearchProvider, apiKey: deepKey, model: deepResearchModel, maxTokens, temperature, baseUrl: customBaseUrl(customProviders, deepResearchProvider), messages: [{ role: 'user', content: synthesisPrompt }] });
            researchSynthesis = researchSynthesisResponse.text || '';
          } catch (error) {
            await addLog({ level: 'warn', category: 'generation', message: 'Deep research failed', details: { error: error.message }, userId: user.id });
          }
        }
      }

      researchContextText = [
        researchContext ? `Research context:\n${researchContext}` : '',
        researchSynthesis ? `Research synthesis:\n${researchSynthesis}` : '',
      ].filter(Boolean).join('\n\n');
      markCheckpoint(1, {
        researchContextText,
        responses: { ...checkpoint.responses, researchSynthesisResponse: researchSynthesisResponse ? { usage: researchSynthesisResponse?.usage || {} } : null },
      });
    } else {
      sendProgress(1, 'Resuming from saved research context...');
    }

    // ── Step 2: key takeaways ──
    let takeawaysResponse = checkpoint.responses.takeawaysResponse || null;
    let keyTakeaways = checkpoint.keyTakeaways || '';
    if (!keyTakeaways) {
      sendProgress(2, 'Creating key takeaways...');
      const takeawaysPrompt = renderTemplate(promptTemplates.keyTakeawaysPrompt, { topic, language });
      takeawaysResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: [takeawaysPrompt, researchContextText].filter(Boolean).join('\n\n') }] });
      keyTakeaways = takeawaysResponse.text || '';
      markCheckpoint(2, { keyTakeaways, responses: { ...checkpoint.responses, takeawaysResponse: { usage: takeawaysResponse?.usage || {} } } });
    } else {
      sendProgress(2, 'Resuming from saved key takeaways...');
    }

    // ── Step 3: outline ──
    let outlineResponse = checkpoint.responses.outlineResponse || null;
    let outline = checkpoint.outline || null;
    if (!outline) {
      sendProgress(3, 'Creating outline...');
      const outlinePrompt = renderTemplate(promptTemplates.outlinePrompt, { topic, language, secondaryKeywords: seoData.secondaryKeywords.join(', ') });
      outlineResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: [outlinePrompt, researchContextText, siteContextText].filter(Boolean).join('\n\n') }] });
      outline = parseJsonContent(outlineResponse.text) || { sections: [] };
      markCheckpoint(3, { outline, responses: { ...checkpoint.responses, outlineResponse: { usage: outlineResponse?.usage || {} } } });
    } else {
      sendProgress(3, 'Resuming from saved outline...');
    }

    // ── Step 4: write blog ──
    const productContext = mergedSettings.useProductContext ? products : [];
    const productContextText =
      productContext.length > 0
        ? `\n\nProduct context — weave 2-4 of these into the blog naturally where they add value, and wrap each mention in <a href="URL">name</a>. Do not invent or rename products; use the exact URLs below. Do not add external links to other sites.\n${productContext
            .slice(0, 20)
            .map((item) => {
              const image = item.image ? ` | Image: ${item.image}` : '';
              return `- ${item.title} | ${item.url || ''}${image}`;
            })
            .join('\n')}`
        : '';
    let blogResponse = checkpoint.responses.blogResponse || null;
    let blogContent = checkpoint.blogContent || null;
    if (!blogContent) {
      sendProgress(4, 'Writing blog content...');
      const blogPrompt = [
        promptTemplates.styleGuardrails,
        promptTemplates.seoStructureGuardrails,
        renderTemplate(promptTemplates.blogPrompt, {
          topic,
          language,
          writingStyle: mergedSettings.writingStyle || 'professional',
          writingTone: mergedSettings.writingTone || 'friendly',
          targetWordCount: mergedSettings.targetWordCount || 2500,
          primaryKeyword: seoData.primaryKeyword || '',
          secondaryKeywords: seoData.secondaryKeywords.join(', '),
          outline: JSON.stringify(outline.sections || [], null, 2),
        }),
        researchContextText ? `\n\n${researchContextText}` : '',
        siteBaseUrl ? `\n\nInternal site URL: ${siteBaseUrl}` : '',
        siteContextText,
        productContextText,
      ].filter(Boolean).join('\n\n');
      blogResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: blogPrompt }] });
      blogContent = parseJsonContent(blogResponse.text);
      if (!blogContent || !blogContent.content) {
        blogContent = { title: '', metaDescription: '', content: blogResponse.text || '' };
      }
      markCheckpoint(4, { blogContent, responses: { ...checkpoint.responses, blogResponse: { usage: blogResponse?.usage || {} } } });
    } else {
      sendProgress(4, 'Resuming from saved draft...');
    }

    // ── Step 5: repair (if draft looks like an outline) ──
    const contentText = blogContent.content || '';
    const contentWords = stripHtmlTags(contentText).split(/\s+/).filter(Boolean).length;
    const looksLikeOutline = /^#?\s*outline/i.test(contentText) || contentWords < 300 || contentText.split(/\n/).length < 3;
    let repairResponse = checkpoint.responses.repairResponse || null;
    if (looksLikeOutline && !checkpoint.repairCompleted) {
      sendProgress(5, 'Repairing draft...');
      const repairPrompt = renderTemplate(promptTemplates.repairPrompt, { draft: contentText });
      repairResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: repairPrompt }] });
      const repaired = parseJsonContent(repairResponse.text);
      if (repaired && repaired.content) blogContent = repaired;
      markCheckpoint(5, { repairCompleted: true, blogContent, responses: { ...checkpoint.responses, repairResponse: repairResponse ? { usage: repairResponse?.usage || {} } : null } });
    } else if (looksLikeOutline) {
      sendProgress(5, 'Resuming from repaired draft...');
    }

    // ── Step 6: humanize ──
    let humanizedResponse = checkpoint.responses.humanizedResponse || null;
    let humanizedContent = checkpoint.humanizedContent || '';
    if (!humanizedContent) {
      sendProgress(6, 'Humanizing content...');
      const humanizePrompt = renderTemplate(promptTemplates.humanizePrompt, { draft: blogContent.content || contentText });
      humanizedResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: humanizePrompt }] });
      humanizedContent = humanizedResponse.text || blogContent.content;
      markCheckpoint(6, { humanizedContent, responses: { ...checkpoint.responses, humanizedResponse: { usage: humanizedResponse?.usage || {} } } });
    } else {
      sendProgress(6, 'Resuming from humanized content...');
    }

    // ── Step 7: compliance ──
    let complianceResponse = checkpoint.responses.complianceResponse || null;
    let compliantContent = checkpoint.compliantContent || '';
    if (!compliantContent) {
      sendProgress(7, 'Checking compliance...');
      const compliancePrompt = renderTemplate(promptTemplates.compliancePrompt, { draft: humanizedContent });
      complianceResponse = await chatCompletion({ provider, apiKey, model: chatModel, maxTokens, temperature, baseUrl: providerBaseUrl, messages: [{ role: 'user', content: compliancePrompt }] });
      compliantContent = complianceResponse.text || humanizedContent;
      markCheckpoint(7, { compliantContent, responses: { ...checkpoint.responses, complianceResponse: { usage: complianceResponse?.usage || {} } } });
    } else {
      sendProgress(7, 'Resuming from compliance check...');
    }

    // ── Step 8: expand to target length ──
    const targetWords = mergedSettings.targetWordCount || 2500;
    let expandedContent = checkpoint.expandedContent || '';
    if (!expandedContent) {
      expandedContent = await ensureWordTarget({ content: compliantContent, targetWords, provider, apiKey, model: chatModel, promptTemplates, maxTokens, temperature, baseUrl: providerBaseUrl });
      markCheckpoint(8, { expandedContent });
    }
    const finalWordsCheck = stripHtmlTags(expandedContent).split(/\s+/).filter(Boolean).length;
    if (finalWordsCheck < targetWords * 0.9) {
      throw new Error(`Generated content too short (${finalWordsCheck} words, target ${targetWords}). Please retry.`);
    }

    const imageUrl = null;
    sendProgress(8, 'Finalizing...');

    const usage = [seoResponse, takeawaysResponse, outlineResponse, blogResponse, repairResponse, humanizedResponse, complianceResponse, researchSynthesisResponse]
      .filter(Boolean)
      .reduce(
        (acc, item) => ({
          promptTokens: acc.promptTokens + (item.usage?.promptTokens || 0),
          completionTokens: acc.completionTokens + (item.usage?.completionTokens || 0),
        }),
        { promptTokens: 0, completionTokens: 0 }
      );
    const estimatedCost = estimateCost({ provider, model: chatModel, usage, images: 0 });

    const chosenKeyword = mergedSettings.focusKeyword || (Array.isArray(keywords) ? keywords[0] : keywords) || seoData.primaryKeyword || topic || '';

    let finalContent = expandedContent || compliantContent || humanizedContent || blogContent.content || '';
    finalContent = ensureFocusKeywordUsage(finalContent, chosenKeyword);
    finalContent = stripMarkdownFences(finalContent);
    finalContent = linkProducts(finalContent, productContext);
    finalContent = keepOnlyScrapedLinks(finalContent, productContext);
    finalContent = renumberH2Headings(finalContent);
    if (!isTechnicalTopic(topic, keywords)) finalContent = stripCodeBlocks(finalContent);
    const wordCount = stripHtmlTags(finalContent).split(/\s+/).filter(Boolean).length;
    const seoScore = calculateSeoScore(finalContent, blogContent.title, blogContent.metaDescription, seoData.secondaryKeywords, focusKeyword);

    const normalizedCategories = Array.isArray(categories)
      ? categories.map((c) => String(c).trim()).filter(Boolean)
      : String(categories || '').split(',').map((c) => c.trim()).filter(Boolean);

    const result = {
      title: blogContent.title || `Blog: ${topic}`,
      topic,
      content: finalContent,
      metaDescription: blogContent.metaDescription || '',
      keywords: seoData.secondaryKeywords || [],
      categories: normalizedCategories,
      keyTakeaways,
      imageUrl,
      wordCount,
      seoScore,
      generatedAt: new Date().toISOString(),
      language,
      cost: estimatedCost,
      // Persist the generation inputs so "Generate again" can reuse the exact same settings
      // (style/tone/length/focus/product context), not just topic + keywords.
      genParams: {
        // The ORIGINAL input keywords (not the AI-generated secondary keywords stored in
        // `keywords`), so Generate Again reuses exactly what was typed the first time.
        keywords: Array.isArray(keywords) ? keywords : String(keywords ?? ''),
        writingStyle: mergedSettings.writingStyle || 'professional',
        writingTone: mergedSettings.writingTone || 'friendly',
        targetWordCount: Number(mergedSettings.targetWordCount || 2500),
        focusKeyword: focusKeyword || '',
        language,
        useProductContext: !!mergedSettings.useProductContext,
        websiteUrl: mergedSettings.websiteUrl || mergedSettings.siteBaseUrl || '',
        scraperPlatform: mergedSettings.scraperPlatform || 'generic',
      },
    };

    sendProgress(9, 'Complete!');

    if (regenerateBlogId) {
      // Regenerate in place: overwrite the existing record's content/title/meta/etc., but
      // keep its images (the image is regenerated separately, on demand).
      const existing = await getBlogById(regenerateBlogId, { userId: ownerId, isAdmin });
      if (!existing) throw new Error('Blog to regenerate was not found');
      const preservedImageUrl = existing.imageUrl || existing.image_url || '';
      const preservedGallery = Array.isArray(existing.imageGallery)
        ? existing.imageGallery
        : Array.isArray(existing.image_gallery)
        ? existing.image_gallery
        : [];
      const updatedBlog = {
        ...result,
        id: regenerateBlogId,
        imageUrl: preservedImageUrl,
        imageGallery: preservedGallery,
        // Accumulate cost across regenerations rather than resetting it.
        cost: Number(existing.cost || 0) + estimatedCost,
      };
      await updateBlog({ blog: updatedBlog, userId: ownerId, isAdmin });
      result.id = regenerateBlogId;
      result.imageUrl = preservedImageUrl;
      result.imageGallery = preservedGallery;
    } else if (mergedSettings.autoSave !== false) {
      const savedId = await saveBlog(result, ownerId || user.id);
      if (savedId) result.id = savedId;
    }
    await trackApiUsage({ userId: user.id, cost: estimatedCost, tokens: usage.promptTokens + usage.completionTokens });
    await logActivity({ userId: user.id, action: 'blog.generate', details: `Generated "${result.title}"` });
    await addNotification({ userId: user.id, type: 'info', message: `Blog generated: "${result.title}"` });
    await addLog({
      level: 'info',
      category: 'generation',
      message: `Completed generation for "${result.title}"`,
      details: { cost: estimatedCost, tokensUsed: usage.promptTokens + usage.completionTokens, promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, provider, model: chatModel, blogId: result.id || null, blogTitle: result.title, genParams: result.genParams },
      blogId: result.id || null,
      tokensUsed: usage.promptTokens + usage.completionTokens,
      cost: estimatedCost,
      userId: user.id,
    });

    return { success: true, blog: result };
  } catch (error) {
    if (user) {
      await addLog({ level: 'error', category: 'generation', message: error.message, details: { topic, keywords }, userId: user.id }).catch(() => {});
    }
    return { success: false, error: error.message, resumeState: checkpoint ? { ...checkpoint, failedAt: new Date().toISOString() } : null };
  }
}

/* ============================ generate image ============================ */

/**
 * Generate a featured image and (optionally) attach it to a saved blog.
 * Phase 3: stores the provider image URL/data-URL directly. S3 offload is Phase 4.
 */
export async function generateBlogImage(o) {
  const { blogId, title, content, mergedSettings, storedSettings = {}, user, ownerId, isAdmin = false, getProviderApiKey, uploadStorage = null } = o;

  const provider = mergedSettings.imageProvider || mergedSettings.aiProvider || 'openai';
  const customProviders = Array.isArray(mergedSettings.customProviders) ? mergedSettings.customProviders : [];
  const baseUrl = customBaseUrl(customProviders, provider);
  const providerInfo = resolveProviderInfo(provider, baseUrl);
  if (!providerInfo?.supportsImages) throw new Error(`Selected provider "${provider}" does not support image generation`);
  const apiKey = await getProviderApiKey(provider);
  if (!apiKey) throw new Error(`API key not configured for selected provider "${provider}"`);

  const promptTemplates = getPromptTemplates(mergedSettings);
  const topic = title || (content || '').slice(0, 120) || 'Blog featured image';
  const imagePrompt = buildImagePrompt({ title: topic, content, template: promptTemplates.imagePrompt });
  const selectedImageModel = mergedSettings.imageModel || IMAGE_DEFAULT_MODEL[provider] || IMAGE_DEFAULT_MODEL.openai;
  const imageResult = await generateImage({ provider, apiKey, model: selectedImageModel, prompt: imagePrompt, baseUrl });
  if (!imageResult.imageUrl) throw new Error(`Image generation failed for provider "${provider}"`);

  // Offload to the configured image storage endpoint when enabled, so the blog stores
  // a hosted URL instead of a large base64 data-URL. Best-effort: fall back to the
  // provider URL if upload fails.
  let finalImageUrl = imageResult.imageUrl;
  if (storedSettings.imageStorage?.enabled && typeof uploadStorage === 'function') {
    try {
      const hosted = await uploadStorage({
        blog: blogId ? { id: blogId, title: title || topic } : { title: title || topic },
        imageUrl: imageResult.imageUrl,
        storage: storedSettings.imageStorage,
        filenameBase: title || topic,
      });
      if (!hosted) throw new Error('Image storage did not return a URL');
      finalImageUrl = hosted;
    } catch (uploadErr) {
      // Storage is enabled, so the image MUST be hosted there. Never fall back to
      // persisting a base64 data-URL in the DB. If the provider gave us a real hosted URL
      // we can keep that; otherwise surface the error so the endpoint/token gets fixed.
      await addLog({
        level: 'error',
        category: 'image',
        message: `Image storage upload failed: ${uploadErr.message}`,
        details: { blogId: blogId || null, blogTitle: title || topic || '' },
        userId: user.id,
      }).catch(() => {});
      if (!/^https?:\/\//i.test(String(finalImageUrl || ''))) {
        throw new Error(`Image storage upload failed (${uploadErr.message}). Image not saved to avoid storing base64 in the database — check the image storage endpoint/token in Settings.`);
      }
      // else: keep the provider's hosted http(s) URL
    }
  }
  let updatedBlog = null;

  if (blogId) {
    const existing = await getBlogById(blogId, { userId: ownerId, isAdmin });
    if (existing) {
      const existingGallery = normalizeImageGallery(existing.imageGallery || existing.image_gallery, existing.imageUrl || existing.image_url);
      const nextGallery = appendImageToGallery(existingGallery, finalImageUrl);
      updatedBlog = {
        ...existing,
        imageUrl: finalImageUrl,
        imageGallery: nextGallery,
        localImagePath: existing.local_image_path || existing.localImagePath || '',
        cost: (existing.cost || 0) + (imageResult.cost || 0),
      };
      await updateBlog({ blog: updatedBlog, userId: ownerId, isAdmin });
    }
  }

  await trackApiUsage({ userId: user.id, cost: imageResult.cost || 0, tokens: 0 });
  await addLog({
    level: 'info',
    category: 'image',
    message: `Generated blog image${title ? ` for "${title}"` : ''}`,
    details: { cost: imageResult.cost || 0, tokensUsed: 0, blogId: blogId || null, blogTitle: title || topic || '', imagesGenerated: 1 },
    blogId: blogId || null,
    tokensUsed: 0,
    cost: imageResult.cost || 0,
    userId: user.id,
  });

  return { success: true, imageUrl: finalImageUrl, localPath: '', imageGallery: updatedBlog?.imageGallery || null, blog: updatedBlog };
}
