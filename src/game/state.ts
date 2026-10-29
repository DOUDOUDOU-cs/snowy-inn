import type { GameState, ItemId } from "./types.ts";
import { initialCordOrder } from "./cordPuzzle.ts";

export function createGame(): GameState {
  return {
    scene: "arrival", day: 1, time: "night", forestSteps: 0,
    inventory: [], cordOrder: [...initialCordOrder], ringDroppedOnDay: null, fusion: 0, breakfast: "unresolved",
    flags: {
      ringFound: false, portraitSeen: false, doorplatesSeen: false,
      ruinsSeen: false, enteredInn: false, emilySawRing: false, ringInscriptionRead: false,
      registrySeen: false, checkedIn: false, ownEntrySeen: false,
      hallPortraitSeen: false, neighborRoomSeen: false, firstNightSlept: false,
      foodExamined: false, basementUnlocked: false, peacefulSleepUsed: false,
      basementTruthSeen: false, pillarExamined: false, tapExamined: false,
      rescuedFromBasement: false, choseToStay: false, emilyAdmittedHouse: false,
      weddingStoryHeard: false, innNatureHeard: false,
      checkoutHintSeen: false, checkedOut: false,
      neighborWaterSeen: false, neighborWaterDrank: false,
      nightKitchenSeen: false, nightKitchenSpoken: false,
      banquetTableSeen: false, banquetEchoHeard: false, basementVoiceHeard: false,
    },
  };
}

export function hasItem(state: GameState, item: ItemId): boolean {
  return state.inventory.includes(item);
}

export function addItem(state: GameState, item: ItemId): GameState {
  return hasItem(state, item) ? state : { ...state, inventory: [...state.inventory, item] };
}

export function knownClues(state: GameState): string[] {
  const clues: string[] = [];
  if (state.flags.portraitSeen) clues.push("全家福画像背面写着“艾米莉”，年份是 1682。");
  if (state.flags.doorplatesSeen) clues.push("遗迹中有“爱德华与艾米莉之家”的门牌。");
  if (state.flags.ringInscriptionRead) clues.push("戒指内侧刻着：艾米莉，I love you forever。");
  if (state.flags.registrySeen) clues.push("旅馆登记簿上，旧住客都有入住日期，退房栏却整列空着。");
  if (state.flags.ownEntrySeen) clues.push("登记簿上已经有了你的名字，你那一行的退房日期也是空白。");
  if (state.flags.hallPortraitSeen) clues.push("走廊里的肖像画保养得异常完好，目光仿佛跟着人移动。");
  if (state.flags.neighborRoomSeen) clues.push("隔壁房门虚掩，屋内空着；家具移动般的声音似乎来自更下方。");
  if (state.flags.neighborWaterSeen) clues.push(state.flags.neighborWaterDrank
    ? "隔壁空房床头有半杯水。入口时水凉而微涩，带着很轻的铁味；屋里始终没见到人。"
    : "隔壁空房床头有半杯水，杯沿干净，屋里始终没见到人。水是什么时候放在那里的，还不清楚。");
  if (state.flags.nightKitchenSeen) clues.push("第一夜，前台小姐在厨房处理半只野猪，案板和绞肉机旁都是要做香肠的肉。");
  if (state.flags.foodExamined) clues.push("早餐盘里是香肠，肉的颜色和气味有些陌生。");
  if (state.flags.nightKitchenSeen && state.breakfast === "eaten") clues.push("早餐香肠的口感像鹿肉，与你昨夜在厨房看见的野猪对不上。");
  if (state.flags.banquetTableSeen) clues.push("旧宴会厅的长桌积着灰，通往门口的椅脚拖痕却较新；席间曾发生什么仍无法确定。");
  if (state.flags.banquetEchoHeard) clues.push("旧宴会厅里响过杯盏和断续说话声，转身后桌边仍空无一人。");
  if (hasItem(state, "oldLedger")) clues.push("旧账本记载，厨房曾为一场婚庆准备蛋糕、猪肉香肠和啤酒。");
  if (hasItem(state, "adultPhoto")) clues.push(state.flags.portraitSeen
    ? "前台锁柜里的合影像是长大后的艾米莉与一位男人；背面写着男人送她一枚亲手做的戒指。"
    : "前台锁柜里的合影背面写着：一位男人送给画中的女子一枚亲手做的戒指。");
  if (state.flags.basementUnlocked) clues.push("井里得到的银白色钥匙打开了旅馆地下室的门。");
  if (state.flags.basementTruthSeen) clues.push("地下室深处的石壁混着木纹，甚至长出像食物形状的肉瘤。");
  if (state.flags.pillarExamined) clues.push(state.flags.doorplatesSeen
    ? "地下室倒塌石柱的纹路，与遗迹中爱德华和艾米莉之家附近的石料相似。"
    : "地下室倒塌的石柱与遗迹里的石料很相似。");
  if (state.flags.tapExamined) clues.push("地下室墙上的龙头流出有酒香的液体，后面的墙却像在微微起伏。");
  if (state.flags.basementVoiceHeard) clues.push("地下室的墙后传来断续的人声，问起外面的雪；声音的来处与身份都不清楚。");
  if (state.flags.rescuedFromBasement) clues.push("你在地下室水下失去意识后，被一只手拉起，醒在自己的客房。");
  if (state.flags.choseToStay) clues.push("明知地下室藏着异常，你仍在旅馆多住了一晚；去前台的路越来越熟悉。");
  if (state.flags.emilyAdmittedHouse) clues.push("前台小姐承认地下室与他们过去的家有关，却说“以前不是它的”。");
  if (state.flags.weddingStoryHeard) clues.push("前台小姐说婚礼当夜风雪加重，宾客们留在旅馆；后来有人不再想走。");
  if (state.flags.innNatureHeard) clues.push("前台小姐说旅馆先出现在村庄旁，后来渐渐吞下旧房子；她也分不清是谁需要谁。");
  if (state.flags.checkoutHintSeen) clues.push("问到离开的办法时，前台小姐看向了登记簿空白的退房日期。");
  return clues;
}
