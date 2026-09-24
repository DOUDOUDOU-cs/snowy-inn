import { getScene } from "./game/engine";
import { knownClues } from "./game/state";
import type { GameState, ItemId } from "./game/types";
import { items } from "./story/items";
import { openRecordStore, startJourney, recordChoice, recordItemInspection, recordCordMove } from "./game/records";
import type { GameRecords, JourneyRecord } from "./game/records";
import { initialCordOrder, normalizeCordOrder } from "./game/cordPuzzle";
import { openDebrisPuzzle } from "./ui/debrisPuzzle";
import { openCordPuzzle } from "./ui/cordPuzzle";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("找不到游戏显示区域 #app。");
const app: HTMLElement = root;
const recordStore = openRecordStore(() => window.localStorage);
let records = recordStore.data;
let game: GameState | null = records.current?.state ?? null;
let feedback = "";

function commitRecords(next: GameRecords): void {
  if (next === records) return;
  records = next;
  game = records.current?.state ?? null;
  recordStore.save(records);
}
// 记录只随实际选择写入；标题、回看和物品页重绘不会增加剧情条目。
function startGame(): void { commitRecords(startJourney(records)); feedback = ""; renderStory(); }
function focusHeading(): void {
  if (recordStore.message) {
    const warning = document.createElement("p");
    warning.className = "save-warning";
    warning.setAttribute("role", "status");
    warning.textContent = recordStore.message;
    app.querySelector(".screen")!.prepend(warning);
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  app.querySelector<HTMLElement>("h1")!.focus({ preventScroll: true });
}
function textButton(text: string, action: () => void, className = "text-button"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}
function addParagraphs(target: HTMLElement, paragraphs: string[]): void {
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    target.append(paragraph);
  }
}

function renderTitle(): void {
  const canResume = game !== null && !getScene(game).ending;
  app.innerHTML = `
    <section class="title-screen screen" aria-labelledby="game-title">
      <p class="eyebrow">一八六〇年 · 冬</p>
      <h1 id="game-title" tabindex="-1">雪夜旅馆</h1>
      <p class="title-description">漫长的风雪里，<br>终于有一扇窗，还亮着灯。</p>
      <div class="title-actions"></div>
      <p class="edition">旅程自动保存在本机</p>
    </section>`;
  const actions = app.querySelector<HTMLElement>(".title-actions")!;
  actions.append(textButton(canResume ? "继续探索 →" : "开始游戏 →", canResume ? renderStory : startGame, "start-button"));
  if (canResume) actions.append(textButton("重新开始", renderRestartPrompt));
  if (game && !canResume) actions.append(textButton("查看本次结局", renderStory));
  if (records.current || records.archives.length) actions.append(textButton("旅程记录", () => renderRecordShelf(renderTitle)));
  focusHeading();
}

function renderRestartPrompt(): void {
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="restart-title">
      <p class="eyebrow">重新开始</p>
      <h1 id="restart-title" tabindex="-1">再走一次这条路？</h1>
      <div class="narrative"><p>当前旅程会收进历史记录，之后仍可回看。</p><p>新旅程将从头开始，之前的物品和选择不会带入。</p></div>
      <div class="choices"></div>
    </section>`;
  const buttons = app.querySelector<HTMLElement>(".choices")!;
  buttons.append(textButton("保留进度，返回标题", renderTitle, "choice-button"), textButton("确认重新开始", startGame, "choice-button"));
  focusHeading();
}

function renderStory(): void {
  if (!game) return renderTitle();
  const snapshot = game;
  const scene = getScene(snapshot);
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="scene-title">
      <nav class="story-nav" aria-label="游戏导航">
        <button class="text-button" id="back-title" type="button">← 返回标题</button>
        <span class="story-time"></span>
        <button class="text-button" id="inventory" type="button"></button>
        <button class="text-button" id="history" type="button">旅程记录</button>
      </nav>
      <p class="eyebrow scene-location"></p>
      <h1 id="scene-title" tabindex="-1"></h1>
      <div class="narrative"></div>
      <div class="choices" role="group" aria-label="选择下一步"></div>
    </section>`;
  app.querySelector<HTMLElement>(".story-time")!.textContent = snapshot.day === 1 && snapshot.time === "night"
    ? "雪夜"
    : `第 ${snapshot.day} 天 · ${snapshot.time === "night" ? "夜晚" : "清晨"}`;
  app.querySelector<HTMLElement>(".scene-location")!.textContent = scene.location;
  app.querySelector<HTMLElement>("h1")!.textContent = scene.title;
  const inventoryButton = app.querySelector<HTMLButtonElement>("#inventory")!;
  inventoryButton.textContent = "随身物品（" + snapshot.inventory.length + "）";
  inventoryButton.addEventListener("click", renderInventory);
  app.querySelector<HTMLButtonElement>("#back-title")!.addEventListener("click", renderTitle);
  app.querySelector<HTMLButtonElement>("#history")!.addEventListener("click", () => renderJourneyHistory(records.current!.id, undefined, renderStory));
  addParagraphs(app.querySelector<HTMLElement>(".narrative")!, scene.paragraphs);
  const ropeStages: Partial<Record<GameState["scene"], number>> = {
    ropeSlips: 0, ropeOnWindlass: 1, ropeWrapped: 2, ropeWoundOnce: 3, ropeWoundTwice: 4,
  };
  const ropeStage = ropeStages[snapshot.scene];
  if (ropeStage !== undefined) {
    const panel = document.createElement("div");
    panel.className = `rope-panel rope-stage-${ropeStage}`;
    panel.setAttribute("role", "img");
    panel.setAttribute("aria-label", ["井绳湿滑，木桶还在井底", "井绳已经搭在轱辘上", "绳头已缠在手上", "轱辘开始卷起井绳", "木桶已升到井沿下"][ropeStage]!);
    panel.innerHTML = '<div class="rope-wheel" aria-hidden="true"></div><div class="rope-line" aria-hidden="true"></div><div class="rope-bucket" aria-hidden="true"></div>';
    app.querySelector<HTMLElement>(".narrative")!.after(panel);
  }
  if (feedback) {
    const message = document.createElement("p");
    message.className = "item-feedback";
    message.setAttribute("role", "status");
    message.textContent = feedback;
    app.querySelector<HTMLElement>(".narrative")!.append(message);
    feedback = "";
  }
  const choices = app.querySelector<HTMLElement>(".choices")!;
  for (const choice of scene.choices) {
    const button = textButton("", () => {
      // 忽略来自旧画面的点击，避免同一次拾取被执行两遍。
      if (game !== snapshot) return;
      if (choice.id === "uncover-ring") {
        openDebrisPuzzle(button, () => {
          if (game !== snapshot) return;
          const uncovered = recordChoice(records, "uncover-ring");
          commitRecords(recordChoice(uncovered, "take-ring"));
          feedback = "已收好：戒指";
          renderStory();
        });
        return;
      }
      if (choice.id === "inspect-ropes") {
        const journeyId = records.current?.id;
        openCordPuzzle(normalizeCordOrder(snapshot.cordOrder), (from, to) => {
          if (records.current?.id !== journeyId || game?.scene !== "wardrobe") return { order: initialCordOrder };
          commitRecords(recordCordMove(records, from, to));
          return { order: normalizeCordOrder(game?.cordOrder), warning: recordStore.message || undefined };
        }, () => {
          if (records.current?.id !== journeyId || game?.scene !== "wardrobe") return renderStory();
          const untangled = recordChoice(records, "untangle-wardrobe");
          commitRecords(recordChoice(untangled, "take-bronze-key"));
          feedback = "已收好：古铜色钥匙";
          renderStory();
        }, renderStory);
        return;
      }
      button.disabled = true;
      commitRecords(recordChoice(records, choice.id));
      const added = game!.inventory.filter(item => !snapshot.inventory.includes(item));
      feedback = added.length ? "已收好：" + added.map(item => items[item].name).join("、")
        : hasLostRing(snapshot, game!) ? "戒指已留在井里。" : "";
      renderStory();
    }, "choice-button");
    const label = document.createElement("span");
    label.textContent = choice.text;
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    button.append(label, arrow);
    choices.append(button);
  }
  if (scene.previewEnd || scene.ending) {
    const note = document.createElement("aside");
    note.className = "preview-end";
    addParagraphs(note, [scene.previewEnd ?? scene.ending!]);
    if (scene.ending) note.append(textButton("重新踏上旅程 →", startGame));
    choices.append(note);
  }
  focusHeading();
}

function renderInventory(): void {
  if (!game) return renderTitle();
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="inventory-title">
      <nav class="story-nav"><button class="text-button" type="button">← 返回探索</button><span>随身记录</span></nav>
      <p class="eyebrow">旅途中留下的东西</p>
      <h1 id="inventory-title" tabindex="-1">随身物品</h1>
      <div class="item-list choices" role="group" aria-label="查看物品"></div>
      <section class="clue-list" aria-labelledby="clue-title"><h2 id="clue-title">记下的线索</h2><div></div></section>
    </section>`;
  app.querySelector<HTMLButtonElement>("nav button")!.addEventListener("click", renderStory);
  const list = app.querySelector<HTMLElement>(".item-list")!;
  if (game.inventory.length === 0) addParagraphs(list, ["还没有收集到物品。"]);
  for (const item of game.inventory) list.append(textButton(items[item].name + " →", () => renderItem(item), "choice-button"));
  const clues = knownClues(game);
  addParagraphs(app.querySelector<HTMLElement>(".clue-list div")!, clues.length ? clues : ["还没有记下线索。"]);
  focusHeading();
}

function renderItem(item: ItemId): void {
  if (!game || !game.inventory.includes(item)) return renderInventory();
  commitRecords(recordItemInspection(records, item));
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="item-title">
      <nav class="story-nav"><button class="text-button" type="button">← 返回随身物品</button><span>仔细查看</span></nav>
      <p class="eyebrow">随身物品</p>
      <h1 id="item-title" tabindex="-1"></h1>
      <div class="narrative"></div>
    </section>`;
  app.querySelector<HTMLButtonElement>("nav button")!.addEventListener("click", renderInventory);
  app.querySelector<HTMLElement>("h1")!.textContent = items[item].name;
  addParagraphs(app.querySelector<HTMLElement>(".narrative")!, items[item].description(game));
  focusHeading();
}

function recordLabel(record: JourneyRecord): string {
  const last = record.entries[record.entries.length - 1]!;
  return last.ending ?? (record.id === records.current?.id ? "正在探索" : "未完的旅程");
}

function renderRecordShelf(back: () => void): void {
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="history-title">
      <nav class="story-nav"><button class="text-button" type="button">← 返回</button><span>留在雪夜里的足迹</span></nav>
      <p class="eyebrow">历次旅程</p>
      <h1 id="history-title" tabindex="-1">旅程记录</h1>
      <p class="history-intro">每一次出发都留在这里。日记只记下重要的发现和决定，普通的来回走动不会反复出现。</p>
      <div class="record-list choices" role="group" aria-label="选择旅程"></div>
    </section>`;
  app.querySelector<HTMLButtonElement>("nav button")!.addEventListener("click", back);
  const list = app.querySelector<HTMLElement>(".record-list")!;
  const journeys: JourneyRecord[] = records.current ? [records.current, ...[...records.archives].reverse()] : [...records.archives].reverse();
  if (!journeys.length) addParagraphs(list, ["还没有留下旅程记录。"]);
  journeys.forEach(record => {
    const last = record.entries[record.entries.length - 1]!;
    const button = textButton("", () => renderJourneyHistory(record.id, undefined, () => renderRecordShelf(back), back), "choice-button record-button");
    const title = document.createElement("span");
    title.textContent = `${record.id === records.current?.id ? "本次旅程 · " : ""}${recordLabel(record)}`;
    const meta = document.createElement("small");
    meta.textContent = `${new Date(record.startedAt).toLocaleString("zh-CN")} 出发 · ${record.entries.length} 则日记`;
    const location = document.createElement("small");
    location.textContent = `最近记下「${last.title}」`;
    button.append(title, meta, location);
    list.append(button);
  });
  focusHeading();
}

function renderJourneyHistory(id: string, requestedPage: number | undefined, back: () => void, origin = back): void {
  const record = records.current?.id === id ? records.current : records.archives.find(journey => journey.id === id);
  if (!record) return renderRecordShelf(back);
  const pageSize = 20;
  const pages = Math.ceil(record.entries.length / pageSize);
  const page = Math.max(0, Math.min(pages - 1, requestedPage ?? pages - 1));
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="history-title">
      <nav class="story-nav"><button class="text-button history-back" type="button">← 返回</button><button class="text-button history-all" type="button">历次旅程</button></nav>
      <p class="eyebrow">写在雪夜里的事</p>
      <h1 id="history-title" tabindex="-1">旅途日记</h1>
      <p class="history-intro"></p>
      <nav class="history-pages" aria-label="历史记录翻页"></nav>
      <div class="diary-list"></div>
    </section>`;
  app.querySelector<HTMLButtonElement>(".history-back")!.addEventListener("click", back);
  app.querySelector<HTMLButtonElement>(".history-all")!.addEventListener("click", () => renderRecordShelf(origin));
  app.querySelector<HTMLElement>(".history-intro")!.textContent = `${recordLabel(record)} · ${record.entries.length} 则日记。这里只记重要的事，阅读不会改变当前进度。`;
  const paging = app.querySelector<HTMLElement>(".history-pages")!;
  const previous = textButton("← 较早的记录", () => renderJourneyHistory(id, page - 1, back, origin));
  previous.disabled = page === 0;
  const next = textButton("较新的记录 →", () => renderJourneyHistory(id, page + 1, back, origin));
  next.disabled = page === pages - 1;
  const position = document.createElement("span");
  position.textContent = `第 ${page + 1} / ${pages} 页`;
  paging.append(previous, position, next);
  const list = app.querySelector<HTMLElement>(".diary-list")!;
  let lastMoment = "";
  record.entries.slice(page * pageSize, (page + 1) * pageSize).forEach(entry => {
    const moment = `${entry.day}-${entry.time}`;
    if (moment !== lastMoment) {
      const date = document.createElement("h2");
      date.textContent = `第 ${entry.day} 天 · ${entry.time === "night" ? "夜晚" : "清晨"}`;
      list.append(date);
      lastMoment = moment;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = entry.text;
    list.append(paragraph);
    if (entry.ending) {
      const ending = document.createElement("p");
      ending.className = "diary-ending";
      ending.textContent = entry.ending;
      list.append(ending);
    }
  });
  focusHeading();
}

renderTitle();

function hasLostRing(before: GameState, after: GameState): boolean {
  return before.inventory.includes("ring") && !after.inventory.includes("ring");
}
