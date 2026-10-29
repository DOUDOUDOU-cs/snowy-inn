import type { SceneActionGroup } from "./scenePresentation.ts";

// Local, trusted line art. Never interpolate labels, choices or save data into SVG.
const drawings = {
  lantern: '<path d="M9 5V4a3 3 0 0 1 6 0v1M7 6h10l-1 13H8L7 6ZM6 20h12M9 9h6M12 10c-3 3-2 5 0 6 2-1 3-3 0-6Z"/>',
  door: '<path d="M4 21V3h16v18M7 21V6h10v15M3 21h18M10 8v10"/><circle cx="14.5" cy="14" r=".8"/>',
  path: '<path d="M10 21c-6-5 8-6 3-11M14 21c-5-4 8-6 2-11M5 4 2 9h2l-2 4h6l-2-4h2L5 4ZM5 13v4M19 2l-3 5h2l-2 4h6l-2-4h2l-3-5ZM19 11v4"/>',
  frame: '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="6" y="6" width="12" height="12" rx=".5"/><circle cx="12" cy="10" r="2"/><path d="M8 17c0-5 8-5 8 0M3 3l3 3m12 0 3-3M3 21l3-3m12 0 3 3"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15M6 7l3 1M6 10l3 1M15 8l3-1M15 11l3-1"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 20v-3a7 7 0 0 1 14 0v3M9 13l3 3 3-3M12 16v5M3 21h18"/>',
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3M3 23h18M4 10l15-9"/>',
  well: '<ellipse cx="12" cy="15" rx="8" ry="3"/><path d="M4 15v5c2 3 14 3 16 0v-5M6 13V3h12v10M4 3h16M12 3v10M10 12h4v5h-4zM8 18v4M16 18v4"/>',
  windlass: '<path d="M4 20V9M20 20V9M3 7h18M5 4h14v6H5zM21 7v6h-3M9 5v4M12 5v4M15 5v4M12 11v10M2 21h4M18 21h4"/>',
  rope: '<path d="M12 2v7c-5 0-6 7-2 9 3 2 8-1 6-4-2-4-8 0-6 4l2 4M9 2h6M12 4l2 1m-2 1 2 1"/>',
  cup: '<path d="M4 7h12l-1 11H5L4 7ZM16 9h3c4 0 2 7-4 6M2 21h17M7 3v1M11 2v2"/>',
  bed: '<path d="M3 21V6M21 21v-9M3 12h18v6H3M6 12V8h6v4M12 12V9h5c2 0 4 1 4 3M3 18v3M21 18v3"/>',
  wardrobe: '<rect x="4" y="3" width="16" height="17" rx="1"/><path d="M12 3v17M7 6h2v9H7zM15 6h2v9h-2zM6 20v2M18 20v2"/><circle cx="10" cy="12" r=".5"/><circle cx="14" cy="12" r=".5"/>',
  kitchen: '<path d="M5 2v6c0 3 5 3 5 0V2M7.5 2v20M18 2c-4 3-4 8 0 10v10M18 2v10M3 17h9"/>',
  key: '<circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="1"/><path d="m11 11 9 9M15 15l3-3M18 18l3-3"/>',
  candle: '<path d="M12 2c-5 4-3 7 0 7s5-3 0-7ZM9 12h6v8H9zM12 9v3M6 20h12M4 22h16"/>',
  lens: '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6M7 10a3 3 0 0 1 3-3"/>',
  house: '<path d="M3 10 12 3l9 7M5 9v12h14V9M10 21v-7h4v7M6 3h3v3"/>',
  chair: '<path d="M6 3h12v11H6zM4 14h16v4H4zM6 18v4M18 18v4M9 6h6v5H9z"/>',
  drawer: '<rect x="3" y="5" width="18" height="15" rx="1"/><path d="M3 12h18M9 8h6M9 15h6M5 20v2M19 20v2"/>',
  bucket: '<path d="M5 9h14l-2 12H7L5 9ZM7 9V7a5 5 0 0 1 10 0v2M8 12l1 6M16 12l-1 6"/>',
  ring: '<circle cx="12" cy="14" r="7"/><path d="m8 6 2-3h4l2 3-4 4-4-4ZM8 6h8"/>',
  plate: '<ellipse cx="12" cy="12" rx="10" ry="7"/><ellipse cx="12" cy="12" rx="7" ry="4"/><path d="M7 12h10"/>',
  sound: '<path d="M4 8c-2 2-2 6 0 8M20 8c2 2 2 6 0 8M8 5c5-4 12 1 9 6l-3 4c0 4-5 6-7 2M11 9c4-2 5 2 2 4"/>',
  column: '<path d="M6 3h12v3H6zM8 6v5l3 1-3 3v3h8V6M6 18h12v3H6zM12 7v3M12 15v2"/>',
  tap: '<path d="M8 3h8M12 3v4M4 7h11c4 0 5 3 5 6v2h-5v-3H4M4 5v9M17 18c-3 3-2 4 0 4s3-1 0-4Z"/>',
  water: '<path d="M12 2c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12ZM8 14c0 3 2 4 4 4"/>',
} as const;

export type SceneIconName = keyof typeof drawings;
const assignments: Readonly<Record<string, SceneIconName>> = {
  inn: "lantern", "inn-road": "lantern", "inn-door": "door", outside: "door",
  "forest-road": "path", "ruins-road": "path", "ruins-return": "path",
  "hall-portrait": "frame", portrait: "frame", photo: "frame", "photo-find": "frame",
  registry: "book", ledger: "book", "front-desk": "person", "new-guest": "person", "kitchen-person": "person",
  stairs: "stairs", downstairs: "stairs", upstairs: "stairs", descend: "stairs",
  "well-road": "well", "well-water": "well", windlass: "windlass", "well-rope": "rope", "rope-return": "rope",
  water: "cup", bed: "bed", rest: "candle", wardrobe: "wardrobe", "desk-cabinet": "wardrobe",
  "kitchen-door": "kitchen", "kitchen-side": "door", "desk-drawer": "drawer", "behind-desk": "lens",
  key: "key", keys: "key", "silver-key": "key", "bronze-key": "key", "room-key": "key",
  "ruin-house": "house", "desk-seat": "chair", bucket: "bucket", ring: "ring",
  breakfast: "plate", "breakfast-plate": "plate", "banquet-table": "cup", "banquet-listen": "sound",
  "wall-voice": "sound", "wall-answer": "sound", pillar: "column", tap: "tap",
  "seek-air": "water", wake: "water", passage: "water", "passage-return": "water", shore: "water",
};

/** Icons describe the named entry, without reading choices, clues or inventory. */
export function iconForGroup(group: Pick<SceneActionGroup, "id" | "kind">): { name: SceneIconName; markup: string } {
  const name = (Object.prototype.hasOwnProperty.call(assignments, group.id) ? assignments[group.id] : undefined) ?? (group.kind === "person" ? "person" : group.kind === "exit" ? "door"
    : group.kind === "decision" ? "candle" : "lens");
  return { name, markup: `<svg class="scene-marker-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[name]}</svg>` };
}
