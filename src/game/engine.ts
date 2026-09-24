import { openingScenes } from "../story/opening.ts";
import { hasItem } from "./state.ts";
import { cordsUntangled, normalizeCordOrder, swapCordEnds } from "./cordPuzzle.ts";
import type { GameState, ItemId, Scene } from "./types.ts";

// 读取画面不产生游戏效果，打开物品页或重画界面不会推进时间、重复拾取。
export function getScene(state: GameState): Scene {
  const scene = openingScenes[state.scene](state);
  return { ...scene, choices: scene.choices.filter(choice => !choice.available || choice.available(state)) };
}

export function choose(state: GameState, choiceId: string): GameState {
  const choice = getScene(state).choices.find(candidate => candidate.id === choiceId);
  if (!choice) return state;
  const updated = choice.apply ? choice.apply(state) : state;
  const next = typeof choice.next === "function" ? choice.next(updated) : choice.next;
  return { ...updated, scene: next };
}

export function inspectItem(state: GameState, item: ItemId): GameState {
  if (!hasItem(state, item)) return state;
  if (item === "ring" && state.flags.enteredInn && !state.flags.ringInscriptionRead) {
    return { ...state, flags: { ...state.flags, ringInscriptionRead: true } };
  }
  return state;
}

export function moveCord(state: GameState, from: number, to: number): GameState {
  if (state.scene !== "wardrobe" || hasItem(state, "bronzeKey")) return state;
  const order = normalizeCordOrder(state.cordOrder);
  if (cordsUntangled(order)) return state;
  const next = swapCordEnds(order, from, to);
  return next === order ? state : { ...state, cordOrder: [...next] };
}
