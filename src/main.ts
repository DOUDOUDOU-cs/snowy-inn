import { getScene } from "./game/engine";
import { knownClues } from "./game/state";
import type { GameState, ItemId } from "./game/types";
import { items } from "./story/items";
import { openRecordStore, startJourney, recordChoice, recordItemInspection, recordCordMove, saveManualSlot, loadManualSlot, replayCheckpoint } from "./game/records";
import type { GameRecords, JourneyRecord } from "./game/records";
import { initialCordOrder, normalizeCordOrder } from "./game/cordPuzzle";
import { openDebrisPuzzle } from "./ui/debrisPuzzle";
import { openCordPuzzle } from "./ui/cordPuzzle";
import { artForScene } from "./ui/sceneArt";
import { presentationForScene } from "./ui/scenePresentation";
import { createSceneStage } from "./ui/sceneStage";
import { narrationPages, createNarrationBookmark } from "./ui/sceneNarration";
import { wellPuzzleAction, wellPuzzleView } from "./game/wellPuzzle";
import { openWellPuzzle } from "./ui/wellPuzzle";
import "./ui/wellPuzzle.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("找不到游戏显示区域 #app。");
const app: HTMLElement = root;
const recordStore = openRecordStore(() => window.localStorage);
let records = recordStore.data;
let game: GameState | null = records.current?.state ?? null;
let feedback = "";
const scenery = document.querySelector<HTMLElement>(".scenery");
const shell = document.querySelector<HTMLElement>(".game-shell");
const sceneImage = scenery?.querySelector<HTMLImageElement>(".scene-art-image");
const sceneryCaption = scenery?.querySelector<HTMLElement>(".scene-caption-text");
const sceneViewButton = scenery?.querySelector<HTMLButtonElement>(".scene-view-button");
const targets = scenery?.querySelector<HTMLElement>(".scene-targets");
if (!shell || !scenery || !sceneImage || !targets) throw new Error("找不到场景舞台。");
const stage = createSceneStage({ shell, scenery, image: sceneImage, targets });
let viewEpoch = 0;
let lastPresentation: { space: string; mode: string; scene: GameState["scene"] } | null = null;
let pendingFocus: string | null = null;
let narrationController: AbortController | undefined;
const narrationBookmark = createNarrationBookmark();

function beginView(view: "story" | "system" | "title"): number {
  narrationController?.abort();
  narrationController = undefined;
  stage.cancel();
  viewEpoch += 1;
  shell!.dataset.view = view;
  document.querySelectorAll<HTMLDialogElement>(".scene-dialog, .narration-dialog, .well-dialog").forEach(dialog => { dialog.close(); dialog.remove(); });
  return viewEpoch;
}

function updateScenery(state: GameState | null): boolean {
  if (!scenery || !sceneImage) return false;
  const art = artForScene(state);
  const age = state?.scene === "escape" ? "gone" : String(art.age);
  const changed = sceneImage.getAttribute("src") !== art.src || scenery.dataset.age !== age;
  // 剧情图由舞台准备完毕后切换；系统/标题画面不推进剧情。
  if (shell?.dataset.view !== "story") {
    if (sceneImage.getAttribute("src") !== art.src) sceneImage.src = art.src;
    sceneImage.hidden = false;
    sceneImage.alt = art.alt;
    if (sceneViewButton) sceneViewButton.disabled = false;
  }
  scenery.dataset.age = age;
  if (shell) shell.dataset.tone = art.tone;
  if (sceneryCaption) sceneryCaption.textContent = state?.scene === "escape" ? "林路 · 灯光终于留在身后" : art.caption;
  return changed;
}

function showSceneArt(): void {
  if (!sceneImage || !sceneryCaption || !sceneViewButton) return;
  if (shell?.dataset.view === "story" && shell.dataset.phase !== "ready") return;
  stage.closeActions(false);
  const epoch = viewEpoch;
  const dialog = document.createElement("dialog");
  dialog.className = "scene-dialog";
  dialog.innerHTML = '<div class="scene-dialog-heading"><p></p><button type="button" aria-label="关闭场景图">×</button></div><img /><p class="scene-dialog-hint">这里可完整观察画面。关闭后，点击场景中的行动标记继续探索。</p>';
  dialog.querySelector<HTMLElement>(".scene-dialog-heading p")!.textContent = sceneryCaption.textContent;
  const image = dialog.querySelector<HTMLImageElement>("img")!;
  image.src = sceneImage.src;
  image.alt = sceneImage.alt;
  dialog.querySelector<HTMLButtonElement>("button")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { dialog.remove(); if (epoch === viewEpoch) sceneViewButton.focus(); }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>("button")!.focus();
}
sceneViewButton?.addEventListener("click", showSceneArt);

function commitRecords(next: GameRecords): void {
  if (next === records) return;
  records = next;
  game = records.current?.state ?? null;
  recordStore.save(records);
}
// 记录只随实际选择写入；标题、回看和物品页重绘不会增加剧情条目。
function startGame(): void { commitRecords(startJourney(records)); feedback = ""; lastPresentation = null; pendingFocus = null; renderStory(); }
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
  const epoch = viewEpoch;
  button.addEventListener("click", () => { if (epoch === viewEpoch && button.isConnected) action(); });
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
  beginView("title");
  updateScenery(null);
  const canResume = game !== null && !getScene(game).ending;
  app.innerHTML = `
    <section class="title-screen screen" aria-labelledby="game-title">
      <p class="eyebrow">一八六〇年 · 冬</p>
      <h1 id="game-title" tabindex="-1">雪夜旅馆</h1>
      <p class="title-description">漫长的风雪里，<br>终于有一扇窗，还亮着灯。</p>
      <div class="title-actions"></div>
      <p class="edition">自动保存 · 三个手动存档位 · 关键节点回溯</p>
    </section>`;
  const actions = app.querySelector<HTMLElement>(".title-actions")!;
  actions.append(textButton(canResume ? "继续探索 →" : "开始游戏 →", canResume ? renderStory : startGame, "start-button"));
  if (canResume) actions.append(textButton("重新开始", renderRestartPrompt));
  if (game && !canResume) actions.append(textButton("查看本次结局", renderStory));
  if (game || records.saves?.length) actions.append(textButton("存档与关键节点", () => renderSaveShelf(renderTitle)));
  if (records.current || records.archives.length) actions.append(textButton("旅程记录", () => renderRecordShelf(renderTitle)));
  focusHeading();
}

function renderRestartPrompt(): void {
  beginView("system");
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
  const epoch = beginView("story");
  const snapshot = game;
  updateScenery(snapshot);
  const scene = getScene(snapshot);
  const presentation = presentationForScene(snapshot, scene, artForScene(snapshot));
  const previous = lastPresentation;
  const transition = scene.ending ? "ending" : previous?.space !== presentation.space ? "move"
    : presentation.mode === "detail" && previous?.scene !== snapshot.scene ? "inspect"
    : previous?.mode === "detail" && presentation.mode !== "detail" ? "return" : "dialogue";
  lastPresentation = { space: presentation.space, mode: presentation.mode, scene: snapshot.scene };
  app.innerHTML = `
    <section class="story-screen screen scene-overlay" aria-labelledby="scene-title">
      <nav class="story-nav" aria-label="游戏导航">
        <button class="text-button" id="back-title" type="button">← 返回标题</button>
        <span class="story-time"></span>
        <button class="text-button" id="inventory" type="button"></button>
        <button class="text-button" id="save-slots" type="button">存档／回溯</button>
        <button class="text-button" id="history" type="button">旅程记录</button>
        <button class="text-button scene-reading-fallback" id="read-narration" type="button">阅读旁白</button>
      </nav>
      <div class="scene-reading">
        <div class="scene-reading-heading"><p class="eyebrow scene-location"></p><button class="text-button" id="toggle-narrative" type="button" aria-expanded="true" aria-controls="scene-narrative">收起旁白</button></div>
        <h1 id="scene-title" tabindex="-1"></h1>
        <div class="narrative" id="scene-narrative"></div>
        <nav class="narration-controls" aria-label="旁白阅读"></nav>
        <div class="ending-actions"></div>
      </div>
      <button class="scene-reveal-button" id="reveal-scene" type="button">立即显示</button>
    </section>`;
  const reading = app.querySelector<HTMLElement>(".scene-reading")!;
  const toggle = app.querySelector<HTMLButtonElement>("#toggle-narrative")!;
  toggle.addEventListener("click", () => {
    const collapsed = reading.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = collapsed ? "展开旁白" : "收起旁白";
    rememberReading("layout");
  });
  app.querySelector<HTMLButtonElement>("#reveal-scene")!.addEventListener("click", () => stage.revealNow());
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
  app.querySelector<HTMLButtonElement>("#save-slots")!.addEventListener("click", () => renderSaveShelf(renderStory));
  const spoken = [...scene.paragraphs];
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
  const transientFeedback = feedback;
  if (feedback) {
    const message = document.createElement("p");
    message.className = "item-feedback";
    message.setAttribute("role", "status");
    message.textContent = feedback;
    app.querySelector<HTMLElement>(".narration-controls")!.after(message);
    feedback = "";
  }
  const narrowReading = window.matchMedia("(max-width: 700px)");
  let pages = narrationPages(spoken, narrowReading.matches ? 60 : 90);
  const readingSource = { journeyId: records.current!.id, scene: snapshot.scene, paragraphs: spoken };
  const restoredReading = narrationBookmark.restore(readingSource, pages);
  narrationController = new AbortController();
  const narrative = app.querySelector<HTMLElement>(".narrative")!;
  const line = document.createElement("p");
  line.className = "narrative-line";
  line.setAttribute("aria-live", "polite");
  line.setAttribute("aria-atomic", "true");
  narrative.append(line);
  const controls = app.querySelector<HTMLElement>(".narration-controls")!;
  let page = restoredReading.page;
  if (restoredReading.collapsed) {
    reading.classList.add("is-collapsed");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "展开旁白";
  }
  function rememberReading(intent: "page" | "layout"): void {
    narrationBookmark.remember(readingSource, pages, page, reading.classList.contains("is-collapsed"), intent);
  }
  const previousLine = textButton("‹ 上一段", () => { page--; displayLine(); }, "narration-step");
  const nextLine = textButton("下一段 ›", () => { page++; displayLine(); }, "narration-step");
  const position = document.createElement("span");
  position.className = "narration-position";
  controls.append(previousLine, position, nextLine);
  let syncReader: (() => void) | undefined;
  function displayLine(intent: "page" | "layout" = "page"): void {
    if (epoch !== viewEpoch) return;
    page = Math.max(0, Math.min(Math.max(0, pages.length - 1), page));
    line.textContent = pages[page] ?? "";
    line.classList.remove("is-revealing");
    void line.offsetWidth;
    line.classList.add("is-revealing");
    previousLine.disabled = page === 0;
    nextLine.disabled = page >= pages.length - 1;
    position.textContent = `${page + 1} / ${Math.max(1, pages.length)}`;
    controls.hidden = pages.length <= 1;
    rememberReading(intent);
    syncReader?.();
  }
  displayLine("layout");
  const readerButton = app.querySelector<HTMLButtonElement>("#read-narration")!;
  if (transientFeedback) readerButton.textContent = `阅读旁白 · ${transientFeedback}`;
  readerButton.addEventListener("click", () => {
    if (epoch !== viewEpoch) return;
    if (shell!.querySelector(".narration-dialog")) return;
    stage.closeActions(false);
    const dialog = document.createElement("dialog");
    dialog.className = "narration-dialog";
    dialog.setAttribute("aria-label", "阅读当前旁白");
    const heading = document.createElement("div");
    heading.className = "narration-reader-heading";
    const title = document.createElement("h2");
    title.textContent = scene.title;
    const close = textButton("×", () => dialog.close());
    close.setAttribute("aria-label", "关闭阅读");
    heading.append(title, close);
    const text = document.createElement("p");
    text.className = "narration-reader-line";
    text.setAttribute("aria-live", "polite");
    const readerControls = document.createElement("nav");
    readerControls.className = "narration-reader-controls";
    readerControls.setAttribute("aria-label", "旁白阅读");
    const previousPage = textButton("上一段", () => { page--; displayLine(); });
    const nextPage = textButton("下一段", () => { page++; displayLine(); });
    const readerPosition = document.createElement("span");
    readerControls.append(previousPage, readerPosition, nextPage);
    function updateReader(): void {
      text.textContent = pages[page] ?? "";
      previousPage.disabled = page === 0;
      nextPage.disabled = page >= pages.length - 1;
      readerPosition.textContent = `${page + 1} / ${Math.max(1, pages.length)}`;
      readerControls.hidden = pages.length <= 1;
    }
    syncReader = updateReader;
    updateReader();
    // Move auxiliary content so existing ending/replay handlers remain intact.
    // It returns to the floating narration when this same view closes the reader.
    const auxiliary = [...reading.children].filter((child): child is HTMLElement => child instanceof HTMLElement
      && child.matches(".item-feedback, .rope-panel, .ending-actions"))
      .map(node => ({ node, next: node.nextSibling }));
    dialog.append(heading, text);
    for (const { node } of auxiliary) dialog.append(node);
    dialog.append(readerControls);
    dialog.addEventListener("close", () => {
      if (epoch === viewEpoch && reading.isConnected) {
        for (const { node, next } of [...auxiliary].reverse()) reading.insertBefore(node, next?.parentNode === reading ? next : null);
      }
      dialog.remove();
      if (syncReader === updateReader) syncReader = undefined;
      // Restoring content triggers the stage observer. Focus only after that
      // layout pass, so a newly hidden reading block cannot retain focus.
      queueMicrotask(() => {
        if (epoch !== viewEpoch || !reading.isConnected) return;
        if (shell!.dataset.narrationObstructed === "true") readerButton.focus({ preventScroll: true });
        else toggle.focus({ preventScroll: true });
      });
    }, { once: true });
    shell!.append(dialog);
    dialog.showModal();
    close.focus();
  });
  narrowReading.addEventListener("change", () => {
    if (epoch !== viewEpoch) return;
    pages = narrationPages(spoken, narrowReading.matches ? 60 : 90);
    page = narrationBookmark.restore(readingSource, pages).page;
    displayLine("layout");
  }, { signal: narrationController.signal });
  let acted = false;
  let puzzleOpen = false;
  const onChoose = (choiceId: string, button: HTMLButtonElement): void => {
      const choice = scene.choices.find(candidate => candidate.id === choiceId);
      // 校验视图和当前规则产物；视觉回调永不补写选择。
      if (!choice || acted || puzzleOpen || epoch !== viewEpoch || game !== snapshot || shell!.dataset.phase !== "ready") return;
      const currentWell = wellPuzzleView(snapshot);
      const resumesWell = currentWell && currentWell.stage !== 5
        && ["set-windlass", "wrap-rope", "turn-windlass", "lift-bucket"].includes(choice.id);
      if (choice.id === "pull-rope" || resumesWell) {
        puzzleOpen = true;
        // The first pull is the actual authored action. Merely reopening an
        // unfinished mechanism must not execute its next step automatically.
        if (choice.id === "pull-rope") commitRecords(recordChoice(records, choice.id));
        const initial = game && wellPuzzleView(game);
        if (!initial) { puzzleOpen = false; renderStory(); return; }
        const journeyId = records.current?.id;
        openWellPuzzle(initial, artForScene(game), interaction => {
          if (epoch !== viewEpoch || records.current?.id !== journeyId || !game || !wellPuzzleView(game)) return null;
          const before = game;
          const proposal = wellPuzzleAction(before, interaction);
          // The adapter only proposes a known choice; re-check against the
          // latest state before invoking the sole rule/save gate.
          if (proposal.choiceId && getScene(before).choices.some(candidate => candidate.id === proposal.choiceId)) {
            commitRecords(recordChoice(records, proposal.choiceId));
          }
          const view = wellPuzzleView(game!);
          if (!view) return null;
          if (!before.inventory.includes("silverKey") && game!.inventory.includes("silverKey")) feedback = "已收好：银白色钥匙";
          return { view, feedback: proposal.feedback, warning: recordStore.message || undefined };
        }, () => {
          if (epoch !== viewEpoch || records.current?.id !== journeyId) return;
          puzzleOpen = false;
          renderStory();
        }, recordStore.message || undefined);
        return;
      }
      if (choice.id === "uncover-ring") {
        puzzleOpen = true;
        openDebrisPuzzle(button, () => {
          if (epoch !== viewEpoch || game !== snapshot || acted) return;
          acted = true;
          const uncovered = recordChoice(records, "uncover-ring");
          commitRecords(recordChoice(uncovered, "take-ring"));
          feedback = "已收好：戒指";
          renderStory();
        });
        document.querySelector<HTMLDialogElement>(".puzzle-dialog")?.addEventListener("close", () => { puzzleOpen = false; }, { once: true });
        return;
      }
      if (choice.id === "inspect-ropes") {
        puzzleOpen = true;
        const journeyId = records.current?.id;
        openCordPuzzle(normalizeCordOrder(snapshot.cordOrder), (from, to) => {
          if (epoch !== viewEpoch || records.current?.id !== journeyId || game?.scene !== "wardrobe") return { order: initialCordOrder };
          commitRecords(recordCordMove(records, from, to));
          return { order: normalizeCordOrder(game?.cordOrder), warning: recordStore.message || undefined };
        }, () => {
          if (epoch !== viewEpoch || records.current?.id !== journeyId || game?.scene !== "wardrobe" || acted) return;
          acted = true;
          const untangled = recordChoice(records, "untangle-wardrobe");
          commitRecords(recordChoice(untangled, "take-bronze-key"));
          feedback = "已收好：古铜色钥匙";
          renderStory();
        }, () => { if (epoch === viewEpoch) renderStory(); });
        return;
      }
      acted = true;
      button.disabled = true;
      if (presentation.mode !== "detail" && scene.choices.some(candidate => candidate.id === choice.id)) {
        pendingFocus = presentation.groups.find(group => group.choices.some(candidate => candidate.id === choice.id))?.id ?? null;
      }
      commitRecords(recordChoice(records, choice.id));
      const added = game!.inventory.filter(item => !snapshot.inventory.includes(item));
      feedback = added.length ? "已收好：" + added.map(item => items[item].name).join("、")
        : hasLostRing(snapshot, game!) ? "戒指已留在井里。" : "";
      renderStory();
  };
  if (scene.previewEnd || scene.ending) {
    const note = document.createElement("aside");
    note.className = "preview-end";
    addParagraphs(note, [scene.previewEnd ?? scene.ending!]);
    if (scene.ending) {
      if (records.current?.checkpoints?.length) note.append(textButton("从关键节点重玩 →", () => renderCheckpointShelf(renderStory)));
      note.append(textButton("重新踏上旅程 →", startGame));
    }
    app.querySelector<HTMLElement>(".ending-actions")!.append(note);
  }
  // 持久化警告立即可见；旁白/行动就绪后才转移焦点。
  if (recordStore.message) {
    const warning = document.createElement("p");
    warning.className = "save-warning";
    warning.setAttribute("role", "status");
    warning.textContent = recordStore.message;
    app.querySelector(".story-nav")!.after(warning);
  }
  void stage.present({ art: artForScene(snapshot), groups: presentation.groups, transition, onChoose, onReady: () => {
    if (epoch !== viewEpoch) return;
    if (transition === "return" && pendingFocus) {
      const button = [...targets!.querySelectorAll<HTMLButtonElement>("[data-group]")].find(candidate => candidate.dataset.group === pendingFocus);
      if (button) { button.focus({ preventScroll: true }); pendingFocus = null; return; }
    }
    if (shell!.dataset.narrationObstructed === "true") readerButton.focus({ preventScroll: true });
    else app.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  } });
}

function renderInventory(): void {
  if (!game) return renderTitle();
  beginView("system");
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
  beginView("system");
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

function renderSaveShelf(back: () => void, notice = ""): void {
  beginView("system");
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="save-title">
      <nav class="story-nav"><button class="text-button" type="button">← 返回</button><span>留住一段路</span></nav>
      <p class="eyebrow">旅程进度</p>
      <h1 id="save-title" tabindex="-1">存档与回溯</h1>
      <p class="history-intro">每一步都会自动保存。三个手动存档位可保留不同进度；读取后，当前旅程会收进旅程记录。</p>
      <div class="save-list"></div>
      <div class="choices save-actions"></div>
    </section>`;
  app.querySelector<HTMLButtonElement>("nav button")!.addEventListener("click", back);
  if (notice) {
    const status = document.createElement("p");
    status.className = "item-feedback";
    status.setAttribute("role", "status");
    status.textContent = notice;
    app.querySelector<HTMLElement>(".history-intro")!.after(status);
  }
  const list = app.querySelector<HTMLElement>(".save-list")!;
  for (let slot = 1; slot <= 3; slot++) {
    const saved = records.saves?.find(item => item.slot === slot);
    const section = document.createElement("section");
    section.className = "save-slot";
    const heading = document.createElement("h2");
    heading.textContent = `存档位 ${slot}`;
    const details = document.createElement("p");
    details.textContent = saved
      ? `${saved.title} · ${new Date(saved.savedAt).toLocaleString("zh-CN")}`
      : "尚未保存";
    section.append(heading, details);
    if (saved) section.append(textButton("读取此存档 →", () => renderSaveConfirm(slot, "load", back), "choice-button"));
    if (game) section.append(textButton(saved ? "覆盖此存档 →" : "保存到此处 →", () => {
      if (saved) return renderSaveConfirm(slot, "overwrite", back);
      commitRecords(saveManualSlot(records, slot));
      renderSaveShelf(back, recordStore.message ? "" : `已保存到存档位 ${slot}。`);
    }, "choice-button"));
    list.append(section);
  }
  if (records.current?.checkpoints?.length) {
    app.querySelector<HTMLElement>(".save-actions")!.append(textButton("查看关键节点 →", () => renderCheckpointShelf(() => renderSaveShelf(back)), "choice-button"));
  }
  focusHeading();
}

function renderSaveConfirm(slot: number, action: "load" | "overwrite", back: () => void): void {
  const saved = records.saves?.find(item => item.slot === slot);
  if (!saved) return renderSaveShelf(back);
  beginView("system");
  const loading = action === "load";
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="confirm-title">
      <p class="eyebrow">存档位 ${slot}</p>
      <h1 id="confirm-title" tabindex="-1"></h1>
      <div class="narrative"></div>
      <div class="choices"></div>
    </section>`;
  app.querySelector<HTMLElement>("h1")!.textContent = loading ? "从这里继续？" : "覆盖这份存档？";
  addParagraphs(app.querySelector<HTMLElement>(".narrative")!, loading
    ? [`将读取「${saved.title}」。当前旅程会留在旅程记录中。`]
    : [`存档位 ${slot} 当前停在「${saved.title}」。覆盖后，这份手动存档将被当前进度替换。`]);
  const choices = app.querySelector<HTMLElement>(".choices")!;
  choices.append(textButton("返回存档列表", () => renderSaveShelf(back), "choice-button"));
  choices.append(textButton(loading ? "确认读取" : "确认覆盖", () => {
    commitRecords(loading ? loadManualSlot(records, slot) : saveManualSlot(records, slot));
    if (loading) { feedback = ""; renderStory(); }
    else renderSaveShelf(back, recordStore.message ? "" : `已覆盖存档位 ${slot}。`);
  }, "choice-button"));
  focusHeading();
}

function renderCheckpointShelf(back: () => void): void {
  beginView("system");
  const checkpoints = records.current?.checkpoints ?? [];
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="checkpoint-title">
      <nav class="story-nav"><button class="text-button" type="button">← 返回</button><span>从另一刻再走</span></nav>
      <p class="eyebrow">本次旅程</p>
      <h1 id="checkpoint-title" tabindex="-1">关键节点</h1>
      <p class="history-intro">选择一个已经走过的分岔口，重新做决定。当前旅程会留在旅程记录中；手动存档不会改变。</p>
      <div class="choices" role="group" aria-label="选择关键节点"></div>
    </section>`;
  app.querySelector<HTMLButtonElement>("nav button")!.addEventListener("click", back);
  const list = app.querySelector<HTMLElement>(".choices")!;
  if (!checkpoints.length) addParagraphs(list, ["还没有经过可以回溯的关键节点。"]);
  for (const point of checkpoints) {
    list.append(textButton(`${point.title} · 第 ${point.state.day} 天 →`, () => renderCheckpointConfirm(point.key, back), "choice-button"));
  }
  focusHeading();
}

function renderCheckpointConfirm(key: string, back: () => void): void {
  const point = records.current?.checkpoints?.find(item => item.key === key);
  if (!point) return renderCheckpointShelf(back);
  beginView("system");
  app.innerHTML = `
    <section class="story-screen screen" aria-labelledby="confirm-title">
      <p class="eyebrow">关键节点</p>
      <h1 id="confirm-title" tabindex="-1">回到这一刻？</h1>
      <div class="narrative"></div>
      <div class="choices"></div>
    </section>`;
  addParagraphs(app.querySelector<HTMLElement>(".narrative")!, [`将回到「${point.title}」，重新选择后面的路。当前旅程会留在旅程记录中。`]);
  const choices = app.querySelector<HTMLElement>(".choices")!;
  choices.append(textButton("返回关键节点", () => renderCheckpointShelf(back), "choice-button"));
  choices.append(textButton("确认回溯", () => {
    commitRecords(replayCheckpoint(records, key));
    feedback = "";
    renderStory();
  }, "choice-button"));
  focusHeading();
}

function recordLabel(record: JourneyRecord): string {
  const last = record.entries[record.entries.length - 1]!;
  return last.ending ?? (record.id === records.current?.id ? "正在探索" : "未完的旅程");
}

function renderRecordShelf(back: () => void): void {
  beginView("system");
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
  beginView("system");
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
