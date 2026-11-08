import type { Choice } from "../game/types.ts";
import type { SceneActionGroup, SceneMode } from "./scenePresentation.ts";

/** An object drawn in the picture: the player clicks the thing itself. */
export interface Hotspot { group: SceneActionGroup; x: number; y: number; w: number; h: number }
/** A way out that is not drawn: a quiet arrow at the side of the frame. */
export interface EdgeExit { group: SceneActionGroup; side: "left" | "right" }
/** Spoken lines and decisions: offered under the narration once it has been read. */
export interface SpokenOption { group: SceneActionGroup; choice: Choice }

export type TextBand = "top" | "bottom";
/** Narration stays on the top/bottom band but may move sideways to avoid picture objects. */
export type TextSlide = "left" | "center" | "right";

export interface SceneLayout {
  hotspots: Hotspot[];
  edges: EdgeExit[];
  options: SpokenOption[];
  /** Narration floats where it covers the fewest picture objects. */
  textBand: TextBand;
  textSlide: TextSlide;
}

const defaultArea: Record<SceneActionGroup["kind"], { w: number; h: number }> = {
  person: { w: 12, h: 24 }, object: { w: 10, h: 12 }, exit: { w: 12, h: 24 }, decision: { w: 10, h: 12 },
};

// The stage does not measure text (no layout observers). This deliberately generous box is only
// used to compare candidate positions; the CSS keeps the real narration inside the same band.
const TEXT_BOX = { width: 0.7, height: 0.22 };
const BAND_Y: Record<TextBand, { top: number; bottom: number }> = {
  top: { top: 0.1, bottom: 0.1 + TEXT_BOX.height },
  bottom: { top: 0.93 - TEXT_BOX.height, bottom: 0.93 },
};
const SLIDE_CENTRE: Record<TextSlide, number> = {
  left: 0.04 + TEXT_BOX.width / 2,
  center: 0.5,
  right: 0.96 - TEXT_BOX.width / 2,
};
// Prefer the current bottom-centre look; only move when another candidate covers less.
const CANDIDATES: readonly { band: TextBand; slide: TextSlide }[] = [
  { band: "bottom", slide: "center" },
  { band: "bottom", slide: "left" },
  { band: "bottom", slide: "right" },
  { band: "top", slide: "center" },
  { band: "top", slide: "left" },
  { band: "top", slide: "right" },
];

function coveredArea(spots: readonly Hotspot[], band: TextBand, slide: TextSlide): number {
  const y = BAND_Y[band];
  const x0 = SLIDE_CENTRE[slide] - TEXT_BOX.width / 2;
  const x1 = SLIDE_CENTRE[slide] + TEXT_BOX.width / 2;
  let area = 0;
  for (const spot of spots) {
    const spotX0 = (spot.x - spot.w / 2) / 100;
    const spotX1 = (spot.x + spot.w / 2) / 100;
    const spotY0 = (spot.y - spot.h / 2) / 100;
    const spotY1 = (spot.y + spot.h / 2) / 100;
    const w = Math.min(x1, spotX1) - Math.max(x0, spotX0);
    const h = Math.min(y.bottom, spotY1) - Math.max(y.top, spotY0);
    if (w > 0 && h > 0) area += w * h;
  }
  return area;
}

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
  // Picture exits count too: their hit area must not sit under the words either.
  let best = CANDIDATES[0]!;
  let bestArea = coveredArea(hotspots, best.band, best.slide);
  for (const candidate of CANDIDATES.slice(1)) {
    const area = coveredArea(hotspots, candidate.band, candidate.slide);
    if (area < bestArea - 1e-9) { best = candidate; bestArea = area; }
  }
  return { hotspots, edges, options, textBand: best.band, textSlide: best.slide };
}

/** What hovering an object says: a single action names itself, several name the object. */
export function hotspotLabel(group: SceneActionGroup): string {
  return group.choices.length === 1 ? group.choices[0]!.text : group.label;
}
