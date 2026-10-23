import { extractText, getDocumentProxy } from "unpdf";

// Takes the PDF as raw bytes (straight from the upload), so nothing is
// ever written to disk.
export async function extractResumeText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  // Hyperlink targets. A resume may show the word "LinkedIn" while the real
  // address is hidden behind it, so it never appears in the extracted text.
  const links: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();
    for (const annotation of annotations) {
      const url = annotation.url ?? annotation.unsafeUrl;
      if (url) links.push(url);
    }
  }

  return {
    text,
    pages: totalPages,
    links,
    // very little text usually means a scanned or image-based PDF
    readable: text.trim().length > 200,
  };
}
