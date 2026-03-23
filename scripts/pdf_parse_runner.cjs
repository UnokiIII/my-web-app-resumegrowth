const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const pdfPath = process.argv[2];
  const maxPages = Number(process.argv[3] || '3');
  const mode = process.argv[4] || 'text';

  if (!pdfPath) {
    console.log(JSON.stringify({ error: 'missing pdf path' }));
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    if (mode === 'text') {
      const payload = await parser.getText({ first: maxPages });
      console.log(JSON.stringify({ text: payload?.text || '' }));
      return;
    }

    if (mode === 'images') {
      const payload = await parser.getScreenshot({
        first: maxPages,
        scale: 1.0,
        imageDataUrl: false,
        imageBuffer: true,
      });

      const images = Array.isArray(payload?.pages)
        ? payload.pages
            .map((page) => {
              if (!page?.data) return null;
              return Buffer.from(page.data).toString('base64');
            })
            .filter(Boolean)
        : [];

      console.log(JSON.stringify({ images }));
      return;
    }

    if (mode === 'embedded-images') {
      const payload = await parser.getImage({
        first: maxPages,
        imageDataUrl: false,
        imageBuffer: true,
        imageThreshold: 50,
      });

      const images = Array.isArray(payload?.pages)
        ? payload.pages
            .flatMap((page) => page.images || [])
            .map((image) => {
              if (!image?.data) return null;
              return Buffer.from(image.data).toString('base64');
            })
            .filter(Boolean)
        : [];

      console.log(JSON.stringify({ images }));
      return;
    }

    console.log(JSON.stringify({ error: `unsupported mode: ${mode}` }));
    process.exit(1);
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  console.log(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
});
