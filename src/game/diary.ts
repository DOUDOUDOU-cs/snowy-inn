import type { GameState, SceneId } from "./types.ts";

export interface DiaryEntry {
  key: string;
  day: number;
  time: GameState["time"];
  title: string;
  text: string;
  ending?: string;
}

export interface LegacyStep {
  scene: SceneId;
  day: number;
  time: GameState["time"];
  paragraphs: string[];
  choice?: { id: string; text: string };
  ending?: string;
}

type DiaryDraft = Pick<DiaryEntry, "key" | "title" | "text" | "ending">;

export const openingDiary = (state: Pick<GameState, "day" | "time">): DiaryEntry => ({
  key: "departure", day: state.day, time: state.time,
  title: "雪夜出发", text: "风雪里，我看见一间窗户亮着灯的旅馆。我在路边停下，决定接下来往哪里走。",
});

// 每个条目只记一次真正改变经历的发现或决定；普通往返不写入日记。
function draftForStep(choice: string, scene: SceneId, ownNameSeen = false): DiaryDraft | null {
  if (scene === "escape") return { key: "escape", title: "走出森林", text: "我没有走进那间旅馆。几次绕路后，它的木框和招牌在雪里一点点衰老；一直向前，身后的树木终于让出一条路。", ending: "结局 · 一直向前" };
  if (scene === "drownedEnding") return { key: "drowned", title: "水下", text: "我跳进水道深处。黑暗和冷水一点点盖过声音，最后没有人再把我拉起来。", ending: "结局 · 水下的寂静" };
  if (scene === "checkoutEnding") return { key: "checkout", title: "写下退房日期", text: "我在登记簿上写下今天的退房日期。前台小姐让开了路；这次推门走出去，路没有再绕回来。", ending: "结局 · 退房" };
  if (scene === "innkeeperEnding") return { key: "innkeeper", title: "新旅人", text: "我坐在柜台后。一个浑身是雪的旅人问还有没有空房，我抬起头，听见自己回答：“……当然。”", ending: "结局 · 前台" };
  if (choice === "walk" && scene === "ruins") return { key: "ruins", title: "林中的遗迹", text: "我一次次绕过那盏灯，最后在雪下撞见墓碑与坍塌的村屋。这里曾有人生活过。" };
  if (choice === "take-ring") return { key: "ring", title: "碎木里的戒指", text: "我在碎木屑里找到一枚戒指，把它收了起来。不知是谁把它留在这片遗迹中。" };
  if (choice === "house") return { key: "portrait", title: "旧画像", text: "我从半塌的小屋里带走一幅全家福画像。背面写着艾米莉，以及 1682 年。" };
  if (choice === "doorplates") return { key: "doorplates", title: "留下的名字", text: "我辨认出村屋的旧门牌，其中一块写着“爱德华与艾米莉之家”。" };
  if (choice === "enter") return { key: "entered", title: "推开旅馆的门", text: "我终于走进那间旅馆。前台小姐说还有空房，门内的暖意让外面的雪忽然显得很远。" };
  if (choice === "drop-ring") return { key: "ring-well", title: "井中的戒指", text: "我把戒指投进旅馆旁的水井。水面很快平静下来，井底却像藏着什么。" };
  if (choice === "lift-bucket" || (choice === "pull-rope" && scene === "silverKey")) return { key: "silver-key", title: "井里的银钥匙", text: "我把湿滑的井绳搭上轱辘、绕紧在手上，终于拉起木桶。桶里没有水，只有一把银白色钥匙。" };
  if (choice === "look-registry" || choice === "open-registry") return ownNameSeen
    ? { key: "my-registry", title: "我的名字", text: "登记簿里已经有了我的名字，入住日期清清楚楚，退房那一栏却依旧空着。" }
    : { key: "registry", title: "空白的退房栏", text: "我翻看登记簿。旧住客都有入住日期，退房日期却整列空白。" };
  if (choice === "finish-check-in") return { key: "checked-in", title: "入住", text: "我写下名字和日期，接过客房钥匙。笔落在纸上的时候，我又看了一眼那些空白的退房栏。" };
  if (choice === "look-hall-portrait") return { key: "hall-portrait", title: "灯下的肖像", text: "我看着前台后的肖像，稍稍移开一步，仍觉得画中人的目光落在身上。" };
  if (choice === "sleep") return { key: "first-night", title: "第一夜", text: "楼下的响动没有停。我用纸巾堵住耳朵，终于在旅馆里睡过了第一夜。" };
  if (choice === "inspect-neighbor-water") return { key: "neighbor-water", title: "隔壁床头的水", text: "隔壁客房里没有人，床头却放着半杯水。杯沿干净，水从何而来还不清楚。" };
  if (choice === "drink-neighbor-water") return { key: "neighbor-water-tasted", title: "凉水的味道", text: "我喝了一口隔壁床头的水。水凉而微涩，舌根留下很轻的铁味。" };
  if (choice === "kitchen-threshold" && scene === "nightKitchen") return { key: "night-kitchen", title: "夜里的厨房", text: "我循着声响来到厨房，看见前台小姐正在处理半只野猪，切下的肉正被做成明天的香肠。" };
  if (choice === "inspect-food") return { key: "food", title: "早餐的气味", text: "我拨开早餐的香肠。肉色与那股甜味都不像熟悉的猪肉。" };
  if (choice === "eat-breakfast") return { key: "breakfast", title: "吃下早餐", text: "我把早餐吃了下去。胃里暖起来时，竟觉得这张餐桌像是已经坐过许多次。" };
  if (choice === "pretend-breakfast") return { key: "breakfast", title: "没吃的早餐", text: "我假装吃过早餐，把餐具轻轻放好。前台小姐端走盘子，没有追问。" };
  if (choice === "decline-breakfast") return { key: "breakfast", title: "谢绝早餐", text: "我谢绝了她的早餐。她只说路上小心，然后端着盘子离开。" };
  if (choice === "search-wardrobe") return { key: "bronze-key", title: "衣柜里的钥匙", text: "隔壁房间空着。我打开衣柜，在靠里的木板上找到一把古铜色钥匙。" };
  if (choice === "take-bronze-key") return { key: "bronze-key", title: "衣柜里的钥匙", text: "隔壁衣柜里，二十根旧绳横穿圆框，挡着一把古铜色钥匙。我挪动圆周上的绳端，终于让圆内不再有绳线相交，将钥匙取了下来。" };
  if (choice === "search-desk") return { key: "old-ledger", title: "旧账本", text: "我趁前台无人翻开上层抽屉，拿到一本记录着旧日婚宴的账本。" };
  if (choice === "unlock-cabinet") return { key: "photo", title: "柜里的合影", text: "我用古铜色钥匙打开锁柜，从衣物下取出一张旧合影。背面提到一枚亲手做的戒指。" };
  if (choice === "inspect-banquet-table") return { key: "banquet-table", title: "宴会厅的拖痕", text: "旧宴会厅里空无一人。积灰的桌边，有几道较新的椅脚拖痕朝门口延伸。" };
  if (choice === "listen-banquet") return { key: "banquet-echo", title: "空厅里的话", text: "我在旧宴会厅听见杯盏相碰，还有一句没听出是谁说的“先把门打开”。回头时，桌边仍是空的。" };
  if (choice === "unlock-basement") return { key: "basement-key", title: "地下室的门", text: "井里得到的银白色钥匙，打开了通往旅馆地下室的门。" };
  if (choice === "follow-wall" && scene === "fleshCorridor") return { key: "basement-truth", title: "墙后的东西", text: "我没有跳进水洞，而是沿墙走下去。石头里混着木纹与肉，旅馆的墙似乎还在呼吸。" };
  if (choice === "inspect-pillar") return { key: "pillar", title: "倒塌的石柱", text: "地下室里的石柱让我想起村庄遗迹。那些旧房子，也许并没有真正离开这里。" };
  if (choice === "inspect-tap") return { key: "tap", title: "墙上的龙头", text: "我拧开墙上的龙头，流出的液体带着酒香；墙面在手边微微起伏。" };
  if (choice === "listen-wall") return { key: "wall-voice", title: "墙后的声音", text: "地下室墙后有断续的人声，问外面的雪停了没有。我不知道那是谁，也说不清声音从哪里来。" };
  if (scene === "underwaterRescue") return { key: "rescued", title: "水下的手", text: "我在水下快要失去意识时，被一只手拉住。没看清那是谁，水声已经离我远去。" };
  if (choice === "stay-one-more-night") return { key: "stayed", title: "又住一晚", text: "我把湿衣晾在床边，又留了一夜。清晨醒来时，去前台的路已经熟悉得不像初来时。" };
  if (choice === "continue-truth") return { key: "emily-house", title: "她的旧家", text: "我追问地下室。艾米莉承认那里与他们过去的家有关，却说它以前不是这个样子。" };
  if (choice === "ask-kitchen") return { key: "kitchen-question", title: "对不上的早餐", text: "我问艾米莉昨夜的野猪为何与早餐对不上。她说自己做的就是香肠，反问我昨夜是否真的去过厨房。" };
  if (choice === "ask-banquet") return { key: "banquet-question", title: "她记不清的椅子", text: "我问起旧宴会厅通向门口的椅脚拖痕。艾米莉记得大家坐到很晚，却说不清谁移动过那把椅子。" };
  if (choice === "ask-why-stay") return { key: "wedding", title: "婚礼之后", text: "艾米莉告诉我，婚礼那晚风雪太大，大家留了下来。再问第二天，她说他们没有离开。" };
  if (choice === "ask-inn") return { key: "inn-nature", title: "旅馆的来历", text: "她说旅馆先出现在村庄旁，后来渐渐吞下旧房子。她也分不清是谁需要谁。" };
  if (choice === "ask-leave" || choice === "ask-leave-now") return { key: "checkout-hint", title: "离开的办法", text: "我问怎样离开。她没有指向门，只看向登记簿里我名字旁空白的退房日期。" };
  return null;
}

function withMoment(draft: DiaryDraft, day: number, time: GameState["time"]): DiaryEntry {
  return { ...draft, day, time };
}

export function diaryForChoice(before: GameState, choice: string, after: GameState): DiaryEntry | null {
  // 旧版记录在打开衣柜时就取得钥匙；新流程要等实际取下才记日记。
  if (choice === "search-wardrobe") return null;
  const draft = choice === "eat-breakfast" && before.flags.nightKitchenSeen
    ? { key: "breakfast", title: "吃下早餐", text: "我吃下香肠。口感更像鹿肉，与昨夜厨房案板上的野猪对不上；暖意却很快留在胃里。" } satisfies DiaryDraft
    : before.flags.enteredInn && before.forestSteps < 13 && after.forestSteps >= 13
    ? { key: "forest-closed", title: "绕回门前", text: "我又一次沿来路往外走，还是回到了旅馆的灯下。这条路已经试够了。", } satisfies DiaryDraft
    : draftForStep(choice, after.scene, after.flags.ownEntrySeen);
  return draft ? withMoment(draft, after.day, after.time) : null;
}

export function diaryForItem(before: GameState, after: GameState): DiaryEntry | null {
  if (!before.flags.ringInscriptionRead && after.flags.ringInscriptionRead) {
    return withMoment({ key: "ring-inscription", title: "戒指内侧", text: "我把戒指凑近旅馆的灯光，读到内侧刻着：艾米莉，I love you forever。" }, after.day, after.time);
  }
  return null;
}

// 第一版存档原本逐节点记录；升级时只抽取关键事件，旧局仍可回看。
export function condenseLegacy(steps: LegacyStep[]): DiaryEntry[] {
  const first = steps[0]!;
  const entries = [openingDiary(first)];
  for (let index = 1; index < steps.length; index++) {
    const previous = steps[index - 1]!;
    const current = steps[index]!;
    const choice = previous.choice?.id;
    if (!choice) continue;
    const ownNameSeen = current.paragraphs.some(text => text.includes("你的名字"));
    const draft = draftForStep(choice, current.scene, ownNameSeen);
    if (draft && !entries.some(entry => entry.key === draft.key)) entries.push(withMoment(draft, current.day, current.time));
  }
  return entries;
}
