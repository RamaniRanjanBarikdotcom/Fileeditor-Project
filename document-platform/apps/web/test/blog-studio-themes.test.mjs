import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharedTypes from '@docconv/shared-types';

const { BLOG_STUDIO_THEMES, DEFAULT_BLOG_STUDIO_THEME } = sharedTypes;
const css = fs.readFileSync(new URL('../src/blog-studio-themes.css', import.meta.url), 'utf8');

function themeVariables(theme) {
  const block = css.match(new RegExp(`\\[data-blog-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  assert.ok(block, `missing stylesheet block for theme "${theme}"`);
  return Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('every selectable non-default theme has a complete palette', () => {
  for (const theme of BLOG_STUDIO_THEMES.filter((id) => id !== DEFAULT_BLOG_STUDIO_THEME)) {
    const variables = themeVariables(theme);
    for (const family of ['indigo', 'blue', 'violet', 'purple', 'fuchsia', 'pink', 'sky']) {
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        assert.ok(variables[`--color-${family}-${step}`], `${theme}: --color-${family}-${step}`);
      }
    }
  }
});

test('theme accents keep WCAG AA contrast for buttons and links', () => {
  for (const theme of BLOG_STUDIO_THEMES.filter((id) => id !== DEFAULT_BLOG_STUDIO_THEME)) {
    const variables = themeVariables(theme);
    const surface = variables['--color-slate-50'] ?? '#f8fafc';
    for (const step of [600, 700]) {
      const accent = variables[`--color-indigo-${step}`];
      // White text on accent buttons, and accent text on white / page background.
      assert.ok(contrast(accent, '#ffffff') >= 4.5, `${theme} indigo-${step} on white`);
      assert.ok(contrast(accent, surface) >= 4.5, `${theme} indigo-${step} on page background`);
    }
    // Accent text in dark mode (text-indigo-400 on the darkest surface).
    const darkSurface = variables['--color-slate-950'] ?? '#020617';
    assert.ok(contrast(variables['--color-indigo-400'], darkSurface) >= 4.5, `${theme} dark accent text`);
  }
});
