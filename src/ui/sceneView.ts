import type { SceneArt } from "./sceneArt.ts";
import type { SceneActionGroup, SceneMode } from "./scenePresentation.ts";
import { hotspotLabel, layoutScene, type SceneLayout } from "./sceneLayout.ts";
import { narrationPages } from "./sceneNarration.ts";

export type SceneTransition = "move" | "inspect" | "dialogue" | "return" | "ending";

export type SceneKeyIntent = "close-menu" | "toggle-text" | "restore-text" | "next" | "prev" | "choose" | "none";

/**
 * Pure key decision. Hidden text is a viewing mode: only H (toggle) and Space/Enter (restore)
 * do anything, so invisible pager/options can never be advanced by keyboard.
 */
export function keyIntent(key: string, state: {
  hidden: boolean; hasMenu: boolean; onControl: boolean; optionIndex: number | null;
}): SceneKeyIntent {
  if (key === "Escape" && state.hasMenu) return "close-menu";
  if (key === "h" || key === "H") return "toggle-text";
  if (state.hidden) return key === " " || key === "Enter" ? "restore-text" : "none";
  if ((key === " " || key === "Enter") && !state.onControl) return "next";
  if (key === "ArrowRight" || key === "ArrowDown") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp") return "prev";
  if (state.optionIndex !== null) return "choose";
  return "none";
}

export interface ScenePresentOptions {
  art: SceneArt;
  mode: SceneMode;
  groups: SceneActionGroup[];
  transition: SceneTransition;
  title: string;
  paragraphs: readonly string[];
  /** Page to resume on (e.g. after looking at the inventory). */
  initialPage?: number;
  onPageChange?: (page: number, pages: readonly string[]) => void;
  /** Shown with the text from the start (item feedback, the rope diagram). */
  lead?: HTMLElement[];
  /** Revealed with the options once the narration has been read (endings). */
  tail?: HTMLElement[];
  onChoose: (choiceId: string, trigger: HTMLButtonElement) => void;
  onReady: () => void;
}

/** Resolves with the decoded image, or undefined on error, abort or timeout. */
export function prepareSceneImage(src: string, signal: AbortSignal,
  makeImage: () => HTMLImageElement = () => new Image(), timeoutMs = 8000): Promise<HTMLImageElement | undefined> {
  const candidate = makeImage();
  candidate.decoding = "async";
  return new Promise(resolve => {
    let settled = false;
    const finish = (ready?: HTMLImageElement) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      candidate.onload = null;
      candidate.onerror = null;
      resolve(ready);
    };
    const aborted = () => finish();
    const timer = setTimeout(() => finish(), timeoutMs);
    signal.addEventListener("abort", aborted, { once: true });
    candidate.onerror = () => finish();
    candidate.onload = () => { void candidate.decode().then(() => finish(candidate), () => finish()); };
    if (signal.aborted) return finish();
    candidate.src = src;
  });
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

export function createSceneView(elements: { shell: HTMLElement; frame: HTMLElement; image: HTMLImageElement; backdrop: HTMLImageElement }) {
  const { shell, frame, image, backdrop } = elements;
  const buffer = document.createElement("img");
  buffer.className = "scene-art-buffer";
  buffer.alt = "";
  buffer.setAttribute("aria-hidden", "true");
  buffer.hidden = true;
  image.after(buffer);
  const spots = document.createElement("div");
  spots.className = "scene-hotspots";
  const text = document.createElement("div");
  text.className = "scene-text";
  text.tabIndex = -1;
  frame.append(spots, text);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 700px)");

  let controller: AbortController | undefined;
  let current: ScenePresentOptions | undefined;
  let layout: SceneLayout | undefined;
  let menu: HTMLElement | undefined;
  let menuTrigger: HTMLButtonElement | undefined;
  let chosen = false;
  let lastPointer = "mouse";
  let page = 0;
  let pages: string[] = [];
  let optionButtons: HTMLButtonElement[] = [];
  let line: HTMLElement | undefined;
  let pager: HTMLElement | undefined;
  let tail: HTMLElement | undefined;

  function setStill(art: Pick<SceneArt, "src" | "alt">): void {
    if (image.getAttribute("src") !== art.src) image.src = art.src;
    image.alt = art.alt;
    image.hidden = false;
    backdrop.src = art.src;
  }

  function closeMenu(restoreFocus = false): void {
    menu?.remove();
    menu = undefined;
    menuTrigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus && menuTrigger?.isConnected) menuTrigger.focus({ preventScroll: true });
    menuTrigger = undefined;
  }

  function cancel(): void {
    controller?.abort();
    controller = undefined;
    current = undefined;
    layout = undefined;
    closeMenu();
    spots.replaceChildren();
    text.replaceChildren();
    frame.querySelectorAll(".scene-edges").forEach(edge => edge.remove());
    buffer.hidden = true;
    buffer.classList.remove("is-visible");
    optionButtons = [];
    line = pager = tail = undefined;
    spots.removeAttribute("inert");
    text.removeAttribute("inert");
    shell.querySelector<HTMLElement>(".scene-hud")?.removeAttribute("inert");
    delete shell.dataset.textHidden;
  }

  function choose(choiceId: string, trigger: HTMLButtonElement): void {
    if (chosen || !current || shell.dataset.phase !== "ready") return;
    chosen = true;
    closeMenu();
    const active = current;
    try { active.onChoose(choiceId, trigger); }
    // A puzzle may open and be dismissed without a new scene; allow choosing again then.
    finally { queueMicrotask(() => { if (current === active) chosen = false; }); }
  }

  function openMenu(group: SceneActionGroup, trigger: HTMLButtonElement, at: { x: number; y: number }): void {
    if (menuTrigger === trigger) return closeMenu(true);
    closeMenu();
    menuTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    menu = document.createElement("div");
    menu.className = "scene-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", group.label);
    const heading = document.createElement("p");
    heading.className = "scene-menu-heading";
    heading.textContent = group.label;
    menu.append(heading);
    for (const choice of group.choices) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "scene-menu-item";
      item.setAttribute("role", "menuitem");
      item.textContent = choice.text;
      item.addEventListener("click", () => choose(choice.id, trigger));
      menu.append(item);
    }
    menu.style.left = `${at.x}%`;
    menu.style.top = `${at.y}%`;
    menu.dataset.align = at.x < 22 ? "start" : at.x > 78 ? "end" : "center";
    menu.dataset.flip = at.y > 62 ? "up" : "down";
    frame.append(menu);
    menu.querySelector<HTMLButtonElement>(".scene-menu-item")?.focus({ preventScroll: true });
  }

  function activate(group: SceneActionGroup, trigger: HTMLButtonElement, at: { x: number; y: number }): void {
    // Touch has no hover preview, so a tap first shows what the object offers.
    if (group.choices.length === 1 && lastPointer !== "touch") choose(group.choices[0]!.id, trigger);
    else openMenu(group, trigger, at);
  }

  function renderHotspots(): void {
    for (const spot of layout!.hotspots) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.dataset.kind = spot.group.kind;
      button.dataset.group = spot.group.id;
      button.style.left = `${spot.x - spot.w / 2}%`;
      button.style.top = `${spot.y - spot.h / 2}%`;
      button.style.width = `${spot.w}%`;
      button.style.height = `${spot.h}%`;
      const label = document.createElement("span");
      label.className = "hotspot-label";
      label.textContent = hotspotLabel(spot.group);
      label.dataset.align = spot.x < 15 ? "start" : spot.x > 85 ? "end" : "center";
      label.dataset.place = spot.h >= 20 ? "center" : spot.y - spot.h / 2 < 12 ? "below" : "above";
      button.append(label);
      button.setAttribute("aria-label", hotspotLabel(spot.group));
      if (spot.group.choices.length > 1) button.setAttribute("aria-haspopup", "menu");
      button.addEventListener("click", () => activate(spot.group, button,
        { x: spot.x, y: spot.y > 62 ? spot.y - spot.h / 2 : spot.y + spot.h / 2 }));
      spots.append(button);
    }
    const sides = new Map<"left" | "right", HTMLElement>();
    for (const edge of layout!.edges) {
      let column = sides.get(edge.side);
      if (!column) {
        column = document.createElement("div");
        column.className = "scene-edges";
        column.dataset.side = edge.side;
        frame.append(column);
        sides.set(edge.side, column);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-edge";
      button.dataset.group = edge.group.id;
      const arrow = document.createElement("span");
      arrow.className = "scene-edge-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = edge.side === "left" ? "‹" : "›";
      const label = document.createElement("span");
      label.textContent = hotspotLabel(edge.group);
      if (edge.side === "left") button.append(arrow, label); else button.append(label, arrow);
      button.addEventListener("click", () => activate(edge.group, button, { x: edge.side === "left" ? 8 : 92, y: 50 }));
      column.append(button);
    }
  }

  function renderText(options: ScenePresentOptions): void {
    const title = document.createElement("p");
    title.className = "scene-text-title";
    title.textContent = options.title;
    line = document.createElement("p");
    line.className = "scene-text-line";
    line.setAttribute("aria-live", "polite");
    pager = document.createElement("div");
    pager.className = "scene-text-pager";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "scene-text-back";
    back.textContent = "‹";
    back.setAttribute("aria-label", "上一段");
    back.addEventListener("click", event => { event.stopPropagation(); turn(-1); });
    const count = document.createElement("span");
    const more = document.createElement("button");
    more.type = "button";
    more.className = "scene-text-more";
    more.textContent = "继续 ▾";
    more.addEventListener("click", event => { event.stopPropagation(); turn(1); });
    pager.append(back, count, more);
    text.append(title, ...(options.lead ?? []), line, pager);
    tail = document.createElement("div");
    tail.className = "scene-text-tail";
    if (layout!.options.length) {
      const list = document.createElement("ol");
      list.className = "scene-options";
      optionButtons = layout!.options.map(({ choice }, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scene-option";
        const key = document.createElement("span");
        key.className = "scene-option-key";
        key.textContent = String(index + 1);
        key.setAttribute("aria-hidden", "true");
        button.append(key, choice.text);
        button.addEventListener("click", event => { event.stopPropagation(); choose(choice.id, button); });
        item.append(button);
        list.append(item);
        return button;
      });
      tail.append(list);
    }
    tail.append(...(options.tail ?? []));
    text.append(tail);
    text.dataset.band = layout!.textBand;
    text.dataset.slide = layout!.textSlide;
  }

  function showPage(): void {
    if (!line || !pager || !tail || !current) return;
    page = Math.max(0, Math.min(pages.length - 1, page));
    line.textContent = pages[page] ?? "";
    line.classList.remove("is-entering");
    void line.offsetWidth;
    line.classList.add("is-entering");
    const last = page >= pages.length - 1;
    pager.hidden = pages.length <= 1;
    pager.querySelector<HTMLButtonElement>(".scene-text-back")!.disabled = page === 0;
    pager.querySelector<HTMLButtonElement>(".scene-text-more")!.hidden = last;
    pager.querySelector("span")!.textContent = `${page + 1} / ${pages.length}`;
    tail.hidden = !last;
    text.dataset.read = String(last);
    current.onPageChange?.(page, pages);
  }

  function turn(step: 1 | -1): boolean {
    if (!current || shell.dataset.phase !== "ready") return false;
    const next = page + step;
    if (next < 0 || next >= pages.length) return false;
    page = next;
    showPage();
    return true;
  }

  // Clicking empty picture, the narration, or the space around them moves the reading on.
  (frame.closest<HTMLElement>(".scenery") ?? frame).addEventListener("click", event => {
    if (!current || !(event.target instanceof Element) || event.target.closest("button, .scene-menu")) return;
    if (shell.dataset.textHidden) { restoreText(); return; }
    turn(1);
  });
  document.addEventListener("pointerdown", event => {
    lastPointer = event.pointerType || "mouse";
    if (menu && event.target instanceof Node && !menu.contains(event.target) && !menuTrigger?.contains(event.target)) closeMenu();
  }, { capture: true });
  document.addEventListener("keydown", event => {
    if (!current || shell.dataset.view !== "story" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    lastPointer = "keyboard";
    const onControl = event.target instanceof Element && Boolean(event.target.closest("button, a, input, textarea, select"));
    const index = Number(event.key) - 1;
    const optionIndex = Number.isInteger(index) && index >= 0 && optionButtons[index] && !tail?.hidden ? index : null;
    const intent = keyIntent(event.key, {
      hidden: Boolean(shell.dataset.textHidden), hasMenu: Boolean(menu), onControl, optionIndex,
    });
    if (intent === "none") return;
    event.preventDefault();
    if (intent === "close-menu") closeMenu(true);
    else if (intent === "toggle-text") toggleText();
    else if (intent === "restore-text") restoreText();
    else if (intent === "next") turn(1);
    else if (intent === "prev") turn(-1);
    else if (optionIndex !== null) optionButtons[optionIndex]!.click();
  });

  function setTextHidden(hidden: boolean): void {
    // inert blocks both pointer and Tab access; CSS mirrors the same state for older engines.
    // Picture controls are native buttons too, so they must join the hidden layer in the inert set.
    const controls = [text, spots, ...frame.querySelectorAll<HTMLElement>(".scene-edges")];
    const hud = shell.querySelector<HTMLElement>(".scene-hud");
    if (hud) controls.push(hud);
    for (const element of controls) {
      if (hidden) element.setAttribute("inert", ""); else element.removeAttribute("inert");
    }
    if (hidden) shell.dataset.textHidden = "true"; else delete shell.dataset.textHidden;
  }
  function hideText(): void {
    if (shell.dataset.textHidden) return;
    closeMenu();
    setTextHidden(true);
  }
  function restoreText(): void {
    if (!shell.dataset.textHidden) return;
    setTextHidden(false);
  }

  function toggleText(): void {
    if (shell.dataset.textHidden) restoreText(); else hideText();
  }

  async function present(options: ScenePresentOptions): Promise<void> {
    cancel();
    const active = new AbortController();
    controller = active;
    const signal = active.signal;
    current = options;
    chosen = false;
    shell.dataset.phase = "loading";
    shell.dataset.transition = options.transition;
    shell.dataset.mode = options.mode;
    layout = layoutScene(options.mode, options.groups);
    pages = narrationPages(options.paragraphs, narrow.matches ? 72 : 110);
    if (!pages.length) pages = [""];
    page = options.initialPage ?? 0;
    const sameImage = image.getAttribute("src") === options.art.src && image.complete && image.naturalWidth > 0;
    const prepared = sameImage ? image : await prepareSceneImage(options.art.src, signal);
    if (signal.aborted) return;
    if (prepared && !sameImage) {
      buffer.src = prepared.src;
      buffer.hidden = false;
      buffer.getBoundingClientRect();
      buffer.classList.add("is-visible");
      if (!reducedMotion.matches) await sleep(options.transition === "move" ? 420 : 240, signal);
      if (signal.aborted) return;
      image.src = options.art.src;
      buffer.hidden = true;
      buffer.classList.remove("is-visible");
    }
    image.alt = options.art.alt;
    image.hidden = !prepared;
    shell.dataset.picture = prepared ? "ready" : "missing";
    if (prepared) backdrop.src = options.art.src;
    renderHotspots();
    renderText(options);
    showPage();
    shell.dataset.phase = "ready";
    // A new place briefly shows what can be touched; afterwards only the cursor finds it.
    if (options.transition === "move" && layout.hotspots.length) {
      spots.classList.add("is-discovering");
      void sleep(1700, signal).then(() => spots.classList.remove("is-discovering"));
    }
    text.focus({ preventScroll: true });
    options.onReady();
  }

  return { present, cancel, closeMenu, setStill, toggleText };
}
