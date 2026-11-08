import type { Choice } from "../game/types.ts";
import type { SceneActionGroup, SceneMode } from "./scenePresentation.ts";

/** An object drawn in the picture: the player clicks the thing itself. */
export interface Hotspot { group: SceneActionGroup; x: number; y: number; w: number; h: number }
/** A way out that is not drawn: a quiet arrow at the side of the frame. */
export interface EdgeExit { group: SceneActionGroup; side: "left" | "right" }
/** Spoken lines and decisions: offered under the narration once it has been read. */
export interface SpokenOption { group: SceneActionGroup; choice: Choice }

export interface SceneLayout {
  hotspots: Hotspot[];
  edges: EdgeExit[];
  options: SpokenOption[];
  /** Narration floats where it covers the fewest hotspots. */
  textBand: "top" | "bottom";
}

const defaultArea: Record<SceneActionGroup["kind"], { w: number; h: number }> = {
  person: { w: 12, h: 24 }, object: { w: 10, h: 12 }, exit: { w: 12, h: 24 }, decision: { w: 10, h: 12 },
};

/** Pure: decides how each authored group appears. It never filters or adds choices. */
export function layoutScene(mode: SceneMode, groups: readonly SceneActionGroup[]): SceneLayout {
  const hotspots: Hotspot[] = [];
  const edges: EdgeExit[] = [];
  const options: SpokenOption[] = [];
  const conversing = mode === "dialogue" || mode === "decision";
  for (const group of groups) {
    if (!group.choices.length) continue;
    // In conversation the person is already facing you: what you say is a line, not a click on them.
    const spoken = group.kind === "decision" || (conversing && group.kind === "person");
    if (!spoken && group.anchor) {
      const area = group.area ?? defaultArea[group.kind];
      hotspots.push({ group, x: group.anchor.x, y: group.anchor.y, w: area.w, h: area.h });
    } else if (!spoken && group.kind === "exit") {
      edges.push({ group, side: group.edge ?? "left" });
    } else {
      for (const choice of group.choices) options.push({ group, choice });
    }
  }
  // Larger areas first so smaller objects inside them stay on top and reachable.
  hotspots.sort((a, b) => b.w * b.h - a.w * a.h);
  // Only things you examine push the words away; a road underfoot can sit under them.
  const things = hotspots.filter(spot => spot.group.kind !== "exit");
  const low = things.filter(spot => spot.y > 60).length;
  const high = things.filter(spot => spot.y < 40).length;
  return { hotspots, edges, options, textBand: low > high ? "top" : "bottom" };
}

/** What hovering an object says: a single action names itself, several name the object. */
export function hotspotLabel(group: SceneActionGroup): string {
  return group.choices.length === 1 ? group.choices[0]!.text : group.label;
}
