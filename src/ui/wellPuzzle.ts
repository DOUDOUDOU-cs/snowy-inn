import type { WellInteraction, WellPuzzleView } from "../game/wellPuzzle.ts";
import type { SceneArt } from "./sceneArt.ts";

interface WellResult { view: WellPuzzleView; feedback: string; warning?: string }

const parts: ReadonlyArray<{ id: WellInteraction; label: string; x: number; y: number; drawing: string }> = [
  { id: "rope", label: "试拉井绳", x: 35, y: 54, drawing: '<path d="M12 2v20M9 4l6 3M9 9l6 3M9 14l6 3M9 19l4 2"/>' },
  { id: "crank", label: "转动摇柄", x: 51, y: 46, drawing: '<circle cx="7" cy="6" r="3"/><path d="M7 9v9h11M18 15v6"/>' },
  { id: "groove", label: "木轴绳槽", x: 29, y: 32, drawing: '<path d="M3 7h18v10H3zM8 7v10M12 7v10M16 7v10M1 12h2m18 0h2"/>' },
  { id: "bucket", label: "井口 · 井下的桶", x: 39, y: 76, drawing: '<ellipse cx="12" cy="10" rx="9" ry="4"/><path d="M3 10v7c3 5 15 5 18 0v-7M7 14v6M17 14v6"/>' },
  // This names a place to hold the existing rope, not an additional pictured object.
  { id: "grip", label: "握稳绳头", x: 35, y: 64, drawing: '<path d="M12 2v20M9 5l6 2M9 17l6 2M5 9h9a2 2 0 0 1 0 4H8M5 9l-2 3 3 4h9"/>' },
];

const observations = [
  "湿绳没有找到支撑，木轴旁的绳槽空着。注意操作后哪一处仍在打滑。",
  "井绳虽已上槽，松出的绳头仍在往下滑。",
  "井绳已经绷紧。井下的木桶离井沿还有一段距离。",
  "木轴只卷起一段绳，桶里的碰撞声仍从井下传来。",
  "木桶已到井沿下，湿亮的提手就在伸手可及的地方。",
  "木桶已在井沿，钥匙也已收好。",
];

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string): HTMLButtonElement {
  const node = element("button", className, text);
  node.type = "button";
  return node;
}

/** Presentation only. The caller owns all story changes and persistence. */
export function openWellPuzzle(
  initial: WellPuzzleView,
  art: SceneArt,
  onInteract: (interaction: WellInteraction) => WellResult | null,
  onClose: () => void,
  initialWarning?: string,
): void {
  const previousFocus = document.activeElement;
  const dialog = element("dialog", "well-dialog");
  dialog.dataset.tone = art.tone;
  dialog.setAttribute("aria-labelledby", "well-puzzle-title");
  dialog.setAttribute("aria-describedby", "well-puzzle-description");

  const heading = element("header", "well-heading");
  const titles = element("div", "well-titles");
  const eyebrow = element("p", "well-eyebrow", "旅馆外 · 井边");
  const title = element("h2", "well-title");
  title.id = "well-puzzle-title";
  title.tabIndex = -1;
  titles.append(eyebrow, title);
  const close = button("well-close", "×");
  close.setAttribute("aria-label", "收起井边操作，返回探索");
  heading.append(titles, close);

  const figure = element("figure", "well-figure");
  const board = element("div", "well-board");
  const image = element("img", "well-art");
  image.src = art.src;
  image.alt = art.alt;
  image.width = 1536;
  image.height = 1024;
  image.decoding = "async";
  const imageFallback = element("p", "well-image-fallback", "井景暂时无法显示。下方的部件名称仍可操作，也可以切换到文字操作。");
  imageFallback.hidden = true;
  const controls = element("div", "well-parts");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "可以尝试的井边部件");
  const partButtons = parts.map(part => {
    const control = button("well-part", "");
    control.dataset.part = part.id;
    control.style.setProperty("--well-x", `${part.x}%`);
    control.style.setProperty("--well-y", `${part.y}%`);
    const icon = element("span", "well-part-icon");
    icon.setAttribute("aria-hidden", "true");
    // Only the fixed drawings above enter markup; all supplied text uses textContent.
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">${part.drawing}</svg>`;
    const label = element("span", "well-part-label", part.label);
    control.append(icon, label);
    control.addEventListener("click", () => interact(part.id));
    controls.append(control);
    // Small screens move the full labels below the image. These matching symbols
    // remain on the original objects and do not add another tab stop.
    const pin = element("span", "well-pin");
    pin.dataset.part = part.id;
    pin.setAttribute("aria-hidden", "true");
    pin.style.setProperty("--well-x", `${part.x}%`);
    pin.style.setProperty("--well-y", `${part.y}%`);
    pin.innerHTML = icon.innerHTML;
    board.append(pin);
    return { control, label, id: part.id };
  });
  board.prepend(image);
  figure.append(board, imageFallback, controls);

  const reading = element("section", "well-reading");
  const progress = element("p", "well-progress");
  const description = element("p", "well-description");
  description.id = "well-puzzle-description";
  const feedback = element("p", "well-feedback", "可以直接尝试图中的部件，留意它们的反应。");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.setAttribute("aria-atomic", "true");
  const warning = element("p", "well-warning", initialWarning ?? "");
  warning.setAttribute("role", "alert");
  warning.hidden = !initialWarning;
  reading.append(progress, description, feedback, warning);

  const footer = element("footer", "well-footer");
  const tools = element("div", "well-tools");
  const hintButton = button("well-tool well-hint-button", "观察提示");
  hintButton.setAttribute("aria-controls", "well-puzzle-hint");
  hintButton.setAttribute("aria-expanded", "false");
  const modeButton = button("well-tool well-mode-button", "文字操作");
  modeButton.setAttribute("aria-controls", "well-text-actions");
  modeButton.setAttribute("aria-expanded", "false");
  tools.append(hintButton, modeButton);
  const hint = element("p", "well-hint");
  hint.id = "well-puzzle-hint";
  hint.hidden = true;
  hint.setAttribute("role", "status");
  const textActions = element("div", "well-text-actions");
  textActions.id = "well-text-actions";
  textActions.hidden = true;
  const textChoice = button("well-text-choice", "");
  const textComplete = element("p", "well-text-complete", "钥匙已经收好，可以收起画面继续探索。");
  textActions.append(textChoice, textComplete);
  const footnote = element("p", "well-footnote", "随时可以返回。已完成的操作会保留；尝试没有次数或时间限制。");
  footer.append(tools, hint, textActions, footnote);
  dialog.append(heading, figure, reading, footer);

  let view = initial;
  let closed = false;
  let interacting = false;
  let hintLevel = 0;
  let textMode = false;

  function finish(): void {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose();
    // The caller may redraw the entire story. Only restore a still-existing
    // trigger if it did not already put focus in the new view.
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected
      && (!document.activeElement || document.activeElement === document.body)) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  function render(): void {
    dialog.dataset.stage = String(view.stage);
    title.textContent = view.title;
    description.textContent = view.description;
    progress.textContent = view.stage === 5 ? "木桶已提出 · 钥匙已收好"
      : view.stage === 4 ? "木桶已到井沿下"
      : view.stage === 3 ? "木桶正在上升"
      : view.stage === 2 ? "井绳已经绷紧"
      : view.stage === 1 ? "井绳已经上槽" : "木桶仍在井下";
    const bucket = partButtons.find(part => part.id === "bucket")!;
    bucket.label.textContent = view.stage < 4 ? "井口 · 井下的桶" : view.stage === 4 ? "井口 · 提起木桶" : "井沿 · 查看结果";
    hint.hidden = hintLevel === 0;
    hint.textContent = hintLevel === 0 ? "" : hintLevel === 1 ? observations[view.stage] : view.hint;
    hintButton.textContent = hintLevel === 0 ? "观察提示" : hintLevel === 1 ? "再看具体提示" : "收起提示";
    hintButton.setAttribute("aria-expanded", String(hintLevel > 0));
    figure.hidden = textMode;
    textActions.hidden = !textMode;
    modeButton.textContent = textMode ? "返回图面" : "文字操作";
    modeButton.setAttribute("aria-expanded", String(textMode));
    textChoice.hidden = !view.textAction;
    textChoice.textContent = view.textAction?.label ?? "";
    textComplete.hidden = Boolean(view.textAction);
  }

  function interact(part: WellInteraction): void {
    if (closed || interacting) return;
    interacting = true;
    try {
      const result = onInteract(part);
      if (closed) return; // A caller can synchronously close an obsolete dialog.
      if (!result) { finish(); return; }
      if (result.view.stage !== view.stage) hintLevel = 0;
      view = result.view;
      feedback.textContent = result.feedback;
      warning.textContent = result.warning ?? "";
      warning.hidden = !result.warning;
      render();
    } finally { interacting = false; }
  }

  hintButton.addEventListener("click", () => {
    if (closed) return;
    hintLevel = (hintLevel + 1) % 3;
    render();
  });
  modeButton.addEventListener("click", () => {
    if (closed) return;
    textMode = !textMode;
    render();
  });
  textChoice.addEventListener("click", () => {
    if (!closed && textMode && view.textAction) interact(view.textAction.interaction);
  });
  close.addEventListener("click", finish);
  dialog.addEventListener("cancel", event => { event.preventDefault(); finish(); });
  dialog.addEventListener("close", finish);
  image.addEventListener("error", () => {
    if (closed) return;
    figure.dataset.missing = "true";
    image.hidden = true;
    imageFallback.hidden = false;
  });
  document.body.append(dialog);
  render();
  dialog.showModal();
  title.focus({ preventScroll: true });
}
