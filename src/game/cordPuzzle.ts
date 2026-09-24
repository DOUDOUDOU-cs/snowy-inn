export const CORD_COUNT = 20;
export const ENDPOINT_COUNT = CORD_COUNT * 2;
export type CordOrder = readonly number[];

// 顺时针记录圆环上 40 个绳端。每个编号出现两次，代表同一根绳子的两端。
// 前后二十个端点采用不同顺序，初始形成 92 处交叉，也避免所有绳线都穿过同一点。
export const initialCordOrder: CordOrder = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  9, 16, 3, 14, 1, 18, 7, 12, 0, 15,
  5, 19, 10, 2, 17, 6, 13, 4, 11, 8,
]);

export const solvedCordOrder: CordOrder = Object.freeze(
  Array.from({ length: CORD_COUNT }, (_, cord) => [cord, cord]).flat(),
);

export function isCordOrder(value: unknown): value is CordOrder {
  if (!Array.isArray(value) || value.length !== ENDPOINT_COUNT
      || !value.every(cord => Number.isInteger(cord) && cord >= 0 && cord < CORD_COUNT)) return false;
  const counts = Array(CORD_COUNT).fill(0);
  value.forEach(cord => { counts[cord] += 1; });
  return counts.every(count => count === 2);
}

// 第 15 步存档使用 20 个不重复编号。读取时将“已解开”保留下来，
// 未解开的旧局面则进入新的环形初始局面。
export function isLegacyCordOrder(value: unknown): boolean {
  return Array.isArray(value) && value.length === CORD_COUNT
    && value.every(cord => Number.isInteger(cord) && cord >= 0 && cord < CORD_COUNT)
    && new Set(value).size === CORD_COUNT;
}

export function isStoredCordOrder(value: unknown): boolean {
  return isCordOrder(value) || isLegacyCordOrder(value);
}

export function normalizeCordOrder(value: readonly number[] | undefined): CordOrder {
  const stored: unknown = value;
  if (isCordOrder(stored)) return stored;
  if (isLegacyCordOrder(stored) && (stored as readonly number[]).every((cord, slot) => cord === slot)) return solvedCordOrder;
  return initialCordOrder;
}

export function swapCordEnds(order: CordOrder, from: number, to: number): CordOrder {
  if (!isCordOrder(order) || !Number.isInteger(from) || !Number.isInteger(to)
      || from < 0 || from >= ENDPOINT_COUNT || to < 0 || to >= ENDPOINT_COUNT
      || from === to || order[from] === order[to]) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function cordCrossings(order: CordOrder): number {
  if (!isCordOrder(order)) return 0;
  const positions = Array.from({ length: CORD_COUNT }, () => [] as number[]);
  order.forEach((cord, slot) => positions[cord].push(slot));
  let crossings = 0;
  for (let first = 0; first < CORD_COUNT; first++) {
    const [start, end] = positions[first];
    for (let second = first + 1; second < CORD_COUNT; second++) {
      const [one, two] = positions[second];
      const oneInside = start < one && one < end;
      const twoInside = start < two && two < end;
      if (oneInside !== twoInside) crossings += 1;
    }
  }
  return crossings;
}

export function cordsUntangled(order: CordOrder): boolean {
  return isCordOrder(order) && cordCrossings(order) === 0;
}
