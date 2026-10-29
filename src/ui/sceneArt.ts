import type { GameState, SceneId } from "../game/types.ts";

type ArtId = "forest" | "ruins" | "well" | "reception" | "guestRoom" | "upstairsHall"
  | "neighborRoom" | "groundHall" | "kitchen" | "banquet" | "basement"
  | "entrance" | "receptionAttended" | "hallPortrait" | "ruinsPortrait" | "registry"
  | "adultPhoto" | "breakfast" | "kitchenMorning" | "basementFlesh"
  | "forestMorning" | "forestAgedMorning" | "ruinsNight" | "wellMorning" | "neighborNight" | "upstairsHallNight" | "underwater";
export type SceneTone = "frost" | "stone" | "hearth" | "ember" | "deep";

interface ArtDefinition { src: string; alt: string; caption: string; tone: SceneTone }
export interface SceneArt extends ArtDefinition { age: number }

const artwork: Record<ArtId, ArtDefinition> = {
  forest: { src: "/scenes/forest-inn.webp", alt: "覆雪的云杉林中，一条小路通向亮着灯的石木旅馆。", caption: "云杉林 · 通往旅馆的小路", tone: "frost" },
  ruins: { src: "/scenes/ruins.webp", alt: "云杉林间，积雪覆盖着坍塌的村屋、旧门框和墓碑。", caption: "村庄遗迹 · 林间旧路", tone: "frost" },
  well: { src: "/scenes/well-night-v2.webp", alt: "旅馆旁的石井装着木轱辘，旅馆门口就在不远处。", caption: "旅馆外 · 井边", tone: "frost" },
  reception: { src: "/scenes/reception.webp", alt: "石墙旅馆的前台大厅：柜台后有肖像，楼梯上行，一楼走廊通向深处。", caption: "一楼 · 前台、楼梯与走廊", tone: "hearth" },
  guestRoom: { src: "/scenes/guest-room.webp", alt: "二楼客房有床、床头灯、旧木桌，窗外是覆雪云杉。", caption: "二楼 · 你的客房", tone: "hearth" },
  upstairsHall: { src: "/scenes/upstairs-hall.webp", alt: "二楼长廊有数扇客房门，一扇虚掩；远处是下行的楼梯。", caption: "二楼 · 客房长廊", tone: "stone" },
  neighborRoom: { src: "/scenes/neighbor-room.webp", alt: "隔壁客房的床边有半杯水，靠墙的衣柜虚掩着，房里没有看见人。", caption: "二楼 · 隔壁客房", tone: "stone" },
  groundHall: { src: "/scenes/ground-hall.webp", alt: "一楼走廊里，厨房门、宴会厅双开门和通往地下室的窄楼梯彼此相邻。", caption: "一楼 · 厨房、宴会厅与地下室", tone: "stone" },
  kitchen: { src: "/scenes/night-kitchen-attended-v2.webp", alt: "前台小姐在夜间厨房制作香肠，案板上有半只野猪和绞肉机，侧门通往宴会厅。", caption: "一楼 · 夜间厨房及宴会厅侧门", tone: "ember" },
  banquet: { src: "/scenes/banquet-hall-observed.webp", alt: "空着的旧宴会厅，长桌留下杯印，移开的餐椅与椅脚拖痕朝向双开门，一侧小门通向厨房。", caption: "一楼 · 旧宴会厅", tone: "hearth" },
  basement: { src: "/scenes/basement.webp", alt: "石阶降入积水的地下通道，水面消失在昏暗拐角。", caption: "地下室 · 湿冷石道", tone: "deep" },
  entrance: { src: "/scenes/inn-entrance.webp", alt: "雪夜旅馆门前，覆雪石阶通向厚木门，拱形石门框两侧挂着暖灯。", caption: "旅馆外 · 门前", tone: "frost" },
  receptionAttended: { src: "/scenes/reception-attended.webp", alt: "前台小姐在旧木柜台后，身后挂着男子肖像，旁边是楼梯与一楼走廊。", caption: "一楼 · 前台接待", tone: "hearth" },
  hallPortrait: { src: "/scenes/hall-portrait.webp", alt: "柜台后保养完好的男子肖像，灰发与胡须清楚，画中目光朝向观看的人。", caption: "前台 · 灯下的肖像", tone: "hearth" },
  ruinsPortrait: { src: "/scenes/ruins-family-portrait.webp", alt: "半塌小屋碎石旁的小幅全家福，画中的家人与小女孩微笑着。", caption: "半塌小屋 · 全家福画像", tone: "frost" },
  registry: { src: "/scenes/registry-detail.webp", alt: "柜台上摊开的旧登记簿与笔，纸页分成住客信息、入住日期和空白退房栏。", caption: "前台 · 登记簿", tone: "hearth" },
  adultPhoto: { src: "/scenes/adult-photo.webp", alt: "打开的下层锁柜中，叠好的衣物旁放着一张女子与男人并肩的旧合影。", caption: "前台锁柜 · 衣物下面的合影", tone: "hearth" },
  breakfast: { src: "/scenes/breakfast-detail.webp", alt: "旅馆餐桌上的早餐盘，几段煎香肠与面包摆在朴素的餐具旁。", caption: "旅馆餐桌 · 盘里的早餐", tone: "hearth" },
  kitchenMorning: { src: "/scenes/kitchen-morning-v2.webp", alt: "清晨厨房的案板已经擦净，旧绞肉机仍在，旁边侧门通向旧宴会厅。", caption: "一楼 · 清晨厨房门口", tone: "ember" },
  basementFlesh: { src: "/scenes/basement-flesh.webp", alt: "地下室深处的石壁混着木纹，食物形状的粉色肉瘤、墙上龙头与倒塌石柱映在浅水里。", caption: "地下室深处 · 异样的石壁", tone: "deep" },
  forestMorning: { src: "/scenes/forest-inn-morning.webp", alt: "清晨的覆雪云杉林中，小路通向石木旅馆，窗内仍透着暖光。", caption: "云杉林 · 清晨的旧路", tone: "frost" },
  forestAgedMorning: { src: "/scenes/forest-inn-aged-morning.webp", alt: "清晨的同一片云杉林里，旅馆屋檐破损，招牌褪色，一扇窗被旧木板钉住。", caption: "云杉林 · 清晨衰老的旅馆", tone: "frost" },
  ruinsNight: { src: "/scenes/ruins-night.webp", alt: "雪夜云杉林间，坍塌的村屋、旧门框和墓碑隐在暗处。", caption: "村庄遗迹 · 雪夜的石头", tone: "frost" },
  wellMorning: { src: "/scenes/well-morning.webp", alt: "清晨旅馆旁的石井装着木轱辘与井绳，潮湿石沿长着苔藓，门口就在不远处。", caption: "旅馆外 · 清晨井边", tone: "frost" },
  neighborNight: { src: "/scenes/neighbor-room-night.webp", alt: "没有亮灯的隔壁客房，床头有半杯水，靠墙衣柜虚掩，房里没有看见人。", caption: "二楼 · 夜里的隔壁客房", tone: "stone" },
  upstairsHallNight: { src: "/scenes/upstairs-hall-night.webp", alt: "夜间二楼长廊有数扇客房门，近处一扇虚掩，门内没有灯光；远处是下行楼梯。", caption: "二楼 · 夜间客房长廊", tone: "stone" },
  underwater: { src: "/scenes/basement-underwater.webp", alt: "地下室暗水包围视线，模糊水纹与气泡之间看不清出口，也看不清任何人的身份。", caption: "地下室 · 水下的黑暗", tone: "deep" },
};

// 环境调查共用画面；肖像、合影等特写只在实际观察节点出现。
export const sceneArtwork: Record<SceneId, ArtId> = {
  arrival: "forest", forest: "forest", entrance: "entrance", escape: "forest",
  ruins: "ruins", tiredSearch: "ruins", ringFind: "ruins", ringUncovered: "ruins", portrait: "ruinsPortrait", doorplates: "ruins",
  well: "well", ropeSlips: "well", ropeOnWindlass: "well", ropeWrapped: "well", ropeWoundOnce: "well", ropeWoundTwice: "well", ringDropped: "well", silverKey: "well",
  reception: "reception", emptyDesk: "reception", newGuest: "reception", innkeeperEnding: "reception", hallPortrait: "hallPortrait", registry: "registry", checkIn: "registry", keyHandover: "receptionAttended", cabinet: "reception", photoFind: "adultPhoto", deskDrawer: "reception",
  confrontationOpening: "receptionAttended", emilyAnswer: "receptionAttended", truthHub: "receptionAttended", kitchenQuestion: "receptionAttended", banquetQuestion: "receptionAttended", weddingMemory: "receptionAttended", snowNight: "receptionAttended", whyTheyStayed: "receptionAttended", edwardAnswer: "receptionAttended", identityAnswer: "receptionAttended", identityDoubt: "receptionAttended", innNature: "receptionAttended", checkoutHint: "receptionAttended", checkoutEnding: "entrance", rescueQuestion: "receptionAttended", breakfastOffer: "receptionAttended", breakfastPlate: "breakfast", breakfastInspect: "breakfast", breakfastResult: "reception",
  guestRoom: "guestRoom", nightNoise: "guestRoom", morningRoom: "guestRoom", recoveryRoom: "guestRoom", lingeringNight: "guestRoom",
  hallway: "upstairsHall", neighborDoor: "upstairsHall",
  neighborRoom: "neighborRoom", neighborWater: "neighborRoom", neighborWaterAfterDrink: "neighborRoom", wardrobe: "neighborRoom", wardrobeUntangled: "neighborRoom",
  groundHall: "groundHall", banquetDoor: "groundHall", basementDoor: "groundHall",
  nightKitchen: "kitchen", nightKitchenTalk: "kitchen", nightKitchenMeat: "kitchen", kitchenThreshold: "kitchenMorning",
  banquetHall: "banquet", banquetTable: "banquet", banquetEcho: "banquet",
  basementStairs: "basement", basementShore: "basement", floodedPassage: "basement", drainHole: "basement", fleshCorridor: "basementFlesh", brokenPillar: "basementFlesh", wallTap: "basementFlesh", wallVoice: "basementFlesh", wallVoiceReply: "basementFlesh", underwater: "underwater", underwaterRescue: "underwater", drownedEnding: "underwater",
};

export function artForScene(state: GameState | null): SceneArt {
  const id = state ? sceneArtwork[state.scene] : "forest";
  if (state?.scene === "reception") {
    // 对应剧情当前在场顺序；不改变选择、线索或存档状态。
    const attended = !state.flags.checkedIn || !state.flags.firstNightSlept
      || (!(state.flags.choseToStay && state.fusion >= 5)
        && (state.flags.basementTruthSeen || state.flags.rescuedFromBasement || state.breakfast === "unresolved"));
    return { ...artwork[attended ? "receptionAttended" : "reception"], age: 0 };
  }
  if (state && id === "ruins" && state.time === "night") return { ...artwork.ruinsNight, age: 0 };
  if (state && id === "well" && state.time === "morning") return { ...artwork.wellMorning, age: 0 };
  if (state && id === "upstairsHall" && !state.flags.firstNightSlept) return { ...artwork.upstairsHallNight, age: 0 };
  if (state && id === "neighborRoom" && !state.flags.firstNightSlept) return { ...artwork.neighborNight, age: 0 };
  const base = artwork[id];
  if ((id !== "forest" && id !== "entrance") || !state) return { ...base, age: 0 };
  const age = state.flags.enteredInn ? 0 : state.forestSteps >= 8 ? 3 : state.forestSteps >= 5 ? 2 : state.forestSteps >= 2 ? 1 : 0;
  const outdoor = state.time === "morning" ? artwork[age >= 2 ? "forestAgedMorning" : "forestMorning"]
    : age >= 2 ? { ...artwork.forest, src: "/scenes/forest-inn-aged.webp", alt: "同一片云杉林里，旅馆的木墙变旧，屋顶破损，有窗户被木板钉住。" } : base;
  const caption = age >= 2 ? age === 3 ? "云杉林 · 旅馆仿佛老去了许多年" : "云杉林 · 招牌与屋檐褪了色"
    : age === 1 ? "旅馆外 · 门框开始剥漆" : id === "entrance" ? "旅馆外 · 门前" : outdoor.caption;
  return { ...outdoor, caption, age };
}
