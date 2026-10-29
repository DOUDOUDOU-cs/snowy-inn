import type { Choice, GameState, Scene, SceneId } from "../game/types.ts";
import type { SceneArt } from "./sceneArt.ts";

export interface SceneActionGroup {
  id: string;
  label: string;
  kind: "object" | "person" | "exit" | "decision";
  /** Percentage coordinates within the complete image, excluding contain letterboxing. */
  anchor?: { x: number; y: number };
  choices: Choice[];
}

type Mode = "environment" | "detail" | "dialogue" | "decision" | "ending";
interface GroupDefinition extends Omit<SceneActionGroup, "choices"> { choiceIds: readonly string[] }
interface PresentationDefinition { space: string; mode: Mode; groups: readonly GroupDefinition[] }

const group = (id: string, label: string, kind: SceneActionGroup["kind"], choiceIds: string[], x?: number, y?: number): GroupDefinition =>
  ({ id, label, kind, choiceIds, ...(x !== undefined && y !== undefined ? { anchor: { x, y } } : {}) });
const object = (id: string, label: string, ids: string[], x?: number, y?: number) => group(id, label, "object", ids, x, y);
const exit = (id: string, label: string, ids: string[], x?: number, y?: number) => group(id, label, "exit", ids, x, y);
const decision = (id: string, label: string, ids: string[]) => group(id, label, "decision", ids);
const frame = (space: string, mode: Mode, ...groups: GroupDefinition[]): PresentationDefinition => ({ space, mode, groups });

// These describe presentation, never availability. Only getScene's supplied choices become actions.
// Reused choice IDs are assigned in their own scene; no text matching or target execution is needed.
const forestRoad = exit("forest-road", "林间小路", ["walk", "keep-walking"]);
const distantInn = exit("inn", "旅馆灯光", ["approach"], 66, 55);
const innRoad = exit("inn-road", "沿路前往旅馆", ["approach"]);
const ruinsRoad = exit("ruins-road", "村庄遗迹", ["ruins"]);
const ruinsReturn = exit("ruins-return", "回到遗迹旁", ["ruins", "leave-ring"]);
const receptionReturn = exit("reception-return", "回到柜台前", ["back-reception"]);
const frontDesk = group("front-desk", "前台小姐", "person", ["start-check-in", "confront-basement", "ask-rescue", "breakfast-offer"], 24, 43);
const ledger = object("registry", "登记簿", ["look-registry", "open-registry"], 28, 55);
const portrait = object("hall-portrait", "柜台后的肖像", ["look-hall-portrait"], 16, 22);
const stairs = exit("stairs", "楼梯 · 你的客房", ["return-room", "go-room"], 58, 48);
const groundRoute = exit("ground-hall", "一楼走廊", ["ground-hall"], 85, 50);
const outdoors = exit("outside", "旅馆外", ["leave-inn", "go-outside"]);
const drawer = object("desk-drawer", "柜台抽屉", ["search-desk"], 28, 63);
const cabinet = object("desk-cabinet", "柜台下的锁柜", ["inspect-cabinet", "unlock-cabinet"], 28, 76);
const roomDoor = exit("room-door", "二楼走廊", ["investigate"], 6, 47);
const roomStairs = exit("downstairs", "下楼 · 前台", ["back-reception", "go-reception", "wake-after-stay"]);
const bed = object("bed", "床边休息", ["lie-down", "sleep", "rest-another-night", "stay-one-more-night"], 82, 53);
const neighborReturn = exit("neighbor-return", "回到隔壁客房", ["back-neighbor", "leave-neighbor-water"]);
const hallwayReturn = exit("hallway-return", "二楼走廊", ["back-hallway"]);
const groundReturn = exit("ground-return", "一楼走廊", ["back-ground-hall", "leave-night-kitchen", "back-reception"]);
const water = object("water", "床边水杯", ["inspect-neighbor-water", "drink-neighbor-water"], 26, 52);
const wardrobe = object("wardrobe", "虚掩的衣柜", ["search-wardrobe", "inspect-ropes", "untangle-wardrobe", "take-bronze-key"], 85, 43);
const kitchenDoor = exit("kitchen-door", "厨房门", ["kitchen-threshold", "back-night-kitchen"], 20, 46);
const banquetDoor = exit("banquet-door", "旧双开门", ["banquet-door", "enter-banquet"], 42, 45);
const basementDoor = exit("basement-door", "地下室门", ["basement-door", "unlock-basement", "enter-basement"], 86, 65);
const kitchenPerson = group("kitchen-person", "案板旁的前台小姐", "person", ["greet-night-kitchen", "ask-night-meat"], 46, 35);
const kitchenSide = exit("kitchen-side", "宴会厅侧门", ["peek-banquet-door", "through-banquet-side"], 83, 39);
const banquetReturn = exit("banquet-return", "回到长桌旁", ["back-banquet"]);
const passageReturn = exit("passage-return", "沿水道返回", ["back-passage"], 20, 50);
const fleshReturn = exit("flesh-return", "回到水道深处", ["back-flesh"]);
const talk = (ids: string[]) => group("front-desk", "继续交谈", "person", ids, 24, 43);
const dialogue = (...groups: GroupDefinition[]) => frame("reception", "dialogue", ...groups);

const definitions: Record<SceneId, PresentationDefinition> = {
  arrival: frame("forest", "environment", distantInn, forestRoad),
  forest: frame("forest", "environment", distantInn, forestRoad, ruinsRoad),
  entrance: frame("entrance", "environment",
    exit("inn-door", "旅馆木门", ["enter"], 45, 56), exit("well-road", "门旁水井", ["well"]), forestRoad, ruinsRoad),
  escape: frame("forest", "ending"),
  ruins: frame("ruins", "environment",
    object("ruin-house", "半塌的小屋", ["house"], 16, 40),
    object("ruin-search", "墙边碎木", ["search", "rest", "search-ring"], 33, 70),
    object("doorplates", "散落的门牌", ["doorplates"]),
    decision("rest", "背风处休息", ["wait-morning"]), forestRoad, innRoad),
  tiredSearch: frame("ruins", "decision", decision("rest", "背风处休息", ["rest"]), innRoad),
  ringFind: frame("ruins", "detail", object("debris", "碎木之间的亮点", ["uncover-ring"]), ruinsReturn),
  ringUncovered: frame("ruins", "detail", object("ring", "碎木下的戒指", ["take-ring"]), ruinsReturn),
  portrait: frame("ruins", "detail", ruinsReturn),
  doorplates: frame("ruins", "detail", ruinsReturn),
  well: frame("well", "environment",
    object("well-water", "井口", ["drop-ring"], 32, 72), object("well-rope", "井绳", ["pull-rope"], 36, 52),
    exit("well-return", "旅馆门前", ["leave-well"], 80, 41)),
  ropeSlips: frame("well", "detail", object("windlass", "旧轱辘", ["set-windlass"], 34, 34), exit("rope-return", "放开井绳", ["leave-rope"])),
  ropeOnWindlass: frame("well", "detail", object("well-rope", "井绳", ["wrap-rope"], 36, 52), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWrapped: frame("well", "detail", object("windlass", "旧轱辘", ["turn-windlass"], 34, 34), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWoundOnce: frame("well", "detail", object("windlass", "旧轱辘", ["turn-windlass"], 34, 34), exit("rope-return", "松开井绳", ["leave-rope"])),
  ropeWoundTwice: frame("well", "detail", object("bucket", "井沿下的木桶", ["lift-bucket"]), exit("rope-return", "放下木桶", ["leave-rope"])),
  ringDropped: frame("well", "detail", object("well-water", "井口", ["look-well"], 32, 72), exit("well-return", "旅馆门前", ["leave-well"], 80, 41)),
  silverKey: frame("well", "detail", exit("well-return", "旅馆门前", ["leave-well"], 80, 41)),
  reception: frame("reception", "environment", frontDesk, ledger, portrait, stairs, groundRoute, drawer, cabinet,
    object("behind-desk", "柜台后", ["approach-empty-desk"], 43, 48), outdoors),
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
  guestRoom: frame("guest-room", "environment", bed, roomDoor, roomStairs),
  nightNoise: frame("guest-room", "decision", bed, roomDoor),
  morningRoom: frame("guest-room", "environment", bed, roomDoor, roomStairs, outdoors),
  recoveryRoom: frame("guest-room", "environment", bed, roomDoor, roomStairs, outdoors),
  lingeringNight: frame("guest-room", "decision", roomStairs),
  hallway: frame("upstairs-hall", "environment",
    exit("neighbor-door", "虚掩的房门", ["neighbor-door"], 19, 44),
    exit("stairs", "楼下的响动", ["follow-night-sound"], 81, 52), exit("own-room", "你的客房", ["back-room"])),
  neighborDoor: frame("upstairs-hall", "detail", exit("neighbor-door", "虚掩的房门", ["enter-neighbor"], 19, 44), hallwayReturn),
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
    exit("upstairs", "二楼走廊", ["back-hallway"]), exit("reception-return", "前台大厅", ["back-reception"])),
  nightKitchen: frame("kitchen", "environment", kitchenPerson, kitchenSide, exit("kitchen-return", "退回一楼走廊", ["leave-night-kitchen"])),
  nightKitchenTalk: frame("kitchen", "dialogue", kitchenPerson, exit("kitchen-return", "退回一楼走廊", ["leave-night-kitchen"])),
  nightKitchenMeat: frame("kitchen", "dialogue", exit("kitchen-return", "退回一楼走廊", ["leave-night-kitchen"])),
  kitchenThreshold: frame("kitchen", "environment", kitchenSide, groundReturn),
  banquetDoor: frame("ground-hall", "detail", banquetDoor, kitchenDoor, exit("ground-return", "退回一楼走廊", ["back-ground-hall"])),
  banquetHall: frame("banquet", "environment",
    object("banquet-table", "杯印与椅脚拖痕", ["inspect-banquet-table"], 49, 56),
    decision("banquet-listen", "空厅中的声音", ["listen-banquet"]),
    exit("kitchen-side", "厨房侧门", ["through-kitchen-side"], 86, 42), exit("banquet-exit", "双开门 · 一楼走廊", ["back-banquet-door"])),
  banquetTable: frame("banquet", "detail", banquetReturn),
  banquetEcho: frame("banquet", "dialogue", banquetReturn, exit("banquet-exit", "双开门 · 一楼走廊", ["back-banquet-door"])),
  basementDoor: frame("ground-hall", "detail", basementDoor, exit("ground-return", "回到一楼走廊", ["back-ground-hall"])),
  basementStairs: frame("basement-entry", "environment", exit("descend", "台阶尽头", ["descend"], 26, 73), exit("upstairs", "地下室门前", ["back-basement-door"], 16, 13)),
  basementShore: frame("basement-entry", "environment", exit("passage", "积水通道", ["wade"], 59, 52), exit("upstairs", "沿台阶返回", ["back-basement-stairs"], 17, 42)),
  floodedPassage: frame("basement-passage", "environment", object("drain-hole", "圆形孔洞", ["look-hole"]), exit("follow-wall", "沿墙继续寻找", ["follow-wall"], 83, 43), exit("shore", "退回水边", ["back-shore"])),
  drainHole: frame("basement-passage", "detail", decision("jump", "洞口前的决定", ["jump"]), exit("follow-wall", "沿墙找另一条路", ["follow-wall"]), exit("passage-return", "退回水道", ["back-passage"])),
  fleshCorridor: frame("basement-flesh", "environment",
    object("pillar", "倒塌的石柱", ["inspect-pillar"], 75, 66),
    object("tap", "墙上的龙头", ["inspect-tap"], 90, 37),
    object("wall-voice", "墙里的声音", ["listen-wall"], 61, 34), passageReturn),
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
    const current: SceneActionGroup = { ...display, ...(display.anchor ? { anchor: { ...display.anchor } } : {}), choices };
    // The morning/aged entrance is currently a distant forest view. Keep its marker on that door.
    if (state.scene === "entrance" && current.id === "inn-door" && art.src !== "/scenes/inn-entrance.webp") current.anchor = { x: 66, y: 55 };
    // A valid question may coexist with the empty-desk artwork. Do not put a person marker on air.
    if (current.id === "front-desk" && art.src === "/scenes/reception.webp") {
      delete current.anchor;
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
