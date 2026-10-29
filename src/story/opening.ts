import { addItem, hasItem } from "../game/state.ts";
import { cordsUntangled, normalizeCordOrder } from "../game/cordPuzzle.ts";
import type { Choice, GameState, Scene, SceneId } from "../game/types.ts";

// 这里只放剧情、选项和发生效果的时机；字号与背景在样式和页面入口中维护。
const walk: Choice = {
  id: "walk", text: "继续行进",
  available: state => !state.flags.enteredInn || state.forestSteps < 13,
  apply: state => ({ ...state, forestSteps: Math.min(13, state.forestSteps + 1) }),
  next: state => {
    if (state.forestSteps >= 10) {
      if (!state.flags.enteredInn) return "escape";
      return state.scene === "forest" ? "entrance" : "forest";
    }
    return state.forestSteps === 3 ? "ruins" : "forest";
  },
};
const toInn: Choice = { id: "approach", text: "向旅馆走去", next: "entrance" };
const toRuins: Choice = { id: "ruins", text: "回到村庄遗迹", next: "ruins" };
// 玩家已经见过足够多的变化后，可以把剩余的赶路合并为一次明确决定。
const keepWalking: Choice = {
  id: "keep-walking", text: "不再停下，沿路一直走", next: "escape",
  available: state => !state.flags.enteredInn && state.forestSteps >= 5 && state.forestSteps < 10,
  apply: state => ({ ...state, forestSteps: 10 }),
};

const forestParagraphs: Record<number, string[]> = {
  1: ["你收回目光，继续向森林深处走去。", "暗夜的密林和乌鸦的叫声，逐渐扰乱了你的判断。你已经说不清自己走了多久。", "模模糊糊中，前方又出现了那间旅馆。"],
  2: ["你绕开路边折断的树枝，又走了很远。", "灯光再次浮现在树影之间。那根折断的树枝，就在你的脚边。", "旅馆门前的漆面有些剥落。你记得刚才走过时，那里还是光滑的。"],
  4: ["你沿着另一侧的林缘走去。", "雪地里留着一串脚印。你停下比了比，鞋底的缺口和你的完全一样。"],
  5: ["乌鸦从树枝上飞起，落向前方。", "走近后，你看见那棵树上仍蹲着一只乌鸦，脚下压着同一根弯曲的枝条。", "灯下的招牌褪了色，屋檐边垂着一块开裂的旧木板。树林却没有同样衰老。"],
  6: ["你选了背对灯光的方向。", "走过一段缓坡，窗里的光却从正前方照了过来。"],
  7: ["一块歪斜的路牌立在雪里，字迹已经磨损。", "你从左侧绕过去。再次碰到它时，牌面朝向了相反的方向。"],
  8: ["你低下头，只盯着自己的脚步。", "鞋尖踢到一根折断的树枝。你还记得它的形状。", "旅馆的一扇窗已被木板钉住。招牌斜挂着，像在风雪里站了几十年。唯独门内的灯仍亮着。"],
  9: ["旅馆又出现在前面，窗户里的光依然温暖。", "你没有停下。风把身后的脚印一点点填平。"],
};
// 进过旅馆后的林路仍可探索，但不再通向「一直向前」结局。
// 每次给出不同的环境反馈，让玩家从故事里察觉这条路已变。
const forestAfterEntry: Record<number, string> = {
  1: "你回头时，看见自己刚从旅馆门里出来时留下的脚印。它们一直延伸到这条路上。",
  2: "你绕过那根折断的树枝，回头再看时，它又躺在脚边；树缝里的灯光也没有离远。",
  4: "那串与你鞋底相同的脚印，最后消失在一片被人踩平的门前积雪里。",
  5: "乌鸦没有叫。远处却传来一声轻响，像有人替你合上了门。",
  6: "坡后的灯光比刚才更近，像整间旅馆悄悄挪到了路前。",
  7: "路牌背面有一道划痕，像有人沿着通往旅馆的那一面反复摸过。",
  8: "你低头走了很久，鞋尖仍碰到那根熟悉的断枝，灯光也没有被抛在身后。",
  9: "风抹掉了身后的脚印。那扇亮窗仍正对着你，像在等你回来。",
};

export const openingScenes: Record<SceneId, (state: GameState) => Scene> = {
  arrival: () => ({
    location: "森林边缘", title: "风雪中的灯光",
    paragraphs: ["1860 年的一个雪夜。经过长途跋涉，你的脚步已经越来越沉。", "风穿过暗处的树枝。前方，一间旅馆的窗户透出昏黄的灯光。", "你在路边停了下来。"],
    choices: [toInn, { ...walk, text: "不顾疲惫，继续赶路" }],
  }),
  forest: state => ({
    location: "林间小路", title: state.time === "morning" ? "林间的旧路" : "又一盏熟悉的灯",
    paragraphs: state.flags.enteredInn && state.forestSteps >= 10
      ? ["你向林外走到腿发麻，脚下的路却渐渐变成旅馆门前那条。", "你想起自己跨进那扇门时，靴底在门槛上磕了一下。现在无论朝哪边走，亮着灯的窗总会重新出现在前方。", ...(state.forestSteps >= 13 ? ["我已经沿这条路试了太多次。再往前，不过是再回到那扇门前。"] : [])]
      : [
          ...(state.time === "morning"
            ? ["天色已经亮了，你沿着林间的路继续走。", ...(forestParagraphs[state.forestSteps] ?? ["穿过树影，那间旅馆仍然出现在道路尽头。"]).slice(-1)]
            : forestParagraphs[state.forestSteps] ?? ["穿过树影，那间旅馆仍然出现在道路尽头。"]),
          ...(state.flags.enteredInn && forestAfterEntry[state.forestSteps] ? [forestAfterEntry[state.forestSteps]] : []),
        ],
    choices: [toInn, state.flags.enteredInn ? { ...walk, text: "继续寻找出路" } : walk, keepWalking, { ...toRuins, available: current => current.forestSteps >= 3 }],
  }),
  ruins: state => ({
    location: "村庄遗迹", title: state.time === "night" ? "雪下的石头" : "荒废的村庄",
    paragraphs: state.time === "night"
      ? ["林木之间，你看见了不一样的东西：几块墓碑，以及石材制成的村庄残骸。", "墙体大半已经坍塌。你靠近一处背风的角落，疲惫让视线有些模糊。", ...(state.flags.enteredInn ? ["你明明背对旅馆而行，却又走到了这些石头前。"] : [])]
      : ["天亮后，遗迹的轮廓逐渐清楚。这片地方以前似乎是一座村庄。", "几栋小屋已经半塌，门牌或悬挂在墙上，或落在积雪里。", ...(state.flags.enteredInn ? ["你从旅馆门前出发，还是绕回了这片遗迹。"] : state.forestSteps >= 5 ? ["林间那间旅馆的屋檐比初见时更旧，眼前的残屋却没有继续坍塌。"] : [])],
    choices: state.time === "night" ? [
      { id: "search", text: "强撑着调查一番", next: "tiredSearch" },
      { id: "rest", text: "稍作休息，再搜寻附近", next: "ringFind", available: current => !current.flags.ringFound },
      { id: "wait-morning", text: "在背风处休息到天亮", next: "ruins", apply: current => ({ ...current, day: current.day + 1, time: "morning", flags: { ...current.flags, ruinsSeen: true } }) },
      state.flags.enteredInn ? { ...walk, text: "继续寻找出路" } : walk, keepWalking, toInn,
    ] : [
      { id: "house", text: state.flags.portraitSeen ? "再看看半塌的小屋" : "调查半塌的小屋", next: "portrait", apply: current => ({ ...addItem(current, "portrait"), flags: { ...current.flags, portraitSeen: true, ruinsSeen: true } }) },
      { id: "doorplates", text: "查看散落的门牌", next: "doorplates", apply: current => ({ ...current, flags: { ...current.flags, doorplatesSeen: true, ruinsSeen: true } }) },
      { id: "search-ring", text: "查看废墟中的亮点", next: "ringFind", available: current => !current.flags.ringFound },
      state.flags.enteredInn ? { ...walk, text: "继续寻找出路" } : walk, keepWalking, toInn,
    ],
  }),
  tiredSearch: () => ({
    location: "村庄遗迹", title: "疲惫的侵扰",
    paragraphs: ["你试着沿墙摸索，可只能模模糊糊地感到石头硌着手掌。", "眼下的疲惫，让你无法再仔细分辨这里的东西。"],
    choices: [{ id: "rest", text: "先找个背风的地方休息", next: "ruins" }, toInn],
  }),
  ringFind: state => ({
    location: "村庄遗迹", title: "碎木之间的微光",
    paragraphs: state.flags.ringFound
      ? ["碎木之间已经没有别的东西了。"]
      : ["稍微缓过气来后，你俯下身，仔细搜寻附近。", "倒塌的木条下面透出一点金属微光，但压在上面的碎木挡住了视线。"],
    choices: [
      { id: "uncover-ring", text: "拨开压住亮点的碎木", next: "ringUncovered", available: current => !current.flags.ringFound },
      { id: "leave-ring", text: "回到遗迹旁", next: "ruins" },
    ],
  }),
  ringUncovered: () => ({
    location: "村庄遗迹", title: "木条下面",
    paragraphs: ["你依次移开压在上面的木条。泥雪之间躺着一枚戒指，金属边缘仍有微弱的光。"],
    choices: [
      { id: "take-ring", text: "拾起戒指", next: "ruins", apply: current => ({ ...addItem(current, "ring"), flags: { ...current.flags, ringFound: true } }) },
      { id: "leave-ring", text: "先回到遗迹旁", next: "ruins" },
    ],
  }),
  portrait: () => ({
    location: "半塌的小屋", title: "画中的一家人",
    paragraphs: ["你走进一间半塌的小屋。地上的碎石下面，掩埋着一幅小小的全家福画像。", "你轻轻拾起它。画中人笑得很幸福，画框背面有稚嫩的笔迹：", "艾米莉的全家福，1682。", "你将画像收好，记下了这个名字和年份。"],
    choices: [toRuins],
  }),
  doorplates: () => ({
    location: "村庄遗迹", title: "留下来的名字",
    paragraphs: ["爱德华与艾米莉之家。劳埃德的陋室。山姆的肉铺……", "你逐一辨认门牌上的字迹，把还能看清的名字记了下来。"],
    choices: [toRuins],
  }),
  entrance: state => ({
    location: "旅馆外", title: "孤零零的旅馆",
    paragraphs: ["旅馆的规模不小，周围却看不到完整的村庄。门边不远处，有几口水井。", ...(state.flags.ruinsSeen ? ["想起那片村庄遗迹，你忽然觉得水井离旅馆太近了。"] : []), ...(state.flags.enteredInn ? ["你已经认得门内的暖意。回头望向来路，林间的脚印却像都朝着旅馆而来。", ...(state.forestSteps >= 5 ? ["门框上的漆又平整了。你记得自己在林中看见过那些裂痕。"] : [])] : state.forestSteps >= 8 ? ["门边的木板已被风蚀得发灰，招牌斜挂着；灯光却像第一次看见时一样亮。"] : state.forestSteps >= 5 ? ["招牌上的字迹比初见时淡了许多，屋檐裂开一道细缝。"] : state.forestSteps >= 2 ? ["门框上的新漆不知何时起了皮。"] : []), ...(state.flags.enteredInn && state.forestSteps >= 13 ? ["我不想再踏上那条只会绕回这里的路。也许该从旅馆本身寻找答案。"] : []), "再往前，就是旅馆的门。"],
    choices: [
      { id: "well", text: "走近水井看看", next: "well" },
      { id: "enter", text: "进入旅馆", next: "reception", apply: current => ({ ...current, flags: { ...current.flags, enteredInn: true, emilySawRing: current.flags.emilySawRing || hasItem(current, "ring") } }) },
      { ...walk, text: state.flags.enteredInn ? "沿来路试着离开" : "离开门前，继续赶路" },
      keepWalking,
      { ...toRuins, available: current => current.forestSteps >= 3 },
    ],
  }),
  well: state => {
    const keyReady = state.ringDroppedOnDay !== null && state.day > state.ringDroppedOnDay && !hasItem(state, "silverKey");
    return {
      location: "旅馆外 · 水井", title: keyReady ? "绷紧的井绳" : "平静的井水",
      paragraphs: [
        "井壁由石砖砌成，上面很潮湿，长满了苔藓。水面平静，看不出异样。",
        ...(state.time === "morning" ? ["天光下，你发现藤蔓已经爬到接近井沿的位置，像是很久没有人打理。"] : []),
        ...(state.flags.neighborWaterDrank ? ["潮湿的石沿让你想起隔壁那杯凉而微涩的水。这里只能闻到苔藓，无法确定它们是否相连。"] : state.flags.neighborWaterSeen ? ["井水的表面与你在隔壁客房看到的那杯水一样平静。"] : []),
        ...(keyReady ? ["井绳似乎被什么东西拉得很紧。"] : []),
      ],
      choices: [
        { id: "drop-ring", text: "把戒指丢下去试试", next: "ringDropped", available: current => hasItem(current, "ring"), apply: current => ({ ...current, inventory: current.inventory.filter(item => item !== "ring"), ringDroppedOnDay: current.day }) },
        { id: "pull-rope", text: "拉动井绳", next: "ropeSlips", available: () => keyReady },
        { id: "leave-well", text: "回到旅馆门前", next: "entrance" },
      ],
    };
  },
  ropeSlips: () => ({
    location: "旅馆外 · 水井", title: "滑开的井绳",
    paragraphs: ["你抓住井绳用力一拉。潮湿的绳子立刻从掌心滑过去，木桶只在井里轻轻晃了一下。", "井沿旁有一架旧轱辘，轮轴还算结实。"],
    choices: [{ id: "set-windlass", text: "把井绳搭上轱辘", next: "ropeOnWindlass" }, { id: "leave-rope", text: "先放开井绳", next: "well" }],
  }),
  ropeOnWindlass: () => ({
    location: "旅馆外 · 水井", title: "架在轮上的绳子",
    paragraphs: ["你将井绳压进轱辘的凹槽。绳子不再乱滑，可木桶的重量仍压着手指。", "若想稳住它，得先把松出的绳头绕在手上。"],
    choices: [{ id: "wrap-rope", text: "把绳头缠在手上", next: "ropeWrapped" }, { id: "leave-rope", text: "松开绳子，稍后再试", next: "well" }],
  }),
  ropeWrapped: () => ({
    location: "旅馆外 · 水井", title: "绷紧的掌心",
    paragraphs: ["你把绳头绕过掌心，握紧。井绳贴着皮肤绷住，轱辘可以转动了。", "木桶还沉在井下。"],
    choices: [{ id: "turn-windlass", text: "转动轱辘", next: "ropeWoundOnce" }, { id: "leave-rope", text: "松开绳子，稍后再试", next: "well" }],
  }),
  ropeWoundOnce: () => ({
    location: "旅馆外 · 水井", title: "井下的重量",
    paragraphs: ["轱辘缓缓转过半圈，湿绳一层层卷上木轴。井下传来木桶碰到石壁的闷响。", "你稳住手，再把轱辘往前带。"],
    choices: [{ id: "turn-windlass", text: "继续转动轱辘", next: "ropeWoundTwice" }, { id: "leave-rope", text: "松开绳子，稍后再试", next: "well" }],
  }),
  ropeWoundTwice: () => ({
    location: "旅馆外 · 水井", title: "井沿下的木桶",
    paragraphs: ["木桶的边缘终于出现在井口下方。绳子还勒着手，但重量已经压在轱辘上。", "再拉一把，就能把桶翻上来。"],
    choices: [{ id: "lift-bucket", text: "拉起木桶", next: "silverKey", apply: current => addItem(current, "silverKey") }, { id: "leave-rope", text: "先放下木桶", next: "well" }],
  }),
  ringDropped: () => ({
    location: "旅馆外 · 水井", title: "什么也没发生",
    paragraphs: ["你松开手，戒指坠入井中。", "你等了一会儿。什么也没发生。"],
    choices: [{ id: "look-well", text: "再看看水井", next: "well" }, { id: "leave-well", text: "回到旅馆门前", next: "entrance" }],
  }),
  silverKey: () => ({
    location: "旅馆外 · 水井", title: "木桶里的钥匙",
    paragraphs: ["木桶被慢慢拉了上来。里面没有水，只有一枚温润的银白色钥匙。", "你取出钥匙，放进随身物品里。"],
    choices: [{ id: "leave-well", text: "回到旅馆门前", next: "entrance" }],
  }),
  reception: state => ({
    location: "旅馆前台", title: state.flags.checkedIn ? "重新回到前台" : "门内的暖意",
    paragraphs: state.flags.checkedIn ? [
      state.flags.firstNightSlept
        ? state.flags.choseToStay && state.fusion >= 5
          ? "前台小姐见你下楼，轻轻点头，转身去了厨房。柜台暂时空着，登记簿和客房钥匙摆在惯常的位置。"
          : state.flags.basementTruthSeen
          ? "前台小姐已经回到柜台后。你踩在干燥的地板上，却仍觉得鞋里有地下室的凉水。她看了一眼你的鞋。"
          : state.flags.rescuedFromBasement
            ? "前台小姐在柜台后，神情和往常一样。你醒来时湿透的衣袖，她却像是没有看见。"
            : state.breakfast === "unresolved"
          ? "清晨的大厅安静得过分。前台小姐在柜台后整理纸页，抬头向你微笑。"
          : state.day > 2
            ? "大厅依旧温暖，柜台后暂时没人。登记簿仍摊在桌上，仿佛一直在等下一行名字。"
            : "柜台后暂时没人。厨房的方向传来轻微的碗碟声，登记簿仍摊在桌上。"
        : "前台的灯还亮着。前台小姐把手里的纸页放回登记簿。",
      ...(state.flags.firstNightSlept && state.breakfast === "unresolved" ? [state.flags.basementTruthSeen || state.flags.rescuedFromBasement ? "桌边还留着早饭。她轻声问你要不要吃一点。" : "“昨晚休息得好吗？要不要吃点早饭？”她问。"] : []),
    ] : [
      "你推开旅馆的门，把风雪留在身后。前台的桌子后面，挂着一幅很大的肖像画。",
      "“还有空房吗？”",
      "前台的小姐抬起头：“……当然。”",
      ...(state.flags.portraitSeen ? ["她的眉眼，让你想起画像里那个叫艾米莉的孩子。"] : []),
      ...(hasItem(state, "ring") ? ["她的目光扫过你手里的戒指，脸上浮现了一瞬讶异，很快又恢复了原样。"] : []),
      ...(state.forestSteps >= 5 ? ["你回头看向门。室内的木框打磨得很平整，看不见刚才在外面见到的剥漆和裂痕。"] : []),
    ],
    choices: state.flags.checkedIn ? [
      { id: "approach-empty-desk", text: "不知不觉走到柜台后", next: "emptyDesk", available: current => current.fusion >= 5 && current.flags.choseToStay },
      { id: "confront-basement", text: state.flags.emilyAdmittedHouse ? "继续追问地下室与旧村庄" : "问她地下室里究竟有什么", next: state.flags.emilyAdmittedHouse ? "truthHub" : "confrontationOpening", available: current => current.flags.basementTruthSeen },
      { id: "ask-rescue", text: "问她是谁把你从水里救上来", next: "rescueQuestion", available: current => current.flags.rescuedFromBasement && !current.flags.basementTruthSeen },
      { id: "breakfast-offer", text: "回应早餐邀请", next: "breakfastOffer", available: current => current.flags.firstNightSlept && current.breakfast === "unresolved" },
      { id: "look-registry", text: "翻看登记簿", next: "registry", apply: current => ({ ...current, flags: { ...current.flags, registrySeen: true, ownEntrySeen: true } }) },
      { id: "look-hall-portrait", text: "查看柜台后的肖像画", next: "hallPortrait", apply: current => ({ ...current, flags: { ...current.flags, hallPortraitSeen: true } }) },
      { id: "ground-hall", text: "沿一楼走廊看看", next: "groundHall", available: current => current.flags.firstNightSlept },
      { id: "search-desk", text: "趁前台没人，看看抽屉", next: "deskDrawer", available: current => current.flags.firstNightSlept && current.breakfast !== "unresolved" && !hasItem(current, "oldLedger"), apply: current => addItem(current, "oldLedger") },
      { id: "inspect-cabinet", text: "查看抽屉下方的锁柜", next: "cabinet", available: current => current.flags.firstNightSlept && current.breakfast !== "unresolved" },
      { id: "return-room", text: "回到客房", next: state.flags.rescuedFromBasement ? "recoveryRoom" : state.flags.firstNightSlept ? "morningRoom" : "guestRoom", apply: current => current.flags.firstNightSlept ? current : { ...current, time: "night" } },
      { id: "leave-inn", text: "到旅馆外看看", next: "entrance" },
    ] : [
      { id: "start-check-in", text: "办理入住", next: "checkIn", apply: current => ({ ...current, flags: { ...current.flags, registrySeen: true } }) },
      { id: "look-registry", text: "先看看柜台上的登记簿", next: "registry", apply: current => ({ ...current, flags: { ...current.flags, registrySeen: true } }) },
      { id: "look-hall-portrait", text: "查看柜台后的肖像画", next: "hallPortrait", apply: current => ({ ...current, flags: { ...current.flags, hallPortraitSeen: true } }) },
      { id: "leave-inn", text: "暂时走出旅馆", next: "entrance" },
    ],
  }),
  emptyDesk: () => ({
    location: "旅馆前台 · 柜台后", title: "熟悉的位置",
    paragraphs: ["前台小姐刚刚离开。你原本只是想看看摊开的登记簿，却已经绕到柜台后面。", "纸、笔和客房钥匙各有位置，你不用寻找，就知道该从哪里拿起它们。", "那把椅子空着，像是一直留给你的。"],
    choices: [{ id: "sit-behind-desk", text: "在柜台后坐下", next: "newGuest" }, { id: "step-away-desk", text: "退回大厅，想一想", next: "reception" }],
  }),
  newGuest: () => ({
    location: "旅馆前台 · 柜台后", title: "门外的脚步",
    paragraphs: ["你坐下，把登记簿翻到空白的一页。楼上那阵挪动家具的声音停了。", "门响了。一个满身积雪的陌生旅人走进来，在门口迟疑片刻。", "“抱歉……还有空房吗？”"],
    choices: [{ id: "answer-guest", text: "回答旅人", next: "innkeeperEnding" }],
  }),
  innkeeperEnding: () => ({
    location: "旅馆前台 · 柜台后", title: "还有空房吗",
    paragraphs: ["你抬起头，看见他肩上的雪还没融化。", "你明明没有查看房间，却知道楼上还有一间空着。笔已经停在新的一行。", "“……当然。”"],
    choices: [],
    ending: "结局 · 前台",
  }),
  hallPortrait: () => ({
    location: "旅馆前台", title: "灯下的肖像",
    paragraphs: ["柜台后的肖像画保养得很好，清漆几乎没有开裂。", "画中人正看着你。你稍稍移开一步，仍觉得那目光落在自己身上。"],
    choices: [{ id: "back-reception", text: "回到柜台前", next: "reception" }],
  }),
  registry: state => ({
    location: "旅馆前台 · 登记簿", title: state.flags.checkoutHintSeen ? "最后一栏" : state.flags.checkedIn ? "多出的一行" : "空白的退房栏",
    paragraphs: [
      "你翻开厚厚的登记簿。爱德华、蒙德、艾米莉……许多名字都留在这里，每个人旁边都有入住日期。",
      "再往右看，退房日期那一栏却整列空着。",
      ...(state.flags.checkedIn ? ["你的名字也在新的一行。入住日期写得清清楚楚，退房日期仍是一片空白。"] : []),
      ...(state.flags.checkoutHintSeen ? ["你想起刚才问怎样离开时，前台小姐的目光落在这里。纸上没有锁，笔就在旁边。", ...(state.fusion >= 3 ? ["握住笔的那一刻，你竟有些不舍，仿佛要从一间熟悉的家里搬走。"] : [])] : []),
    ],
    choices: state.flags.checkedIn
      ? [
        { id: "write-checkout", text: "写下今天的退房日期", next: "checkoutEnding", available: current => current.flags.checkoutHintSeen, apply: current => ({ ...current, flags: { ...current.flags, checkedOut: true } }) },
        { id: "back-reception", text: "合上登记簿", next: "reception" },
      ]
      : [{ id: "start-check-in", text: "办理入住", next: "checkIn" }, { id: "back-reception", text: "先放下登记簿", next: "reception" }],
  }),
  checkIn: () => ({
    location: "旅馆前台", title: "写下入住日期",
    paragraphs: ["前台小姐把登记簿推到你面前，指了指新的一行，等你写下名字和今天的日期。", "纸页上那些旧住客的退房栏，全都没有填写。你停了一下笔，她却只是在一旁等着。"],
    choices: [
      { id: "finish-check-in", text: "填好信息，接过钥匙", next: "keyHandover", apply: current => { const withKey = addItem(current, "roomKey"); return { ...withKey, flags: { ...withKey.flags, checkedIn: true } }; } },
      { id: "back-reception", text: "暂时放下笔", next: "reception" },
    ],
  }),
  keyHandover: () => ({
    location: "旅馆前台", title: "通往二楼的钥匙",
    paragraphs: ["你填好入住信息。前台小姐拿出一把铜钥匙，钥匙牌上写着房号。", "“楼梯在那边。”她说完，又垂眼看向登记簿。"],
    choices: [
      { id: "look-registry", text: "再看一眼登记簿", next: "registry", apply: current => ({ ...current, flags: { ...current.flags, registrySeen: true, ownEntrySeen: true } }) },
      { id: "go-room", text: "拿着钥匙上楼", next: "guestRoom", apply: current => ({ ...current, time: "night" }) },
      { id: "back-reception", text: "留在前台", next: "reception" },
    ],
  }),
  guestRoom: state => ({
    location: "二楼 · 客房", title: "第一夜的房间",
    paragraphs: [
      "钥匙转动后，门开了。房里有床、床头灯和一扇被雪遮住的窗。",
      ...(state.day > 1 ? ["你在客房里安顿下来。再抬头时，窗外已经暗了。"] : []),
      "你脱下外套，刚想躺下，楼下似乎传来家具被拖动的声音。",
      ...(state.flags.neighborRoomSeen ? ["你想起隔壁空着的房间，以及地板下面那阵闷响。"] : []),
    ],
    choices: [
      { id: "lie-down", text: "先躺下休息", next: "nightNoise" },
      { id: "investigate", text: "出去看看声音从哪里来", next: "hallway" },
      { id: "back-reception", text: "下楼回到前台", next: "reception" },
    ],
  }),
  nightNoise: () => ({
    location: "二楼 · 客房", title: "隔着地板的响动",
    paragraphs: ["床头灯把昏黄的光投在你的脸上。那阵声响断断续续，像有人在挪动沉重的家具。", "你翻了几次身，仍然没有睡着。"],
    choices: [
      { id: "sleep", text: "用纸巾堵住耳朵，设法睡去", next: "morningRoom", apply: current => ({ ...current, day: current.day + 1, time: "morning", flags: { ...current.flags, firstNightSlept: true } }) },
      { id: "investigate", text: "起身到走廊看看", next: "hallway" },
    ],
  }),
  hallway: state => ({
    location: "二楼 · 走廊", title: state.flags.firstNightSlept ? "白天的长廊" : "一排紧闭的门",
    paragraphs: state.flags.firstNightSlept
      ? ["白天再看，走廊似乎比昨夜更长。大部分房门仍紧闭着。", "隔壁那扇门依旧虚掩，门缝里露出一线灯光。"]
      : ["走廊比想象中长。门一扇接着一扇，大多紧闭，墙上挂着保养得很好的肖像画。", "那阵挪动家具的声音停了。隔壁的一扇门却没有完全合拢。"],
    choices: [{ id: "neighbor-door", text: "走近虚掩的房门", next: "neighborDoor" }, { id: "follow-night-sound", text: "沿楼梯寻找楼下的响动", next: "groundHall", available: current => current.time === "night" }, { id: "back-room", text: "回自己的房间", next: state.flags.firstNightSlept ? "morningRoom" : "guestRoom" }],
  }),
  neighborDoor: state => ({
    location: "二楼 · 隔壁", title: "虚掩的门",
    paragraphs: state.flags.firstNightSlept
      ? ["你轻轻推了推门。屋里没人，床头灯却在白天亮着。", "门旁的衣柜并没有关严。"]
      : ["你轻轻推了推门。门内没有灯光，也没有脚步声。", "空气里有木头和灰尘的味道。那阵声音似乎又在更下方响了一下。"],
    choices: [
      { id: "enter-neighbor", text: "进去看一眼", next: "neighborRoom", apply: current => ({ ...current, flags: { ...current.flags, neighborRoomSeen: true } }) },
      { id: "back-hallway", text: "退回走廊", next: "hallway" },
    ],
  }),
  neighborRoom: state => ({
    location: "二楼 · 隔壁", title: "空着的房间",
    paragraphs: state.flags.firstNightSlept
      ? ["屋里没有人，床头灯却亮着。靠墙的衣柜门虚掩着，床边放着半杯水。", "你正要走近，木板下又响起一声轻微的摩擦。"]
      : ["屋里只有一张铺好的床、靠墙的衣柜和床边半杯水。你没有看见人，也找不到家具被拖动的痕迹。", "你屏住呼吸，木板下面传来一声短促的摩擦，然后又归于安静。"],
    choices: [
      { id: "inspect-neighbor-water", text: "观察床边的水", next: "neighborWater", apply: current => ({ ...current, flags: { ...current.flags, neighborWaterSeen: true } }) },
      { id: "search-wardrobe", text: "打开虚掩的衣柜", next: "wardrobe", available: current => current.flags.firstNightSlept && !hasItem(current, "bronzeKey") },
      { id: "back-hallway", text: "回到走廊", next: "hallway" },
    ],
  }),
  neighborWater: state => ({
    location: "二楼 · 隔壁", title: "床头的半杯水",
    paragraphs: ["杯沿干净，杯壁却是凉的。水面静得看不出刚才那阵响动来自哪里。", state.flags.neighborWaterDrank
      ? "你喝过一口，水位比初见时低了些；屋里仍没有人出现。"
      : "长途赶路后，你有些口渴。杯中的水看不出异样，但你不知道它放在这里多久了。"],
    choices: [
      { id: "drink-neighbor-water", text: "喝一口水", next: "neighborWaterAfterDrink", available: current => !current.flags.neighborWaterDrank, apply: current => ({ ...current, flags: { ...current.flags, neighborWaterDrank: true } }) },
      { id: "leave-neighbor-water", text: "把水杯留在原处", next: "neighborRoom" },
    ],
  }),
  neighborWaterAfterDrink: () => ({
    location: "二楼 · 隔壁", title: "凉水的味道",
    paragraphs: ["水很凉，入口时有一点微涩，舌根留下很轻的铁味。你放下杯子，仍听见木板下传来断断续续的摩擦声。", "你没有看到屋里有别人。"],
    choices: [{ id: "leave-neighbor-water", text: "回头再看这间屋子", next: "neighborRoom" }],
  }),
  morningRoom: state => ({
    location: "二楼 · 客房", title: state.flags.peacefulSleepUsed ? "又一个清晨" : "雪后的清晨",
    paragraphs: state.flags.peacefulSleepUsed
      ? ["你在旅馆里又过了一夜。醒来时，床头灯还亮着，窗外的雪也没有停。", "这里的安静让你渐渐熟悉。"]
      : ["你醒来时，床头灯还亮着。昨晚的响动已经停了，窗外的雪却还在下。", "登记簿上那些空白的退房日期，忽然又浮现在你眼前。"],
    choices: [
      { id: "go-reception", text: "下楼回到前台", next: "reception" },
      { id: "investigate", text: "去看看隔壁房间", next: "hallway" },
      { id: "go-outside", text: "到旅馆外透口气", next: "entrance" },
      { id: "rest-another-night", text: "结束白天，在客房安心睡一晚", next: "morningRoom", available: current => current.breakfast !== "unresolved", apply: current => ({ ...current, day: current.day + 1, time: "morning", fusion: Math.min(6, current.fusion + (current.flags.peacefulSleepUsed ? 0 : 1)), flags: { ...current.flags, peacefulSleepUsed: true } }) },
    ],
  }),
  wardrobe: state => ({
    location: "二楼 · 隔壁", title: hasItem(state, "bronzeKey") ? "空下来的挂钩" : cordsUntangled(normalizeCordOrder(state.cordOrder)) ? "绳阵里的钥匙" : "衣柜里的绳阵",
    paragraphs: hasItem(state, "bronzeKey")
      ? ["衣柜里的空衣架仍在轻轻晃动。内侧木板上只剩几根已经理顺的绳子；古铜色钥匙在你手里。"]
      : cordsUntangled(normalizeCordOrder(state.cordOrder))
        ? ["二十根绳子已经沿圆框安静垂下。木板内侧的古铜色钥匙终于露了出来。"]
        : ["几件空衣架轻轻相碰。内侧木板上嵌着一圈旧木框，二十根绳子横穿圆框，遮住了中央的古铜色钥匙。", "每根绳子的两端都扣在圆周的活动栓上。要取下钥匙，得挪动这些绳端，让圆框内不再有绳线相交。"],
    choices: [
      { id: "inspect-ropes", text: "查看圆框上的绳阵", next: "wardrobe", available: current => !hasItem(current, "bronzeKey") && !cordsUntangled(normalizeCordOrder(current.cordOrder)) },
      { id: "untangle-wardrobe", text: "取下已露出的钥匙", next: "wardrobeUntangled", available: current => !hasItem(current, "bronzeKey") && cordsUntangled(normalizeCordOrder(current.cordOrder)) },
      { id: "back-neighbor", text: "退出衣柜", next: "neighborRoom" },
    ],
  }),
  wardrobeUntangled: () => ({
    location: "二楼 · 隔壁", title: "露出的钥匙",
    paragraphs: ["圆框里的绳子终于不再交叉。木板内侧的古铜色钥匙完整露了出来。"],
    choices: [
      { id: "take-bronze-key", text: "取下古铜色钥匙", next: "wardrobe", apply: current => addItem(current, "bronzeKey") },
      { id: "back-neighbor", text: "先退出衣柜", next: "neighborRoom" },
    ],
  }),
  cabinet: state => ({
    location: "旅馆前台 · 锁柜", title: hasItem(state, "adultPhoto") ? "已经打开的柜门" : "下层锁柜",
    paragraphs: hasItem(state, "adultPhoto")
      ? ["下层柜门还敞着。里面只剩几件叠好的衣物。"]
      : ["柜门上的锁孔很小，旁边的铜片已经磨得发亮。", ...(hasItem(state, "bronzeKey") ? ["你想起隔壁衣柜里的那把古铜色钥匙。"] : ["你手里的客房钥匙形状不对，插不进锁孔。"])],
    choices: [
      { id: "unlock-cabinet", text: "用古铜色钥匙打开锁柜", next: "photoFind", available: current => hasItem(current, "bronzeKey") && !hasItem(current, "adultPhoto"), apply: current => addItem(current, "adultPhoto") },
      { id: "back-reception", text: "回到前台", next: "reception" },
    ],
  }),
  photoFind: state => ({
    location: "旅馆前台 · 锁柜", title: "衣物下面的合影",
    paragraphs: ["钥匙轻轻一转，柜门开了。里面有几件女士的衣物和一套制服。", "你从衣物下面取出一张旧合影：一位女子站在一个男人身边。", ...(state.flags.portraitSeen ? ["女子的眉眼，和遗迹里那幅画像中的小女孩很像。"] : []), "合影背面写着：他终于向我表白了，还送我一枚亲手做的戒指。"],
    choices: [{ id: "back-reception", text: "收好合影，回到前台", next: "reception" }],
  }),
  breakfastOffer: () => ({
    location: "旅馆前台", title: "早饭的邀请",
    paragraphs: ["前台小姐把一本菜单放在一旁，端来一只盖着盖子的盘子。", "“外面还在下雪。先吃些东西，再考虑赶路吧。”"],
    choices: [
      { id: "accept-breakfast", text: "接受她的好意", next: "breakfastPlate" },
      { id: "decline-breakfast", text: "谢绝，还是想继续赶路", next: "breakfastResult", apply: current => ({ ...current, breakfast: "declined" }) },
      { id: "back-reception", text: "先放下这个决定", next: "reception" },
    ],
  }),
  breakfastPlate: state => ({
    location: "旅馆餐桌", title: "盖子下面",
    paragraphs: ["盘中是几段煎得金黄的香肠，旁边放着面包。", "香气很浓，却有一种你说不上来的甜味。", ...(state.flags.nightKitchenSeen ? ["你想起昨夜厨房案板上的半只野猪。"] : []), ...(state.flags.foodExamined ? ["切口处的肉色偏深，闻起来也不像你熟悉的猪肉。"] : [])],
    choices: [
      { id: "inspect-food", text: "仔细看看香肠", next: "breakfastInspect", apply: current => ({ ...current, flags: { ...current.flags, foodExamined: true } }) },
      { id: "eat-breakfast", text: "把早餐吃下去", next: "breakfastResult", apply: current => ({ ...current, breakfast: "eaten", fusion: Math.min(6, current.fusion + 1) }) },
      { id: "pretend-breakfast", text: "假装吃了，悄悄放下餐具", next: "breakfastResult", apply: current => ({ ...current, breakfast: "pretended" }) },
    ],
  }),
  breakfastInspect: state => ({
    location: "旅馆餐桌", title: "不熟悉的肉香",
    paragraphs: ["你拨开香肠外层，肉色比想象中更深。", "那股甜味混在热气里，盖过了本该有的猪肉气味。", ...(state.flags.nightKitchenSeen ? ["昨夜那半只野猪就摆在案板上。现在盘里的肉，却让你无法把两者对上。"] : [])],
    choices: [{ id: "back-plate", text: "再看看盘子", next: "breakfastPlate" }, { id: "eat-breakfast", text: "还是把早餐吃下去", next: "breakfastResult", apply: current => ({ ...current, breakfast: "eaten", fusion: Math.min(6, current.fusion + 1) }) }, { id: "pretend-breakfast", text: "假装吃了", next: "breakfastResult", apply: current => ({ ...current, breakfast: "pretended" }) }],
  }),
  breakfastResult: state => ({
    location: "旅馆餐桌", title: state.breakfast === "eaten" ? "留在胃里的暖意" : "没动的早餐",
    paragraphs: state.breakfast === "eaten"
      ? ["热气沿着喉咙落下，赶路的疲惫缓了些。", ...(state.flags.nightKitchenSeen ? ["肉的纤维和味道更像你尝过的鹿肉，不像昨夜她在厨房处理的野猪。你又咬了一口，仍然如此。"] : []), "你忽然觉得旅馆里比刚才更暖。那张餐桌，像是你已经坐过许多次。", "前台小姐端着餐盘去了厨房。"]
      : state.breakfast === "pretended"
        ? ["你趁她转身，悄悄把餐具放好，做出已经吃过的样子。", "前台小姐没有追问，端着盘子往厨房去了。"]
        : ["你谢绝了早餐。她只说“路上小心”，随后端着盘子往厨房去了。", "大厅里只剩下你的脚步声。"],
    choices: [
      { id: "back-reception", text: "回到前台", next: "reception" },
      { id: "ground-hall", text: "沿一楼走廊看看", next: "groundHall" },
      { id: "go-outside", text: "到旅馆外看看", next: "entrance" },
    ],
  }),
  groundHall: state => ({
    location: "一楼 · 走廊", title: "画框排成的长廊",
    paragraphs: ["走廊两侧挂着一幅幅肖像画，画框上的灰尘很少。", state.time === "night" ? "厨房门下透出光，断续的剁切声从里面传来。" : "尽头有一道通往厨房的门，里面传来碗碟相碰的轻响。", "厨房旁是一扇较宽的旧双开门。门楣上还留着褪色的花饰。", ...(state.flags.neighborRoomSeen ? ["你记起隔壁房间地板下的声音，发现墙角还有一道向下的窄楼梯。"] : ["墙角另有一道向下的窄楼梯。越往下，光线越暗。"])],
    choices: [
      { id: "kitchen-threshold", text: state.time === "night" ? "推开亮着灯的厨房门" : "走到厨房门口", next: state.time === "night" ? "nightKitchen" : "kitchenThreshold", apply: current => current.time === "night" ? { ...current, flags: { ...current.flags, nightKitchenSeen: true } } : current },
      { id: "banquet-door", text: "查看厨房旁的旧双开门", next: "banquetDoor" },
      { id: "basement-door", text: "沿窄楼梯走向地下室", next: "basementDoor" },
      { id: "back-hallway", text: "从楼梯回到二楼走廊", next: "hallway", available: current => current.time === "night" && current.flags.checkedIn },
      { id: "back-reception", text: "回到前台", next: "reception" },
    ],
  }),
  nightKitchen: () => ({
    location: "一楼 · 夜间厨房", title: "案板上的野猪",
    paragraphs: ["半只剥了皮的野猪横在案板上。切下的肉被分成小块，一部分已经没入绞肉机。", "前台小姐正在制作香肠，袖口和围裙上沾着血。刀落下时，你在楼上听见的闷响又响了一次。", "厨房另一侧有一道通向旧双开门方向的窄门。"],
    choices: [
      { id: "greet-night-kitchen", text: "和她打声招呼", next: "nightKitchenTalk", apply: current => ({ ...current, flags: { ...current.flags, nightKitchenSpoken: true } }) },
      { id: "peek-banquet-door", text: "从侧门看看那扇旧双开门", next: "banquetDoor" },
      { id: "leave-night-kitchen", text: "不惊动她，退回走廊", next: "groundHall" },
    ],
  }),
  nightKitchenTalk: () => ({
    location: "一楼 · 夜间厨房", title: "明天的早饭",
    paragraphs: ["她回头看见你，停下刀，笑了笑。", "“我在准备明天的早饭。是不是吵到你了？”", "案板上的野猪还在，血顺着木纹停在绞肉机旁。"],
    choices: [
      { id: "ask-night-meat", text: "问她这半只野猪从哪里来", next: "nightKitchenMeat" },
      { id: "leave-night-kitchen", text: "说自己睡不着，回到走廊", next: "groundHall" },
    ],
  }),
  nightKitchenMeat: () => ({
    location: "一楼 · 夜间厨房", title: "雪前留下的肉",
    paragraphs: ["“雪下大以前送来的。”她把手上的血擦在围裙上，视线又落回案板。", "你没有在旅馆外见过猎人，也不知道这场雪是什么时候开始的。"],
    choices: [{ id: "leave-night-kitchen", text: "不再打扰她，退回走廊", next: "groundHall" }],
  }),
  kitchenThreshold: state => ({
    location: "一楼 · 厨房门口", title: "门缝里的声音",
    paragraphs: ["厨房里有人在收拾碗碟。你从门边看见案板和绞肉机，台面被仔细擦过，木纹深处却仍有暗色痕迹。", ...(state.flags.foodExamined ? ["那股肉香与你在餐桌前闻到的一样。"] : []), "里面的脚步声渐渐靠近。侧门通向旁边的旧宴会厅。"],
    choices: [{ id: "back-ground-hall", text: "退回一楼走廊", next: "groundHall" }, { id: "through-banquet-side", text: "沿侧门回到旧宴会厅", next: "banquetHall", available: current => current.flags.firstNightSlept }],
  }),
  banquetDoor: state => ({
    location: "一楼 · 旧双开门", title: "褪色的花饰",
    paragraphs: state.flags.firstNightSlept
      ? ["双开门上的花饰褪了色。门闩已经松开，门缝里只见一张蒙灰的长桌。", ...(state.flags.nightKitchenSeen ? ["你记得昨夜从厨房侧门也能看见这里。"] : [])]
      : ["双开门上的花饰褪了色，门把却推不动。你贴近门板，听见一声很轻的杯盏碰响。", "厨房的侧门也通向这边，门内的声音很快又停了。"],
    choices: [
      { id: "enter-banquet", text: "走进旧宴会厅", next: "banquetHall", available: current => current.flags.firstNightSlept },
      { id: "back-night-kitchen", text: "从侧门回到夜间厨房", next: "nightKitchen", available: current => current.time === "night" && !current.flags.firstNightSlept },
      { id: "back-ground-hall", text: "退回一楼走廊", next: "groundHall" },
    ],
  }),
  banquetHall: state => ({
    location: "一楼 · 旧宴会厅", title: "留在桌边的座位",
    paragraphs: ["厅里没有人。长桌和餐椅积着薄灰，几把椅子却被推向门口，地上留着较新的拖痕。", "一端的桌面有几圈深色杯印，厨房侧门就在不远处。", ...(hasItem(state, "oldLedger") ? ["你想起账本里为婚宴准备的啤酒、蛋糕与香肠。"] : []), ...(state.flags.weddingStoryHeard ? ["艾米莉说过，婚宴之后大家在这里住了一晚。"] : [])],
    choices: [
      { id: "inspect-banquet-table", text: "查看杯印和椅脚拖痕", next: "banquetTable", apply: current => ({ ...current, flags: { ...current.flags, banquetTableSeen: true } }) },
      { id: "listen-banquet", text: "停下来听一听", next: "banquetEcho", available: current => !!current.flags.banquetTableSeen, apply: current => ({ ...current, flags: { ...current.flags, banquetEchoHeard: true } }) },
      { id: "through-kitchen-side", text: "从侧门走到厨房门口", next: "kitchenThreshold" },
      { id: "back-banquet-door", text: "从双开门回到走廊", next: "banquetDoor" },
    ],
  }),
  banquetTable: state => ({
    location: "一楼 · 旧宴会厅", title: "通向门口的拖痕",
    paragraphs: ["椅脚下的木地板有两道浅痕，一直朝双开门延伸。别处落着灰，浅痕里却很干净。", "桌上的杯印已经渗进木头。仅凭这些，你不知道那晚是谁移动了椅子。", ...(hasItem(state, "oldLedger") ? ["账本记录了婚宴用的几桶啤酒，却没有记下客人离席的时间。"] : [])],
    choices: [{ id: "back-banquet", text: "回到长桌旁", next: "banquetHall" }],
  }),
  banquetEcho: () => ({
    location: "一楼 · 旧宴会厅", title: "杯盏之后",
    paragraphs: ["你站着没动，听见两只杯子轻轻碰在一起，随后是一段被椅脚声盖住的话。", "“……先把门打开。”", "声音停了。桌边仍然空着，通向门口的拖痕就在你脚下。"],
    choices: [{ id: "back-banquet", text: "再看一眼空厅", next: "banquetHall" }, { id: "back-banquet-door", text: "离开旧宴会厅", next: "banquetDoor" }],
  }),
  deskDrawer: () => ({
    location: "旅馆前台", title: "抽屉里的旧账本",
    paragraphs: ["上层抽屉没有上锁。里面放着一本旧账本，页角已被翻得发软。", "你把它收好。抽屉下方还有一扇锁着的小柜门。"],
    choices: [{ id: "back-reception", text: "关上抽屉，回到前台", next: "reception" }],
  }),
  basementDoor: state => ({
    location: "旅馆 · 地下室门前", title: state.flags.basementUnlocked ? "已经打开的门" : "地下室的锁",
    paragraphs: state.flags.basementUnlocked
      ? ["地下室的门仍然开着。螺旋楼梯消失在昏暗之中，一股潮湿的酒香从下方浮上来。"]
      : ["窄楼梯尽头是一扇厚重的门。门后很安静，锁孔却像被人反复使用过。", ...(hasItem(state, "silverKey") ? ["你摸到口袋里的银白色钥匙。"] : ["你试了试客房钥匙，锁舌纹丝不动。"])],
    choices: [
      { id: "unlock-basement", text: "用银白色钥匙开门", next: "basementStairs", available: current => !current.flags.basementUnlocked && hasItem(current, "silverKey"), apply: current => ({ ...current, flags: { ...current.flags, basementUnlocked: true } }) },
      { id: "enter-basement", text: "走下螺旋楼梯", next: "basementStairs", available: current => current.flags.basementUnlocked },
      { id: "back-ground-hall", text: "回到一楼走廊", next: "groundHall" },
    ],
  }),
  basementStairs: () => ({
    location: "旅馆 · 地下室", title: "潮湿的螺旋楼梯",
    paragraphs: ["你跨过门槛，顺着螺旋楼梯往下走，酒精的气息越来越浓。", "砌得整齐的石砖渐渐变成粗糙的石块，缝隙里伸出藤蔓。台阶上开始有积水。"],
    choices: [{ id: "descend", text: "继续走到台阶尽头", next: "basementShore" }, { id: "back-basement-door", text: "返回地下室门前", next: "basementDoor" }],
  }),
  basementShore: state => ({
    location: "旅馆 · 地下室深处", title: "没有酒桶的酒窖",
    paragraphs: ["台阶尽头没有酒桶，只有一片浅浅的水。水汽贴着石壁上升，空气中有淡淡的啤酒清香。", "你站在水边，能看到更深处有一段黑暗的通道。水面几乎不动。", ...(state.flags.neighborWaterDrank ? ["潮气钻进嘴里，那一点凉涩让你想起隔壁床头的水。这里又混着酒香，你不能确定两处水是否相同。"] : [])],
    choices: [{ id: "wade", text: "涉水走向黑暗的通道", next: "floodedPassage" }, { id: "back-basement-stairs", text: "沿台阶返回", next: "basementStairs" }],
  }),
  floodedPassage: state => ({
    location: "旅馆 · 地下室水道", title: "水流的方向",
    paragraphs: ["水没过脚踝，越往前越深。表面看似静止的水，正缓缓向一个方向汇聚。", "你用手里的灯照去，发现前面有一个圆形孔洞，水流从那里落入更深的黑暗。", ...(state.flags.doorplatesSeen ? ["支撑通道的石料让你想起村庄遗迹里那些残存的墙。"] : [])],
    choices: [{ id: "look-hole", text: "走近圆形孔洞", next: "drainHole" }, { id: "follow-wall", text: "不跳下去，沿墙继续寻找", next: "fleshCorridor", apply: current => ({ ...current, flags: { ...current.flags, basementTruthSeen: true } }) }, { id: "back-shore", text: "退回水边", next: "basementShore" }],
  }),
  drainHole: state => ({
    location: "旅馆 · 地下室水道", title: "圆形的洞口",
    paragraphs: ["洞口边缘被水磨得光滑。往下看，灯光照不到底。", "水流不断被卷进去，像有什么东西在下方缓慢地呼吸。", ...(state.flags.rescuedFromBasement ? ["你记得上一次落入水中时伸来的手，却不知道它还会不会出现。"] : [])],
    choices: [{ id: "jump", text: state.flags.rescuedFromBasement ? "再次跳入洞口" : "跳入洞口", next: "underwater" }, { id: "follow-wall", text: "沿墙找另一条路", next: "fleshCorridor", apply: current => ({ ...current, flags: { ...current.flags, basementTruthSeen: true } }) }, { id: "back-passage", text: "退回水道", next: "floodedPassage" }],
  }),
  fleshCorridor: state => ({
    location: "旅馆 · 地下室深处", title: "像墙又不像墙",
    paragraphs: ["石壁渐渐掺进木头的纹理。远处有一张仿佛摆着烤火鸡的桌子；走近了，那只是长成食物形状的粉色肉瘤。", "水里的酒香更浓了。墙上竟有一个像酒桶龙头的东西，旁边横着一根倒塌的石柱。", ...(state.flags.doorplatesSeen ? ["石柱的雕纹像是你在村庄遗迹见过的样式。"] : [])],
    choices: [
      { id: "inspect-pillar", text: "仔细看倒塌的石柱", next: "brokenPillar", apply: current => ({ ...current, flags: { ...current.flags, pillarExamined: true } }) },
      { id: "inspect-tap", text: "查看墙上的龙头", next: "wallTap", apply: current => ({ ...current, flags: { ...current.flags, tapExamined: true } }) },
      { id: "listen-wall", text: "停下，听墙里的声音", next: "wallVoice", apply: current => ({ ...current, flags: { ...current.flags, basementVoiceHeard: true } }) },
      { id: "back-passage", text: "沿水道返回", next: "floodedPassage" },
    ],
  }),
  brokenPillar: state => ({
    location: "旅馆 · 地下室深处", title: "倒下的石柱",
    paragraphs: ["柱面上有磨损的花纹，被一层潮湿的膜覆住。石头的轮廓却还清楚。", ...(state.flags.doorplatesSeen ? ["你想起遗迹里“爱德华与艾米莉之家”附近的石料。纹路和刻痕几乎一样。"] : ["这石料看起来很熟悉，像旅馆外那些废弃房屋的一部分。"])],
    choices: [{ id: "back-flesh", text: "回到水道深处", next: "fleshCorridor" }],
  }),
  wallTap: () => ({
    location: "旅馆 · 地下室深处", title: "墙上的龙头",
    paragraphs: ["龙头下滴着带有酒香的液体，滴落处泛起很慢的涟漪。", "你伸手扶住墙面，手掌下的纹理竟轻轻起伏了一下。"],
    choices: [{ id: "back-flesh", text: "离开龙头", next: "fleshCorridor" }],
  }),
  wallVoice: () => ({
    location: "旅馆 · 地下室深处", title: "墙后断续的声音",
    paragraphs: ["你避开滴水声，侧耳贴近混着木纹的石壁。几下轻微的敲击之后，话语从更深处挤出来。", "“……外面……雪停了吗？”", "你分不清声音是从墙里、楼上，还是沿着水道传来的。"],
    choices: [
      { id: "answer-wall-voice", text: "告诉它，外面还在下雪", next: "wallVoiceReply" },
      { id: "back-flesh", text: "不作声，退回通道", next: "fleshCorridor" },
    ],
  }),
  wallVoiceReply: () => ({
    location: "旅馆 · 地下室深处", title: "没有说完的话",
    paragraphs: ["你说雪还没有停。石壁下传来三下慢而轻的敲击。", "“还是……门……”后半句话被水声盖住。", "你再问是谁，墙里只剩滴水。"],
    choices: [{ id: "back-flesh", text: "记下声音，回到水道", next: "fleshCorridor" }],
  }),
  underwater: state => ({
    location: "地下室 · 水下", title: "灯光消失的地方",
    paragraphs: ["你跳入洞口。水猛地包住了你，手里的灯被冲走，头顶的圆洞转眼分辨不清。", "你奋力向上游，却只闻到越来越重的腥味。肺里最后一口气快要耗尽。", ...(state.flags.emilySawRing && !state.flags.rescuedFromBasement ? ["昏暗里，似乎有什么正在向你靠近。"] : [])],
    choices: [{ id: "seek-air", text: "挣扎着寻找出口", next: current => current.flags.emilySawRing && !current.flags.rescuedFromBasement ? "underwaterRescue" : "drownedEnding" }],
  }),
  underwaterRescue: () => ({
    location: "地下室 · 水下", title: "伸来的手",
    paragraphs: ["就在你快要失去意识时，一只手抓住你的手腕，把你拉离水流。", "你没能看清那是谁。冰冷的水声远了，眼前只剩黑暗。"],
    choices: [{ id: "wake", text: "睁开眼", next: "recoveryRoom", apply: current => ({ ...current, day: current.day + 1, time: "morning", fusion: Math.min(6, current.fusion + 2), flags: { ...current.flags, rescuedFromBasement: true } }) }],
  }),
  recoveryRoom: state => ({
    location: "二楼 · 客房", title: state.flags.choseToStay ? "熟悉的客房" : "像一场梦",
    paragraphs: state.flags.choseToStay
      ? ["你又回到客房。湿衣早已晾干，床头灯却仍在原来的位置亮着。", "你不需要看门上的号码，也知道这是自己的房间。"]
      : ["你在自己的床上醒来，头很沉。昨夜的水、黑暗和那只手都像一场噩梦。", "被单的一角仍然潮湿，袖口还有一股地下室的气味。", state.fusion >= 3 ? "房间的摆设已经熟悉得像是你自己的家。" : "窗外仍在下雪，旅馆却比从前更让你安心。"],
    choices: [
      { id: "stay-one-more-night", text: "把湿衣晾好，再住一晚", next: "lingeringNight", available: current => current.fusion >= 4 && !current.flags.choseToStay, apply: current => ({ ...current, day: current.day + 1, time: "morning", fusion: Math.min(6, current.fusion + 1), flags: { ...current.flags, choseToStay: true } }) },
      { id: "go-reception", text: "下楼回到前台", next: "reception" },
      { id: "go-outside", text: "到旅馆外透口气", next: "entrance" },
      { id: "investigate", text: "再去二楼走廊看看", next: "hallway" },
    ],
  }),
  lingeringNight: () => ({
    location: "二楼 · 客房", title: "再留一夜",
    paragraphs: ["你把湿衣晾在床边。到傍晚时，衣角仍带着潮气。", "窗外的雪遮住了远处的路。你躺回床上，楼下有人走动，却没再分辨那是谁。", "一夜过去。醒来时，你知道从这里走到柜台需要转过几个弯。"],
    choices: [{ id: "wake-after-stay", text: "沿熟悉的路下楼", next: "reception" }],
  }),
  drownedEnding: () => ({
    location: "地下室 · 水下", title: "再也没有浮上来",
    paragraphs: ["你伸手摸索，却碰不到石壁，也找不到来时的洞口。", "水声渐渐远了。旅馆的灯光再没有出现。"],
    choices: [],
    ending: "结局 · 水下的寂静",
  }),
  confrontationOpening: state => ({
    location: "旅馆前台", title: "她知道你去了下面",
    paragraphs: ["你提起地下室里像肉一样的墙，还有那股不散的酒香。", ...(state.flags.pillarExamined ? ["你又说起那根与旧村庄相似的石柱。"] : []), ...(state.flags.basementVoiceHeard ? ["你还听见墙后断续的人声，却不知道那是谁。"] : []), "前台小姐的手停在登记簿上。“你去了下面？”"],
    choices: [{ id: "press-emily", text: "问她那究竟是谁的房子", next: "emilyAnswer", apply: current => ({ ...current, flags: { ...current.flags, emilyAdmittedHouse: true } }) }, { id: "back-reception", text: "暂时不再追问", next: "reception" }],
  }),
  emilyAnswer: () => ({
    location: "旅馆前台", title: "以前不是它的",
    paragraphs: ["她沉默了很久。", "“那不是我们的房子。”她说完，又改口：“至少……以前不是它的。”", "你看向她身后的旅馆墙壁。木头深处传来一声很轻的响动。"],
    choices: [{ id: "continue-truth", text: "继续问她过去发生了什么", next: "truthHub" }, { id: "back-reception", text: "把疑问暂时收起来", next: "reception" }],
  }),
  truthHub: state => ({
    location: "旅馆前台", title: "她终于没有回避",
    paragraphs: [
      "前台小姐把手从登记簿上移开。她没有请你坐下，也没有催你回房。",
      state.flags.weddingStoryHeard ? "婚礼当夜的雪，似乎还在窗外落着。" : "“你可以问。”她说，“我不一定都记得。”",
      ...(state.fusion >= 4 ? ["柜台后的地方莫名让你觉得熟悉，像是已经在这里站过许多年。"] : []),
    ],
    choices: [
      { id: "ask-wedding", text: "问旧村庄的人后来怎样了", next: "weddingMemory" },
      { id: "ask-edward", text: "问爱德华如今在哪里", next: "edwardAnswer", available: current => current.flags.weddingStoryHeard || current.flags.doorplatesSeen },
      { id: "ask-identity", text: "问她还记得自己是谁吗", next: "identityAnswer" },
      { id: "ask-kitchen", text: "问昨夜野猪和早餐为何对不上", next: "kitchenQuestion", available: current => !!current.flags.nightKitchenSeen && (current.breakfast === "eaten" || current.flags.foodExamined) },
      { id: "ask-banquet", text: "问宴会厅里通向门口的拖痕", next: "banquetQuestion", available: current => !!current.flags.banquetTableSeen },
      { id: "ask-inn", text: "问旅馆究竟是什么", next: "innNature", available: current => current.flags.weddingStoryHeard, apply: current => ({ ...current, flags: { ...current.flags, innNatureHeard: true } }) },
      { id: "ask-leave", text: "问自己怎样才能离开", next: "checkoutHint", available: current => current.flags.innNatureHeard, apply: current => ({ ...current, flags: { ...current.flags, checkoutHintSeen: true } }) },
      { id: "back-reception", text: "暂时结束谈话", next: "reception" },
    ],
  }),
  kitchenQuestion: state => ({
    location: "旅馆前台", title: "昨夜与今晨",
    paragraphs: ["你说起昨夜厨房里的半只野猪，又说早餐香肠的肉色。", ...(state.breakfast === "eaten" ? ["“我吃过。味道更像鹿肉。”"] : ["“我拨开看过，和案板上的肉不同。”"]), "艾米莉看向厨房门：“我昨晚做的就是香肠。”", "你问她用的究竟是什么肉。她张了张口，最后只是说：“你昨夜真的来过？”"],
    choices: [{ id: "back-dialogue", text: "把这句话记下，继续问", next: "truthHub" }],
  }),
  banquetQuestion: state => ({
    location: "旅馆前台", title: "椅脚留下的痕迹",
    paragraphs: ["你说起旧宴会厅里朝门口延伸的椅脚拖痕。", ...(state.flags.banquetEchoHeard ? ["你还提起那句没听清是谁说的“先把门打开”。"] : []), "“我记得大家坐到很晚。”艾米莉说。她想了想，又说：“那把椅子是谁挪的，我不记得了。”", "她没有否认你看到的痕迹，也没有看向宴会厅。"],
    choices: [{ id: "back-dialogue", text: "继续问她别的事", next: "truthHub" }],
  }),
  weddingMemory: state => ({
    location: "旅馆前台", title: "婚礼那天",
    paragraphs: [
      ...(hasItem(state, "oldLedger") ? ["你翻开旧账本，指给她看婚庆那页的蛋糕、猪肉香肠和啤酒。她看了一眼，像是闻到了那个夜晚厨房里的味道。"] : ["你问旧村庄的人后来去了哪里。她望向厨房：“我和爱德华结婚那天，大家都在这里。”"]),
      "“山姆喝多了，劳埃德把酒洒在桌布上。爱德华嫌蛋糕太甜，可最后还是吃了两块。”",
      "她说这些名字时很自然，仿佛他们只是刚刚离开餐桌。她轻轻笑了一下：“那大概是我这一辈子最开心的一天。”",
    ],
    choices: [{ id: "what-after-wedding", text: "后来发生了什么？", next: "snowNight" }, { id: "back-dialogue", text: "先问别的事", next: "truthHub" }],
  }),
  snowNight: () => ({
    location: "旅馆前台", title: "那场一直没停的雪",
    paragraphs: ["“后来雪越来越大。大家说，反正这里有的是房间，不如住一晚再走。”", "“第二天呢？”她没有回答。你又问了一遍。", "“我们没有离开。”"],
    choices: [{ id: "ask-why-stay", text: "问她为什么没走", next: "whyTheyStayed", apply: current => ({ ...current, flags: { ...current.flags, weddingStoryHeard: true } }) }, { id: "back-dialogue", text: "先问别的事", next: "truthHub" }],
  }),
  whyTheyStayed: () => ({
    location: "旅馆前台", title: "留下来的人",
    paragraphs: ["“一开始是雪。”", "“后来呢？”", "“后来……有人不想回去了。”她望着柜台上的木纹，“我不知道从哪一天起，我们都把这里当成了家。”"],
    choices: [{ id: "back-dialogue", text: "继续问她", next: "truthHub" }, { id: "back-reception", text: "暂时结束谈话", next: "reception" }],
  }),
  edwardAnswer: state => ({
    location: "旅馆前台", title: "他就在这里",
    paragraphs: [
      ...(hasItem(state, "ring") ? ["你把戒指放到柜台上，给她看内侧的名字。她的手指动了一下，却没有碰它。"] : state.ringDroppedOnDay !== null && hasItem(state, "silverKey") ? ["你说起投入井中的戒指，还有第二天从木桶里得到的银白色钥匙。她看着那把钥匙，很久没说话。"] : hasItem(state, "adultPhoto") ? ["你拿出锁柜里的合影，问起站在她身边的男人。"] : ["你问爱德华现在在哪里。她抬眼望了一眼楼上。"]),
      "“他就在这里。”",
      "楼上传来一声沉重的拖动。你问是哪间房，她摇头：“不是房间。”",
    ],
    choices: [{ id: "back-dialogue", text: "继续问她", next: "truthHub" }],
  }),
  identityAnswer: state => ({
    location: "旅馆前台", title: "她记得的事",
    paragraphs: [
      ...(state.flags.portraitSeen ? ["你说起旧屋里那幅标着 1682 年的全家福画像。她低声念出画背的名字：“艾米莉。”又说起小时候那间屋子的窗。"] : ["你问她还记不记得旅馆出现之前的家。“我叫艾米莉。”她说起小时候那间屋子的窗，仿佛那只是几年前的事。"]),
      "“我记得爱德华送我的戒指，也记得我们的婚礼。”她停了很久，“可是我不记得上一次离开这里是什么时候。”",
      "“有时候我在厨房，有时候在楼上。有时候，我以为自己一直站在这里。”",
    ],
    choices: [{ id: "ask-if-emily", text: "那你还是艾米莉吗？", next: "identityDoubt" }, { id: "back-dialogue", text: "继续问别的事", next: "truthHub" }],
  }),
  identityDoubt: () => ({
    location: "旅馆前台", title: "她是谁",
    paragraphs: ["“所以，你已经不是艾米莉了？”", "她看着自己的手，过了一会儿才问你：", "“如果我还记得她的一切，那我算不算她？”"],
    choices: [{ id: "back-dialogue", text: "继续问她", next: "truthHub" }],
  }),
  innNature: state => ({
    location: "旅馆前台", title: "房子与旅馆",
    paragraphs: [
      "“我不知道它是什么。我们谁都不知道。它来的时候，这里还没有旅馆。一夜之间，它就站在那里了。”",
      ...(state.flags.pillarExamined && state.flags.doorplatesSeen ? ["你提起旧村庄的门牌和地下室的石柱。她点点头：“那些原本是我们的屋子。现在，你也看见它们在哪里了。”"] : ["“后来，旧房子一间间不见了。我们还是能在这里找到它们的一些地方。”"]),
      "“后来我们怕它。大雪下起来的时候，我们又需要它。最后……”她环视大厅，“我分不清是谁需要谁。”",
    ],
    choices: [{ id: "ask-leave-now", text: "那我要怎么离开？", next: "checkoutHint", apply: current => ({ ...current, flags: { ...current.flags, checkoutHintSeen: true } }) }, { id: "back-dialogue", text: "继续问别的事", next: "truthHub" }],
  }),
  checkoutHint: () => ({
    location: "旅馆前台", title: "空着的日期",
    paragraphs: ["“所以没有人能离开？”你问。", "“我没有说过这个。”她回答。", "“那我要怎么走？”", "她没有指向门，只看了一眼柜台上摊开的登记簿。你的名字旁，退房日期仍然空着。"],
    choices: [{ id: "open-registry", text: "走到登记簿前", next: "registry", apply: current => ({ ...current, flags: { ...current.flags, registrySeen: true, ownEntrySeen: true } }) }, { id: "back-dialogue", text: "还有话想问", next: "truthHub" }],
  }),
  checkoutEnding: state => ({
    location: "旅馆外", title: "退房日期",
    paragraphs: [
      "你在自己的名字旁写下今天的日期。笔尖离开纸页时，脚下的木板深处传来一声闷响，像有什么东西松开了手。",
      "前台小姐望着那个日期，很久没有说话。最后，她向旁边让开一步，为你留出通往门口的路。",
      ...(state.fusion >= 3 ? ["你走过柜台时，仍能感到那股熟悉的暖意。但门已经开了。"] : []),
      "你推门走进雪里。前方的路没有绕回旅馆，也不再通向那片相同的树林。",
      "你回头时，门口还亮着灯。然后你继续向前走。",
    ],
    choices: [],
    ending: "结局 · 退房",
  }),
  rescueQuestion: () => ({
    location: "旅馆前台", title: "没人承认的救援",
    paragraphs: ["“是谁把我从水里拉出来的？”你问。", "前台小姐看了看你尚未干透的袖口，没有回答，只轻声说：“你醒来就好。”"],
    choices: [{ id: "back-reception", text: "回到大厅", next: "reception" }],
    previewEnd: "你还能回到地下室，沿墙寻找另一条路。",
  }),
  escape: state => ({
    location: "森林之外", title: "你确实离开了这片森林",
    paragraphs: [
      "你继续走，没有再向那盏灯靠近。旅馆的木框、招牌和窗在每次回望时都更旧一些，最后连灯也被雪遮住。",
      "脚下的道路渐渐开阔。等你再次回过头，身后只剩下树木，那间旅馆没有再出现。",
      state.time === "morning" ? "晨光落在前方的路上。你继续赶路。" : "风雪还在下。你把衣领拉紧，继续赶路。",
    ],
    choices: [],
    ending: "结局 · 一直向前",
  }),
};
