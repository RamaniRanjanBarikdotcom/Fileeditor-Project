import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = dirname(scriptDirectory);
const pdfjsBuild = fileURLToPath(import.meta.resolve('pdfjs-dist/build/pdf.mjs'));
const pdfjsDirectory = dirname(dirname(pdfjsBuild));
const outputDirectory = join(webDirectory, 'public', 'pdfjs');
const assetDirectories = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

await mkdir(outputDirectory, { recursive: true });

for (const assetDirectory of assetDirectories) {
  await cp(join(pdfjsDirectory, assetDirectory), join(outputDirectory, assetDirectory), {
    recursive: true,
    force: true,
  });
}

console.log(`Prepared PDF.js runtime assets in ${outputDirectory}`);

