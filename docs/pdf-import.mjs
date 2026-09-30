import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = '/docs/vendor/pdfjs/pdf.worker.min.mjs';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 24;
const MAX_PAGE_TEXT = 10000;
const MAX_REQUEST_IMAGE_CHARS = 500_000;

export async function analyzePdfLocally(file) {
  if (!file || file.size === 0 || file.size > MAX_BYTES) throw new Error('Choose a non-empty PDF under 12 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('The selected file is not a valid PDF.');
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (!pdf.numPages || pdf.numPages > MAX_PAGES) throw new Error('PDFs must contain 1 to 24 pages.');
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str || '').join(' ').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_PAGE_TEXT);
      const viewport = page.getViewport({ scale: Math.min(1.6, 1250 / page.getViewport({ scale: 1 }).width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
      const image = canvas.toDataURL('image/jpeg', 0.68);
      let requestImage = image;
      if (requestImage.length > MAX_REQUEST_IMAGE_CHARS) {
        const variants = [
          { scale: viewport.scale, quality: 0.54 },
          { scale: viewport.scale * 0.9, quality: 0.52 },
          { scale: viewport.scale * 0.8, quality: 0.5 },
          { scale: viewport.scale * 0.7, quality: 0.46 }
        ];
        for (const variant of variants) {
          const requestViewport = page.getViewport({ scale: variant.scale });
          canvas.width = Math.ceil(requestViewport.width); canvas.height = Math.ceil(requestViewport.height);
          await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: requestViewport }).promise;
          requestImage = canvas.toDataURL('image/jpeg', variant.quality);
          if (requestImage.length <= MAX_REQUEST_IMAGE_CHARS) break;
        }
      }
      canvas.width = 0; canvas.height = 0;
      if (requestImage.length > MAX_REQUEST_IMAGE_CHARS) throw new Error('A rendered page is too large to send securely. Try a lower-resolution PDF.');
      pages.push({ page: number, text, image, requestImage });
      page.cleanup();
    }
    return { pageCount: pdf.numPages, pages };
  } finally { await task.destroy(); }
}
