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

interface ReadingSource { journeyId: string; scene: string; paragraphs: readonly string[] }

/** One in-memory bookmark: system screens may interrupt reading, story changes reset it. */
export function createNarrationBookmark() {
  let bookmark: { key: string; offset: number; collapsed: boolean } | undefined;
  const keyFor = (source: ReadingSource) => JSON.stringify([source.journeyId, source.scene, source.paragraphs]);
  return {
    remember(source: ReadingSource, pages: readonly string[], page: number, collapsed: boolean,
      intent: "page" | "layout" = "page"): void {
      const index = Number.isFinite(page) ? Math.max(0, Math.min(pages.length - 1, Math.floor(page))) : 0;
      const key = keyFor(source);
      // Reflow may place the anchor mid-page. Keep that character rather than
      // rounding back to each new page start on repeated resize/system returns.
      const offset = intent === "layout" && bookmark?.key === key ? bookmark.offset
        : pages.slice(0, index).reduce((length, text) => length + Array.from(text).length, 0);
      bookmark = { key, collapsed, offset };
    },
    restore(source: ReadingSource, pages: readonly string[]): { page: number; collapsed: boolean } {
      if (!bookmark || bookmark.key !== keyFor(source)) return { page: 0, collapsed: false };
      let offset = 0, page = 0;
      while (page < pages.length - 1 && offset + Array.from(pages[page]!).length <= bookmark.offset) {
        offset += Array.from(pages[page]!).length;
        page++;
      }
      return { page, collapsed: bookmark.collapsed };
    },
  };
}
