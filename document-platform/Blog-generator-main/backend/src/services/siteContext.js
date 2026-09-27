// Lightweight "brand/site context" extractor. Given a site URL (the publish destination
// or a store link the user provided), fetch the homepage (+ an about page) and condense
// the title, meta description, headings and intro copy into a short note that gets woven
// into generation so the blog matches the site's voice/offerings. No LLM call, cached.

import axios from 'axios';
import * as cheerio from 'cheerio';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — brand pages change rarely.
const FETCH_TIMEOUT_MS = 8000;
const MAX_CONTEXT_CHARS = 1400;
const cache = new Map(); // origin -> { ts, text }

const UA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

// Reduce a URL to its origin (scheme + host); add https:// if the scheme is missing.
function toOrigin(rawUrl) {
  let value = String(rawUrl || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: UA_HEADERS,
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 3,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return typeof res.data === 'string' ? res.data : '';
}

function extractFromHtml(html) {
  const $ = cheerio.load(html);
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const title = clean($('title').first().text());
  const metaDescription = clean(
    $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')
  );
  const siteName = clean($('meta[property="og:site_name"]').attr('content'));
  const headings = [];
  $('h1, h2').each((_, el) => {
    if (headings.length >= 10) return;
    const text = clean($(el).text());
    if (text && text.length <= 90) headings.push(text);
  });
  const paragraphs = [];
  $('p').each((_, el) => {
    if (paragraphs.length >= 4) return;
    const text = clean($(el).text());
    if (text && text.length > 40) paragraphs.push(text);
  });
  return {
    title,
    metaDescription,
    siteName,
    headings: Array.from(new Set(headings)),
    intro: paragraphs.join(' '),
  };
}

/**
 * Build a short brand/site context note for the given site URL. Best-effort: returns ''
 * on any failure so generation never breaks because a site was unreachable.
 */
export async function fetchSiteContext(rawUrl) {
  const origin = toOrigin(rawUrl);
  if (!origin) return '';

  const cached = cache.get(origin);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.text;

  const parts = [];
  let hasAbout = false;
  try {
    const homepage = await fetchHtml(origin);
    if (homepage) {
      const { title, metaDescription, siteName, headings, intro } = extractFromHtml(homepage);
      if (siteName) parts.push(`Site name: ${siteName}`);
      if (title) parts.push(`Homepage title: ${title}`);
      if (metaDescription) parts.push(`Site description: ${metaDescription}`);
      if (headings.length) parts.push(`Key sections: ${headings.join('; ')}`);
      if (intro) {
        parts.push(`About: ${intro}`);
        hasAbout = true;
      }
    }
  } catch {
    /* ignore — homepage unreachable */
  }

  if (!hasAbout) {
    for (const path of ['/about', '/about-us', '/pages/about', '/pages/about-us']) {
      try {
        const html = await fetchHtml(`${origin}${path}`);
        if (html) {
          const { intro } = extractFromHtml(html);
          if (intro) {
            parts.push(`About: ${intro}`);
            break;
          }
        }
      } catch {
        /* try next candidate */
      }
    }
  }

  let text = parts.join('\n');
  if (text.length > MAX_CONTEXT_CHARS) text = `${text.slice(0, MAX_CONTEXT_CHARS)}…`;
  cache.set(origin, { ts: Date.now(), text });
  return text;
}

export default { fetchSiteContext };
