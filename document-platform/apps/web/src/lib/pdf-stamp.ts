// Text stamping for watermark, header/footer, page-number and Bates tools.
//
// Two problems this solves:
//  1. pdf-lib's standard fonts only encode WinAnsi (Latin) text, so Hindi,
//     Chinese, Arabic and other scripts used to crash the tools. Such text is
//     rendered with the browser's own fonts onto a canvas and embedded as a
//     high-resolution image; Latin text stays real, selectable PDF text.
//  2. Pages with a /Rotate entry display rotated, so positions are computed in
//     the page's *visual* coordinates and mapped back to PDF user space, and the
//     text is counter-rotated so it always reads upright.
import { degrees, rgb } from 'pdf-lib';
import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib';

export type Rgb = { r: number; g: number; b: number };

export interface PreparedText {
  width: number;
  /** Visual height of the drawn text block (cap height for vector text). */
  height: number;
  draw(
    page: PDFPage,
    options: { x: number; y: number; angle: number; color: Rgb; opacity: number },
  ): void;
}

export function hexToRgb(value: unknown, fallback: Rgb = { r: 0.2, g: 0.2, b: 0.2 }): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  const hex = Number.parseInt(match[1]!, 16);
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}

function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

const rasterCache = new WeakMap<PDFDocument, Map<string, { image: PDFImage; aspect: number }>>();

async function rasterizeText(
  pdf: PDFDocument,
  text: string,
  color: Rgb,
): Promise<{ image: PDFImage; aspect: number }> {
  const key = `${text}|${color.r},${color.g},${color.b}`;
  let cache = rasterCache.get(pdf);
  if (!cache) rasterCache.set(pdf, (cache = new Map()));
  const cached = cache.get(key);
  if (cached) return cached;

  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error(
      'This browser cannot draw this script. Update your browser, or use Latin characters.',
    );
  }
  // Render large so the embedded image stays sharp when printed.
  const fontPx = 160;
  const fontStack =
    '"Noto Sans", "Segoe UI", "Helvetica Neue", Arial, "Nirmala UI", "Mangal", "Noto Sans Devanagari", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Noto Sans Arabic", sans-serif';
  const probe = new OffscreenCanvas(8, 8).getContext('2d');
  if (!probe) throw new Error('The browser text canvas could not be initialized.');
  probe.font = `600 ${fontPx}px ${fontStack}`;
  const metrics = probe.measureText(text);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontPx * 0.8);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontPx * 0.25);
  const pad = Math.ceil(fontPx * 0.08);
  const width = Math.max(1, Math.ceil(metrics.width) + pad * 2);
  const height = Math.max(1, ascent + descent + pad * 2);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser text canvas could not be initialized.');
  context.font = probe.font;
  context.fillStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
  context.textBaseline = 'alphabetic';
  context.fillText(text, pad, pad + ascent);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const image = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
  const result = { image, aspect: width / height };
  cache.set(key, result);
  return result;
}

/**
 * Prepares `text` at `size` points. Uses vector text when the standard font can
 * encode it, otherwise a rasterized image with matching proportions.
 */
export async function prepareText(
  pdf: PDFDocument,
  font: PDFFont,
  text: string,
  size: number,
  color: Rgb,
): Promise<PreparedText> {
  if (canEncode(font, text)) {
    const width = font.widthOfTextAtSize(text, size);
    const height = font.heightAtSize(size, { descender: false });
    return {
      width,
      height,
      draw(page, { x, y, angle, color: fill, opacity }) {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(fill.r, fill.g, fill.b),
          opacity,
          rotate: degrees(angle),
        });
      },
    };
  }
  const { image, aspect } = await rasterizeText(pdf, text, color);
  const height = size * 1.25;
  const width = height * aspect;
  return {
    width,
    height,
    draw(page, { x, y, angle, opacity }) {
      page.drawImage(image, {
        x,
        y,
        width,
        height,
        opacity,
        rotate: degrees(angle),
      });
    },
  };
}

/** The page as the reader sees it: displayed size and the /Rotate angle. */
export function visualFrame(page: PDFPage) {
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  const swapped = rotation === 90 || rotation === 270;
  return {
    rotation,
    box,
    width: swapped ? box.height : box.width,
    height: swapped ? box.width : box.height,
  };
}

/** Maps a point in displayed (visual) coordinates to PDF user space. */
export function visualToUser(page: PDFPage, vx: number, vy: number): { x: number; y: number } {
  const { rotation, box } = visualFrame(page);
  const W = box.width;
  const H = box.height;
  let x = vx;
  let y = vy;
  if (rotation === 90) {
    x = W - vy;
    y = vx;
  } else if (rotation === 180) {
    x = W - vx;
    y = H - vy;
  } else if (rotation === 270) {
    x = vy;
    y = H - vx;
  }
  return { x: box.x + x, y: box.y + y };
}

/**
 * Draws prepared text so its block starts at visual point (vx, vy), reading
 * at `visualAngle` degrees counter-clockwise as displayed.
 */
export function drawAtVisual(
  page: PDFPage,
  text: PreparedText,
  vx: number,
  vy: number,
  options: { visualAngle?: number; color: Rgb; opacity?: number },
) {
  const { rotation } = visualFrame(page);
  const origin = visualToUser(page, vx, vy);
  text.draw(page, {
    x: origin.x,
    y: origin.y,
    angle: (options.visualAngle ?? 0) + rotation,
    color: options.color,
    opacity: options.opacity ?? 1,
  });
}

export type StampPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** Visual origin for a text block placed at one of six page positions. */
export function positionOrigin(
  page: PDFPage,
  text: PreparedText,
  position: StampPosition,
  margin: number,
): { vx: number; vy: number } {
  const { width, height } = visualFrame(page);
  const [vertical, horizontal] = position.split('-') as [
    'top' | 'bottom',
    'left' | 'center' | 'right',
  ];
  const vx =
    horizontal === 'left'
      ? margin
      : horizontal === 'right'
        ? Math.max(margin, width - margin - text.width)
        : Math.max(margin, (width - text.width) / 2);
  const vy = vertical === 'top' ? height - margin - text.height : margin;
  return { vx, vy };
}

/**
 * Origin that centres a rotated text block on the visual page, and the scale
 * factor needed so the rotated block stays inside `fill` of the page.
 */
export function centredRotatedOrigin(
  page: PDFPage,
  text: PreparedText,
  visualAngle: number,
  fill = 0.82,
): { vx: number; vy: number; fitScale: number } {
  const { width, height } = visualFrame(page);
  const theta = (visualAngle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const boundsWidth = text.width * cos + text.height * sin;
  const boundsHeight = text.width * sin + text.height * cos;
  const fitScale = Math.min(1, (width * fill) / boundsWidth, (height * fill) / boundsHeight);
  const w = text.width * fitScale;
  const h = text.height * fitScale;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // Text origin is its baseline-left corner; offset it so the block's centre
  // (w/2, h/2 in text space) lands on the page centre after rotation.
  const vx = width / 2 - (w / 2) * c + (h / 2) * s;
  const vy = height / 2 - (w / 2) * s - (h / 2) * c;
  return { vx, vy, fitScale };
}
