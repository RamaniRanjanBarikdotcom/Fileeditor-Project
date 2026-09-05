import { PDFDocument } from 'pdf-lib';
import { Readable } from 'stream';
import { ConversionOptions, DEFAULT_MARGINS, Orientation, PageSize } from '@docconv/shared-types';

export class ImagePdfAdapter {
  async convert(
    inputStream: Readable,
    sourceFormat: string,
    options: ConversionOptions = {},
  ): Promise<Readable> {
    const chunks: Buffer[] = [];
    for await (const chunk of inputStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const input = Buffer.concat(chunks);

    const pdf = await PDFDocument.create();
    const normalized = sourceFormat.toLowerCase();
    const image = normalized === 'png' ? await pdf.embedPng(input) : await pdf.embedJpg(input);

    const sizes: Record<PageSize, [number, number]> = {
      [PageSize.A4]: [595.28, 841.89],
      [PageSize.A3]: [841.89, 1190.55],
      [PageSize.A5]: [419.53, 595.28],
      [PageSize.LETTER]: [612, 792],
      [PageSize.LEGAL]: [612, 1008],
    };
    const base = sizes[options.pageSize || PageSize.A4];
    const [pageWidth, pageHeight] =
      options.orientation === Orientation.LANDSCAPE ? [base[1], base[0]] : base;
    const margins = options.margins || DEFAULT_MARGINS;
    const left = (margins.left * 72) / 25.4;
    const right = (margins.right * 72) / 25.4;
    const top = (margins.top * 72) / 25.4;
    const bottom = (margins.bottom * 72) / 25.4;
    const scale = Math.min(
      (pageWidth - left - right) / image.width,
      (pageHeight - top - bottom) / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: left + (pageWidth - left - right - width) / 2,
      y: bottom + (pageHeight - top - bottom - height) / 2,
      width,
      height,
    });

    return Readable.from(Buffer.from(await pdf.save()));
  }
}
