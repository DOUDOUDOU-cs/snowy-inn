import type { Choice, GameState, Scene, SceneId } from "../game/types.ts";
import type { SceneArt } from "./sceneArt.ts";

export interface SceneActionGroup {
  id: string;
  label: string;
  kind: "object" | "person" | "exit" | "decision";
  /** Centre of the object, in percent of the complete image. */
  anchor?: { x: number; y: number };
  /** Clickable extent around the anchor, in percent of the image; defaults by kind. */
  area?: { w: number; h: number };
  /** Off-picture exits leave from this side of the frame. */
  edge?: "left" | "right";
  choices: Choice[];
}

export type SceneMode = "environment" | "detail" | "dialogue" | "decision" | "ending";
type Mode = SceneMode;
interface GroupDefinition extends Omit<SceneActionGroup, "choices"> { choiceIds: readonly string[] }
interface PresentationDefinition { space: string; mode: Mode; groups: readonly GroupDefinition[] }

const group = (id: string, label: string, kind: SceneActionGroup["kind"], choiceIds: string[],
  x?: number, y?: number, w?: number, h?: number): GroupDefinition => ({
  id, label, kind, choiceIds,
  ...(x !== undefined && y !== undefined ? { anchor: { x, y } } : {}),
  ...(w !== undefined && h !== undefined ? { area: { w, h } } : {}),
});
const object = (id: string, label: string, ids: string[], x?: number, y?: number, w?: number, h?: number) => group(id, label, "object", ids, x, y, w, h);
const exit = (id: string, label: string, ids: string[], x?: number, y?: number, w?: number, h?: number) => group(id, label, "exit", ids, x, y, w, h);
const toward = (edge: "left" | "right", definition: GroupDefinition): GroupDefinition => ({ ...definition, edge });
const decision = (id: string, label: string, ids: string[]) => group(id, label, "decision", ids);
const frame = (space: string, mode: Mode, ...groups: GroupDefinition[]): PresentationDefinition => ({ space, mode, groups });

// These describe presentation, never availability. Only getScene's supplied choices become actions.
// Reused choice IDs are assigned in their own scene; no text matching or target execution is needed.
// Coordinates and extents follow the actual WebP pictures, including their day/night variants.
const forestRoad = exit("forest-road", "林间小路", ["walk", "keep-walking"], 40, 84, 30, 22);
const distantInn = exit("inn", "旅馆灯光", ["approach"], 62, 46, 28, 26);
const innRoad = toward("right", exit("inn-road", "沿路前往旅馆", ["approach"]));
const ruinsRoad = toward("left", exit("ruins-road", "村庄遗迹", ["ruins"]));
const ruinsReturn = toward("left", exit("ruins-return", "回到遗迹旁", ["ruins", "leave-ring"]));
const receptionReturn = toward("left", exit("reception-return", "回到柜台前", ["back-reception"]));
const frontDesk = group("front-desk", "前台小姐", "person", ["start-check-in", "confront-basement", "ask-rescue", "breakfast-offer"], 23, 39, 12, 22);
const ledger = object("registry", "登记簿", ["look-registry", "open-registry"], 23, 53, 15, 6);
const portrait = object("hall-portrait", "柜台后的肖像", ["look-hall-portrait"], 16, 15, 15, 28);
const stairs = exit("stairs", "楼梯 · 你的客房", ["return-room", "go-room"], 58, 46, 16, 38);
const groundRoute = exit("ground-hall", "一楼走廊", ["ground-hall"], 83, 50, 14, 36);
const outdoors = toward("left", exit("outside", "旅馆外", ["leave-inn", "go-outside"]));
const drawer = object("desk-drawer", "柜台抽屉", ["search-desk"], 30, 63, 16, 7);
const cabinet = object("desk-cabinet", "柜台下的锁柜", ["inspect-cabinet", "unlock-cabinet"], 30, 75, 18, 12);
// All departures use the visible door; a separate left-edge exit would cover its hit area.
const roomDoor = exit("room-door", "房门 · 离开客房", ["investigate", "back-reception", "go-reception", "wake-after-stay", "go-outside"], 6, 48, 11, 66);
const bed = object("bed", "床边休息", ["lie-down", "sleep", "rest-another-night", "stay-one-more-night"], 82, 60, 26, 44);
const neighborReturn = toward("left", exit("neighbor-return", "回到隔壁客房", ["back-neighbor", "leave-neighbor-water"]));
const hallwayReturn = toward("left", exit("hallway-return", "二楼走廊", ["back-hallway"]));
const groundReturn = toward("left", exit("ground-return", "一楼走廊", ["back-ground-hall", "leave-night-kitchen", "back-reception"]));
// The day/night hallway and neighbor-room pictures preserve the same composition.
const neighborDoor = exit("neighbor-door", "虚掩的房门", ["neighbor-door", "enter-neighbor"], 19, 48, 17, 78);
const water = object("water", "床边水杯", ["inspect-neighbor-water", "drink-neighbor-water"], 26, 52, 7, 10);
const wardrobe = object("wardrobe", "虚掩的衣柜", ["search-wardrobe", "inspect-ropes", "untangle-wardrobe", "take-bronze-key"], 85, 41, 17, 62);
const kitchenDoor = exit("kitchen-door", "厨房门", ["kitchen-threshold", "back-night-kitchen"], 20, 44, 15, 59);
const banquetDoor = exit("banquet-door", "旧双开门", ["banquet-door", "enter-banquet"], 42, 39, 17, 57);
const basementDoor = exit("basement-door", "地下室门", ["basement-door", "unlock-basement", "enter-basement"], 85, 65, 19, 27);
const kitchenPerson = group("kitchen-person", "案板旁的前台小姐", "person", ["greet-night-kitchen", "ask-night-meat"], 46, 38, 16, 32);
// Both kitchen pictures show the same side doorway; availability still comes from the story.
const kitchenSide = exit("kitchen-side", "宴会厅侧门", ["peek-banquet-door", "through-banquet-side"], 83, 39, 16, 42);
const kitchenReturn = toward("left", exit("kitchen-return", "退回一楼走廊", ["leave-night-kitchen"]));
const banquetReturn = toward("left", exit("banquet-return", "回到长桌旁", ["back-banquet"]));
const banquetExit = toward("left", exit("banquet-exit", "双开门 · 一楼走廊", ["back-banquet-door"]));
const followWall = exit("follow-wall", "沿墙继续寻找", ["follow-wall"], 60, 47, 15, 30);
const passageReturn = exit("passage-return", "沿水道返回", ["back-passage"], 18, 45, 24, 34);
const fleshReturn = toward("left", exit("flesh-return", "回到水道深处", ["back-flesh"]));
const talk = (ids: string[]) => group("front-desk", "继续交谈", "person", ids, 24, 43);
const dialogue = (...groups: GroupDefinition[]) => frame("reception", "dialogue", ...groups);

const definitions: Record<SceneId, PresentationDefinition> = {
  arrival: frame("forest", "environment", distantInn, forestRoad),
  forest: frame("forest", "environment", distantInn, forestRoad, ruinsRoad),
  entrance: frame("entrance", "environment",
    exit("inn-door", "旅馆木门", ["enter"], 47, 51, 15, 38), exit("well-road", "门旁水井", ["well"], 93, 55, 9, 16),
    exit("forest-road", "林间小路", ["walk", "keep-walking"], 50, 91, 34, 14), ruinsRoad),
  escape: frame("forest", "ending"),
  ruins: frame("ruins", "environment",
    object("ruin-house", "半塌的小屋", ["house"], 16, 36, 28, 38),
    object("ruin-search", "墙边碎木", ["search", "rest", "search-ring"], 24, 72, 16, 14),
    object("doorplates", "散落的门牌", ["doorplates"]),
    decision("rest", "背风处休息", ["wait-morning"]),
    exit("forest-road", "林间小路", ["walk", "keep-walking"], 66, 64, 14, 28), innRoad),
  tiredSearch: frame("ruins", "decision", decision("rest", "背风处休息", ["rest"]), innRoad),
  ringFind: frame("ruins", "detail", object("debris", "碎木之间的亮点", ["uncover-ring"]), ruinsReturn),
  ringUncovered: frame("ruins", "detail", object("ring", "碎木下的戒指", ["take-ring"]), ruinsReturn),
  portrait: frame("ruins", "detail", ruinsReturn),
  doorplates: frame("ruins", "detail", ruinsReturn),
  well: frame("well", "environment",
    object("well-water", "井口", ["drop-ring"], 36, 76, 24, 12), object("well-rope", "井绳", ["pull-rope"], 34, 52, 6, 36),
    exit("well-return", "旅馆门前", ["leave-well"], 80, 44, 12, 18)),
  ropeSlips: frame("well", "detail", object("windlass", "旧轱辘", ["set-windlass"], 34, 34), exit("rope-return", "放开井绳", ["leave-rope"])),
  ropeOnWindlass: frame("well", "detail", object("well-rope", "井绳", ["wrap-rope"], 36, 52), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWrapped: frame("well", "detail", object("windlass", "旧轱辘", ["turn-windlass"], 34, 34), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWoundOnce: frame("well", "detail", object("windlass", "旧轱辘", ["turn-windlass"], 34, 34), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWoundTwice: frame("well", "detail", object("bucket", "井沿下的木桶", ["lift-bucket"]), exit("rope-return", "放下木桶", ["leave-rope"])),
  ringDropped: frame("well", "detail", object("well-water", "井口", ["look-well"], 32, 72), exit("well-return", "旅馆门前", ["leave-well"], 80, 41)),
  silverKey: frame("well", "detail", exit("well-return", "旅馆门前", ["leave-well"], 80, 41)),
  reception: frame("reception", "environment", frontDesk, ledger, portrait, stairs, groundRoute, drawer, cabinet,
    object("behind-desk", "柜台后", ["approach-empty-desk"], 22, 40, 16, 22), outdoors),
  emptyDesk: frame("reception", "decision", decision("desk-seat", "柜台后的座位", ["sit-behind-desk"]), exit("reception-return", "退回大厅", ["step-away-desk"])),
  newGuest: frame("reception", "dialogue", group("new-guest", "门口的旅人", "person", ["answer-guest"])),
  innkeeperEnding: frame("reception", "ending"),
  hallPortrait: frame("reception", "detail", receptionReturn),
  registry: frame("reception", "detail", object("registry", "登记簿上的日期", ["start-check-in", "write-checkout"]), receptionReturn),
  checkIn: frame("reception", "detail", object("registry", "登记簿与笔", ["finish-check-in"]), receptionReturn),
  keyHandover: frame("reception", "dialogue", ledger, stairs, receptionReturn),
  cabinet: frame("reception", "detail", cabinet, receptionReturn),
  photoFind: frame("reception", "detail", receptionReturn),
  deskDrawer: frame("reception", "detail", receptionReturn),
  guestRoom: frame("guest-room", "environment", bed, roomDoor),
  nightNoise: frame("guest-room", "decision", bed, roomDoor),
  morningRoom: frame("guest-room", "environment", bed, roomDoor),
  recoveryRoom: frame("guest-room", "environment", bed, roomDoor),
  lingeringNight: frame("guest-room", "decision", roomDoor),
  hallway: frame("upstairs-hall", "environment",
    neighborDoor, exit("stairs", "楼下的响动", ["follow-night-sound"], 82, 53, 14, 17),
    toward("left", exit("own-room", "你的客房", ["back-room"]))),
  neighborDoor: frame("upstairs-hall", "detail", neighborDoor, hallwayReturn),
  neighborRoom: frame("neighbor-room", "environment", water, wardrobe, hallwayReturn),
  neighborWater: frame("neighbor-room", "detail", water, neighborReturn),
  neighborWaterAfterDrink: frame("neighbor-room", "detail", neighborReturn),
  wardrobe: frame("neighbor-room", "detail", wardrobe, neighborReturn),
  wardrobeUntangled: frame("neighbor-room", "detail", wardrobe, neighborReturn),
  breakfastOffer: dialogue(decision("breakfast", "早餐邀请", ["accept-breakfast", "decline-breakfast"]), receptionReturn),
  breakfastPlate: frame("reception", "detail", object("breakfast-plate", "盘里的香肠", ["inspect-food"]), decision("breakfast", "桌边的决定", ["eat-breakfast", "pretend-breakfast"])),
  breakfastInspect: frame("reception", "detail", object("breakfast-plate", "再看早餐盘", ["back-plate"]), decision("breakfast", "桌边的决定", ["eat-breakfast", "pretend-breakfast"])),
  breakfastResult: frame("reception", "decision", receptionReturn, groundRoute, outdoors),
  groundHall: frame("ground-hall", "environment", kitchenDoor, banquetDoor, basementDoor,
    toward("left", exit("upstairs", "二楼走廊", ["back-hallway"])), receptionReturn),
  nightKitchen: frame("kitchen", "environment", kitchenPerson, kitchenSide, kitchenReturn),
  nightKitchenTalk: frame("kitchen", "dialogue", kitchenPerson, kitchenReturn),
  nightKitchenMeat: frame("kitchen", "dialogue", kitchenReturn),
  kitchenThreshold: frame("kitchen", "environment", kitchenSide, groundReturn),
  banquetDoor: frame("ground-hall", "detail", banquetDoor, kitchenDoor, exit("ground-return", "退回一楼走廊", ["back-ground-hall"])),
  banquetHall: frame("banquet", "environment",
    object("banquet-table", "杯印与椅脚拖痕", ["inspect-banquet-table"], 49, 60, 44, 34),
    decision("banquet-listen", "空厅中的声音", ["listen-banquet"]),
    exit("kitchen-side", "厨房侧门", ["through-kitchen-side"], 88, 40, 9, 38), banquetExit),
  banquetTable: frame("banquet", "detail", banquetReturn),
  banquetEcho: frame("banquet", "dialogue", banquetReturn, banquetExit),
  basementDoor: frame("ground-hall", "detail", basementDoor, exit("ground-return", "回到一楼走廊", ["back-ground-hall"])),
  basementStairs: frame("basement-entry", "environment", exit("descend", "台阶尽头", ["descend"], 24, 79, 30, 22), exit("upstairs", "地下室门前", ["back-basement-door"], 14, 9, 10, 18)),
  basementShore: frame("basement-entry", "environment", exit("passage", "积水通道", ["wade"], 60, 47, 15, 30), exit("upstairs", "沿台阶返回", ["back-basement-stairs"], 15, 47, 23, 50)),
  // The shared passage picture does not depict the drain opening: keep it a textual action.
  floodedPassage: frame("basement-passage", "environment", object("drain-hole", "圆形孔洞", ["look-hole"]), followWall, exit("shore", "退回水边", ["back-shore"], 24, 79, 30, 22)),
  drainHole: frame("basement-passage", "detail", decision("jump", "洞口前的决定", ["jump"]), followWall, toward("left", exit("passage-return", "退回水道", ["back-passage"]))),
  fleshCorridor: frame("basement-flesh", "environment",
    object("pillar", "倒塌的石柱", ["inspect-pillar"], 79, 68, 36, 25),
    object("tap", "墙上的龙头", ["inspect-tap"], 89, 38, 11, 20),
    decision("wall-voice", "墙里的声音", ["listen-wall"]), passageReturn),
  brokenPillar: frame("basement-flesh", "detail", fleshReturn),
  wallTap: frame("basement-flesh", "detail", fleshReturn),
  wallVoice: frame("basement-flesh", "dialogue", decision("wall-answer", "回应墙后的声音", ["answer-wall-voice"]), fleshReturn),
  wallVoiceReply: frame("basement-flesh", "dialogue", fleshReturn),
  underwater: frame("underwater", "decision", decision("seek-air", "水中的挣扎", ["seek-air"])),
  underwaterRescue: frame("underwater", "decision", decision("wake", "恢复意识", ["wake"])),
  drownedEnding: frame("underwater", "ending"),
  confrontationOpening: dialogue(talk(["press-emily"]), receptionReturn),
  emilyAnswer: dialogue(talk(["continue-truth"]), receptionReturn),
  truthHub: dialogue(talk(["ask-wedding", "ask-edward", "ask-identity", "ask-kitchen", "ask-banquet", "ask-inn", "ask-leave"]), receptionReturn),
  kitchenQuestion: dialogue(talk(["back-dialogue"])),
  banquetQuestion: dialogue(talk(["back-dialogue"])),
  weddingMemory: dialogue(talk(["what-after-wedding", "back-dialogue"])),
  snowNight: dialogue(talk(["ask-why-stay", "back-dialogue"])),
  whyTheyStayed: dialogue(talk(["back-dialogue"]), receptionReturn),
  edwardAnswer: dialogue(talk(["back-dialogue"])),
  identityAnswer: dialogue(talk(["ask-if-emily", "back-dialogue"])),
  identityDoubt: dialogue(talk(["back-dialogue"])),
  innNature: dialogue(talk(["ask-leave-now", "back-dialogue"])),
  checkoutHint: dialogue(ledger, talk(["back-dialogue"])),
  checkoutEnding: frame("entrance", "ending"),
  rescueQuestion: dialogue(receptionReturn),
};

/** Pure display adapter. It does not inspect Choice.available or run next/apply callbacks. */
export function presentationForScene(state: GameState, scene: Scene, art: SceneArt): { space: string; mode: Mode; groups: SceneActionGroup[] } {
  const definition = definitions[state.scene];
  const assigned = new Set<Choice>();
  const groups: SceneActionGroup[] = [];
  for (const configured of definition.groups) {
    const choices = scene.choices.filter(choice => configured.choiceIds.includes(choice.id) && !assigned.has(choice));
    if (!choices.length) continue;
    for (const choice of choices) assigned.add(choice);
    const { choiceIds: _ids, ...display } = configured;
    const current: SceneActionGroup = { ...display, ...(display.anchor ? { anchor: { ...display.anchor } } : {}),
      ...(display.area ? { area: { ...display.area } } : {}), choices };
    // The morning/aged entrance is currently a distant forest view: the door is the inn far away,
    // the road is the foreground path, and the well is out of frame.
    if (state.scene === "entrance" && art.src !== "/scenes/inn-entrance.webp") {
      if (current.id === "inn-door") { current.anchor = { x: 62, y: 46 }; current.area = { w: 28, h: 26 }; }
      if (current.id === "forest-road") { current.anchor = { x: 40, y: 84 }; current.area = { w: 30, h: 22 }; }
      if (current.id === "well-road") { delete current.anchor; delete current.area; current.edge = "right"; }
    }
    // A valid question may coexist with the empty-desk artwork. Do not put a person marker on air.
    if (current.id === "front-desk" && art.src === "/scenes/reception.webp") {
      delete current.anchor;
      delete current.area;
      current.label = "柜台前交谈";
    }
    groups.push(current);
  }
  // New content remains reachable before its explicit object configuration is added.
  // Each fallback retains the authored action label instead of masquerading as a spatial hotspot.
  for (const [index, choice] of scene.choices.entries()) {
    if (!assigned.has(choice)) groups.push({ id: `context-${index}-${choice.id}`, label: choice.text, kind: "decision", choices: [choice] });
  }
  return { space: definition.space, mode: definition.mode, groups };
}
