import { CORD_COUNT, cordCrossings, cordsUntangled, isCordOrder, swapCordEnds } from "./cordPuzzle.ts";
import type { CordOrder } from "./cordPuzzle.ts";

interface CordStep {
  readonly from: number;
  readonly to: number;
  readonly before: CordOrder;
  readonly after: CordOrder;
}

export interface CordChange {
  readonly kind: "move" | "undo";
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

// 只属于本次打开的界面，不进入 GameState 或存档。排列仍以原 onMove 返回值为准。
export interface CordPuzzleHistory {
  readonly order: CordOrder;
  readonly steps: readonly CordStep[];
  readonly moves: number;
  readonly revision: number;
  readonly lastChange: CordChange | null;
}

export interface CordOperation extends CordStep {
  readonly kind: "move" | "undo";
  readonly revision: number;
}

export interface CordSettlement {
  readonly history: CordPuzzleHistory;
  readonly status: "committed" | "rejected" | "resynced" | "stale";
}

const sameOrder = (first: CordOrder, second: CordOrder): boolean =>
  first.length === second.length && first.every((cord, slot) => cord === second[slot]);

export function createCordPuzzleHistory(order: CordOrder): CordPuzzleHistory {
  return { order: [...order], steps: [], moves: 0, revision: 0, lastChange: null };
}

export function prepareCordMove(history: CordPuzzleHistory, from: number, to: number): CordOperation | null {
  if (cordsUntangled(history.order)) return null;
  const next = swapCordEnds(history.order, from, to);
  if (next === history.order) return null;
  return { from, to, before: [...history.order], after: [...next], kind: "move", revision: history.revision };
}

export function prepareCordUndo(history: CordPuzzleHistory): CordOperation | null {
  if (cordsUntangled(history.order)) return null;
  const step = history.steps[history.steps.length - 1];
  if (!step || !sameOrder(step.after, history.order)) return null;
  return {
    from: step.from, to: step.to, before: [...history.order], after: [...step.before],
    kind: "undo", revision: history.revision,
  };
}

// UI 先调用原有保存回调，再把实际排列交回本函数；失败不能添加或弹出历史。
export function settleCordOperation(history: CordPuzzleHistory, operation: CordOperation, actual: CordOrder): CordSettlement {
  if (operation.revision !== history.revision || !sameOrder(operation.before, history.order)) {
    return { history, status: "stale" };
  }
  if (!isCordOrder(actual) || sameOrder(actual, operation.before)) return { history, status: "rejected" };
  if (!sameOrder(actual, operation.after)) {
    // 例如视图期间进度已变：接收实际排列，但不能拿旧步骤逆转另一个排列。
    return {
      history: { ...history, order: [...actual], steps: [], revision: history.revision + 1, lastChange: null },
      status: "resynced",
    };
  }
  const before = cordCrossings(operation.before);
  const after = cordCrossings(actual);
  const steps = operation.kind === "undo"
    ? history.steps.slice(0, -1)
    : [...history.steps, { from: operation.from, to: operation.to, before: [...operation.before], after: [...actual] }];
  return {
    history: {
      order: [...actual], steps: cordsUntangled(actual) ? [] : steps,
      moves: history.moves + 1, revision: history.revision + 1,
      lastChange: { kind: operation.kind, before, after, delta: after - before },
    },
    status: "committed",
  };
}

export function cordCrossingPartners(order: CordOrder, cord: number): readonly number[] {
  if (!isCordOrder(order) || !Number.isInteger(cord) || cord < 0 || cord >= CORD_COUNT) return [];
  const start = order.indexOf(cord);
  const end = order.lastIndexOf(cord);
  const inside = new Set<number>();
  // 相交的绳恰好有一个端点落在所选绳的两端之间。
  for (let slot = start + 1; slot < end; slot += 1) {
    const other = order[slot];
    if (inside.has(other)) inside.delete(other);
    else inside.add(other);
  }
  return [...inside].sort((first, second) => first - second);
}
