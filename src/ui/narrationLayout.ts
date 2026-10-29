export interface Rect { left: number; top: number; width: number; height: number }
export interface NarrationPosition { left: number; top: number }

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** All rectangles use shell-local coordinates; no game or reading state is changed. */
export function placeNarration(bounds: Rect, size: { width: number; height: number },
  blockers: Rect[], previous?: NarrationPosition): NarrationPosition & { overlap: number } {
  const left = finite(bounds.left), top = finite(bounds.top);
  const boundsWidth = Math.max(0, finite(bounds.width));
  const boundsHeight = Math.max(0, finite(bounds.height));
  const width = clamp(finite(size.width), 0, boundsWidth);
  const height = clamp(finite(size.height), 0, boundsHeight);
  const maxLeft = left + boundsWidth - width, maxTop = top + boundsHeight - height;
  const obstacles = blockers.filter(rect => rect.width > 0 && rect.height > 0 &&
    Object.values(rect).every(Number.isFinite));
  const overlapAt = (x: number, y: number) => obstacles.reduce((sum, rect) => sum +
    Math.max(0, Math.min(x + width, rect.left + rect.width) - Math.max(x, rect.left)) *
    Math.max(0, Math.min(y + height, rect.top + rect.height) - Math.max(y, rect.top)), 0);
  const preferred = previous
    ? { left: clamp(finite(previous.left), left, maxLeft), top: clamp(finite(previous.top), top, maxTop) }
    : { left: (left + maxLeft) / 2, top: maxTop };
  const preferredOverlap = overlapAt(preferred.left, preferred.top);
  if (preferredOverlap === 0) return { ...preferred, overlap: 0 };

  // Overlap is bilinear between these edge events. Their intersections include
  // every free placement region, including narrow gaps between the nine usual anchors,
  // and a minimum when the entire surface is obstructed.
  const xs = new Set([left, maxLeft, (left + maxLeft) / 2, preferred.left]);
  const ys = new Set([top, maxTop, (top + maxTop) / 2, preferred.top]);
  for (const rect of obstacles) {
    for (const edge of [rect.left, rect.left + rect.width]) {
      xs.add(clamp(edge, left, maxLeft));
      xs.add(clamp(edge - width, left, maxLeft));
    }
    for (const edge of [rect.top, rect.top + rect.height]) {
      ys.add(clamp(edge, top, maxTop));
      ys.add(clamp(edge - height, top, maxTop));
    }
  }
  let best = { ...preferred, overlap: preferredOverlap };
  let bestDistance = 0;
  for (const x of xs) for (const y of ys) {
    const overlap = overlapAt(x, y);
    const distance = (x - preferred.left) ** 2 + (y - preferred.top) ** 2;
    if (overlap < best.overlap || (overlap === best.overlap && distance < bestDistance)) {
      best = { left: x, top: y, overlap };
      bestDistance = distance;
    }
  }
  return best;
}
