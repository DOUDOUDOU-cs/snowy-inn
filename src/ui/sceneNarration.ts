/** Reading pages are display only: keep every character of the authored narration. */
export function narrationPages(paragraphs: readonly string[], limit = 90): string[] {
  const size = Number.isFinite(limit) ? Math.max(30, Math.min(220, Math.floor(limit))) : 90;
  const pages: string[] = [];
  for (const paragraph of paragraphs) {
    let remaining = Array.from(paragraph);
    while (remaining.length > size) {
      let end = size;
      for (let index = size - 1; index >= Math.floor(size / 2); index--) {
        if (/[。！？；.!?;]/u.test(remaining[index]!)) {
          end = index + 1;
          if (/[”’」』]/u.test(remaining[end] ?? "")) end++;
          break;
        }
      }
      pages.push(remaining.slice(0, end).join(""));
      remaining = remaining.slice(end);
    }
    if (remaining.length) pages.push(remaining.join(""));
  }
  return pages;
}
