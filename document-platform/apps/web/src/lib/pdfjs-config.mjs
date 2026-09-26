/**
 * PDF.js does not bundle its runtime font and colour resources into the worker.
 * They are copied from pdfjs-dist into public/pdfjs before dev/build and must be
 * supplied for PDFs that use standard fonts, composite fonts, CMaps, or ICC
 * colour profiles. Font-face rendering is deliberately disabled: PDF.js can
 * parse some embedded subset Type 1C/CFF fonts but browsers register the
 * generated FontFace with empty glyphs. PDF.js's built-in glyph-path renderer
 * handles those PDFs accurately and also works with OffscreenCanvas.
 */
export const PDFJS_DOCUMENT_OPTIONS = Object.freeze({
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
  useSystemFonts: false,
  disableFontFace: true,
  useWorkerFetch: true,
});
