import { PDFDocument } from 'pdf-lib';
import { Readable } from 'stream';

export class ImagePdfAdapter {
  async convert(inputStream: Readable, sourceFormat: string): Promise<Readable> {
    const chunks: Buffer[] = [];
    for await (const chunk of inputStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const input = Buffer.concat(chunks);

    const pdf = await PDFDocument.create();
    const normalized = sourceFormat.toLowerCase();
    const image = normalized === 'png'
      ? await pdf.embedPng(input)
      : await pdf.embedJpg(input);

    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    return Readable.from(Buffer.from(await pdf.save()));
  }
}
