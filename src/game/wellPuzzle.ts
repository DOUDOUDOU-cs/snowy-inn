import { getScene } from "./engine.ts";
import type { GameState, SceneId } from "./types.ts";

export type WellInteraction = "rope" | "groove" | "grip" | "crank" | "bucket";
export interface WellPuzzleView {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  hint: string;
  textAction?: { interaction: WellInteraction; label: string };
}

const stages: Partial<Record<SceneId, WellPuzzleView["stage"]>> = {
  ropeSlips: 0, ropeOnWindlass: 1, ropeWrapped: 2, ropeWoundOnce: 3, ropeWoundTwice: 4, silverKey: 5,
};
const descriptions = [
  "井绳湿滑，直接用力只能让桶在井下晃动。木轴旁有绳槽和摇柄。",
  "井绳已压进轱辘的凹槽，松出的绳头仍在下滑，木桶的重量压着手指。",
  "绳头已经握稳，井绳绷住，木桶仍在井下。",
  "木轴卷起了一段井绳。桶里的东西撞了一下桶壁，离井沿还远。",
  "木桶已经升到井沿下，桶边湿亮，提手终于够得着了。",
  "木桶已经提到井沿，银白色钥匙已收好。井里再没有可以捞取的东西。",
];
const hints = [
  "观察木轴上能容下井绳的凹槽。先让湿滑的绳子有一处支撑。",
  "绳子虽然上槽，松出的绳头还没有握稳。先处理绳头，再试摇柄。",
  "井绳和绳头都已经稳住，可以转动摇柄了。",
  "桶还没到井沿。留意绳子收上来的长度，再试一次摇柄。",
  "木桶就在井沿下。现在可以握住提手，把桶提上来了。",
  "钥匙已经在随身物品里，可以收起操作画面继续探索。",
];

type WellStep = readonly [WellInteraction, string];
// 第 5 阶段（已持钥匙）没有下一步。
const nextSteps: readonly WellStep[] = [
  ["groove", "set-windlass"], ["grip", "wrap-rope"], ["crank", "turn-windlass"],
  ["crank", "turn-windlass"], ["bucket", "lift-bucket"],
];

/** Reuse authored story nodes as the saved mechanism state; no separate save format. */
export function wellPuzzleView(state: GameState): WellPuzzleView | null {
  if (!Object.prototype.hasOwnProperty.call(stages, state.scene)) return null;
  const stage = stages[state.scene];
  if (stage === undefined || (stage === 5 && !state.inventory.includes("silverKey"))) return null;
  const next: WellStep | undefined = nextSteps[stage];
  const choice = next && getScene(state).choices.find(candidate => candidate.id === next[1]);
  return { stage, title: stage === 5 ? "井沿上的木桶" : "井绳与旧轱辘", description: descriptions[stage]!, hint: hints[stage]!,
    ...(next && choice ? { textAction: { interaction: next[0], label: choice.text } } : {}) };
}

/** A proposed action only: the caller must still execute through recordChoice. */
export function wellPuzzleAction(state: GameState, interaction: WellInteraction): { choiceId?: string; feedback: string } {
  const view = wellPuzzleView(state);
  if (!view) return { feedback: "这里没有可以继续操作的井绳。" };
  if (view.stage === 5 || state.inventory.includes("silverKey")) return { feedback: "钥匙已经收好，不必再拉动井绳。" };
  let choiceId: string | undefined;
  let feedback = "";
  switch (interaction) {
    case "groove":
      if (view.stage === 0) { choiceId = "set-windlass"; feedback = "井绳压进凹槽，不再从木轴旁乱滑。"; }
      else feedback = "井绳已经在凹槽里了。重复搭上去不会让木桶升高。";
      break;
    case "grip":
      if (view.stage === 0) feedback = "绳子还没有支撑，湿滑的绳身从手里滑过。木桶没有升高。";
      else if (view.stage === 1) { choiceId = "wrap-rope"; feedback = "你握稳松出的绳头，井绳终于绷住。"; }
      else feedback = "绳头已经握稳，松开反而会让木桶落回去。";
      break;
    case "crank":
      if (view.stage === 0) feedback = "摇柄空转，井绳没有挂进凹槽，木桶仍留在井下。";
      else if (view.stage === 1) feedback = "木轴刚动，松出的绳头就往下滑。先稳住绳头。";
      else if (view.stage < 4) { choiceId = "turn-windlass"; feedback = view.stage === 2 ? "轱辘卷起一段井绳，木桶向上升了一些。" : "木桶升到井沿下，提手已经够得着了。"; }
      else feedback = "木桶已经抵近井沿，不必继续卷绳，可以直接提起桶。";
      break;
    case "bucket":
      if (view.stage === 4) { choiceId = "lift-bucket"; feedback = "你把木桶提上井沿，收好了桶里的银白色钥匙。"; }
      else feedback = "桶还在井下，提手够不着。井绳没有因此改变。";
      break;
    case "rope":
      feedback = view.stage === 0 ? "湿绳从掌心滑开，木桶只晃了一下，没有升高。" : "你试了试绳子的分量，木桶仍停在原处。";
      break;
    default:
      feedback = "没有找到可以这样操作的部件。";
  }
  if (choiceId && getScene(state).choices.some(choice => choice.id === choiceId)) return { choiceId, feedback };
  return { feedback };
}
