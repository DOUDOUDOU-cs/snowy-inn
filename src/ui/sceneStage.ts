import type { SceneArt } from "./sceneArt.ts";
import type { SceneActionGroup } from "./scenePresentation.ts";
import { iconForGroup } from "./sceneIcons.ts";
import { placeNarration, type Rect } from "./narrationLayout.ts";

export type SceneTransition = "move" | "inspect" | "dialogue" | "return" | "ending";
export interface SceneStageOptions {
  art: SceneArt;
  groups: SceneActionGroup[];
  transition: SceneTransition;
  onChoose: (id: string, trigger: HTMLButtonElement) => void;
  onReady: () => void;
}

/** Future camera/video adapters must honour this cancellation and skip boundary. */
export interface SceneTransitionAdapter {
  play(reason: SceneTransition, signal: AbortSignal): Promise<void>;
  revealNow(): void;
  cancel(): void;
}

/** Markers name a location; only the opened menu exposes executable authored text. */
export function sceneActionLabel(group: SceneActionGroup): string {
  return group.label;
}

/** Pointer intent has one lifetime; cancelling also invalidates queued timer callbacks. */
export function createSceneHoverIntent(
  schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  unschedule: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let version = 0;
  const cancel = () => { version++; if (timer !== undefined) unschedule(timer); timer = undefined; };
  const later = (callback: () => void, ms: number) => {
    cancel();
    const active = version;
    timer = schedule(() => { if (active !== version) return; timer = undefined; callback(); }, ms);
  };
  return { approach: (callback: () => void) => later(callback, 120), leave: (callback: () => void) => later(callback, 300), stay: cancel, cancel };
}

interface SceneRect { left: number; top: number; width: number; height: number }
/** Expand from the marker itself, flipping horizontally when its right side is short. */
export function sceneMenuPosition(trigger: SceneRect, bounds: SceneRect,
  size: { width: number; height: number }): { left: number; top: number; width: number; height: number; direction: "right" | "left" } {
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(Math.max(low, high), value));
  const halfOrigin = Math.min(22, bounds.width / 2);
  const centerX = clamp(trigger.left + trigger.width / 2, bounds.left + halfOrigin, bounds.left + bounds.width - halfOrigin);
  const rightStart = centerX - halfOrigin;
  const leftEnd = centerX + halfOrigin;
  const rightAvailable = bounds.left + bounds.width - rightStart;
  const leftAvailable = leftEnd - bounds.left;
  const direction = size.width <= rightAvailable || rightAvailable >= leftAvailable ? "right" : "left";
  const width = Math.min(size.width, direction === "right" ? rightAvailable : leftAvailable);
  const height = Math.min(size.height, bounds.height);
  return {
    left: direction === "right" ? rightStart : leftEnd - width,
    top: clamp(trigger.top + trigger.height / 2 - height / 2, bounds.top, bounds.top + bounds.height - height),
    width, height, direction,
  };
}

/** Timing is independent of the DOM so abort/skip behaviour has direct coverage. */
export function createSceneTiming(reducedMotion: () => boolean) {
  let skip = false;
  let skipWait: (() => void) | undefined;
  return {
    reset() { skip = false; },
    revealNow() { skip = true; skipWait?.(); },
    wait(ms: number, signal: AbortSignal): Promise<void> {
      if (skip || reducedMotion() || signal.aborted) return Promise.resolve();
      return new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          if (skipWait === finish) skipWait = undefined;
          resolve();
        };
        const timer = setTimeout(finish, ms);
        skipWait = finish;
        signal.addEventListener("abort", finish, { once: true });
      });
    },
  };
}

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

export function createSceneStage(elements: {
  shell: HTMLElement;
  scenery: HTMLElement;
  image: HTMLImageElement;
  targets: HTMLElement;
}) {
  const { shell, scenery, image, targets } = elements;
  const environment = document.createElement("img");
  environment.className = "scene-environment";
  environment.alt = "";
  environment.setAttribute("aria-hidden", "true");
  environment.hidden = true;
  scenery.prepend(environment);
  function clearEnvironment(): void {
    environment.hidden = true;
    environment.removeAttribute("src");
  }
  function syncEnvironment(): void {
    if (image.hidden || !image.complete || !image.naturalWidth) return clearEnvironment();
    environment.src = image.src;
    environment.hidden = false;
  }
  // Titles can change the persistent image without calling present(). Wait for
  // that actual image to load rather than carrying a previous room behind it.
  image.addEventListener("load", () => { if (shell.dataset.view !== "story") syncEnvironment(); });
  image.addEventListener("error", clearEnvironment);
  new MutationObserver(() => {
    if (shell.dataset.view !== "story") {
      clearEnvironment();
      if (image.complete && image.naturalWidth) syncEnvironment();
    }
  }).observe(image, { attributes: true, attributeFilter: ["src", "hidden"] });
  syncEnvironment();
  const buffer = document.createElement("img");
  buffer.className = "scene-art-image scene-art-buffer";
  buffer.alt = "";
  buffer.setAttribute("aria-hidden", "true");
  buffer.hidden = true;
  image.after(buffer);
  const notice = document.createElement("p");
  notice.className = "scene-load-notice";
  notice.setAttribute("role", "status");
  notice.hidden = true;
  scenery.append(notice);
  const tray = document.createElement("div");
  tray.className = "scene-action-tray";
  tray.setAttribute("aria-label", "其他行动与方向");
  let epoch = 0;
  let controller: AbortController | undefined;
  let popup: HTMLElement | undefined;
  let popupTrigger: HTMLButtonElement | undefined;
  let suppressedHoverTrigger: HTMLButtonElement | undefined;
  let current: SceneStageOptions | undefined;
  let chosen = false;
  let anchors: { button: HTMLButtonElement; x: number; y: number }[] = [];
  let pictureBounds: Rect | undefined;
  let positionedReading: HTMLElement | undefined;
  let readingPosition: { left: number; top: number } | undefined;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timing = createSceneTiming(() => reducedMotion.matches);
  const hover = createSceneHoverIntent();
  const hoverPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  function closeActions(restoreFocus = true): void {
    hover.cancel();
    if (popup) resize.unobserve(popup);
    popup?.remove();
    popup = undefined;
    popupTrigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus && popupTrigger?.isConnected) popupTrigger.focus({ preventScroll: true });
    popupTrigger = undefined;
    layoutNarration();
  }

  function cancel(): void {
    epoch++;
    controller?.abort();
    controller = undefined;
    current = undefined;
    suppressedHoverTrigger = undefined;
    closeActions(false);
    targets.inert = true;
    targets.hidden = true;
    buffer.hidden = true;
    buffer.classList.remove("is-visible");
    notice.hidden = true;
    scenery.removeAttribute("aria-busy");
    positionedReading = undefined;
    readingPosition = undefined;
    shell.dataset.narrationObstructed = "false";
  }

  function revealNow(): void {
    timing.revealNow();
  }

  function wait(ms: number, signal: AbortSignal): Promise<void> {
    return timing.wait(ms, signal);
  }

  function placeTargets(): void {
    if (image.hidden) {
      pictureBounds = undefined;
      shell.dataset.picture = "missing";
      for (const edge of ["top", "bottom", "left", "right"]) shell.style.removeProperty(`--scene-picture-${edge}`);
      placeMenu();
      layoutNarration();
      return;
    }
    const rect = image.getBoundingClientRect();
    const host = scenery.getBoundingClientRect();
    const ratio = image.naturalWidth / image.naturalHeight;
    if (!Number.isFinite(ratio) || !rect.width || !rect.height) return;
    const width = Math.min(rect.width, rect.height * ratio);
    const height = width / ratio;
    const left = rect.left - host.left + (rect.width - width) / 2;
    const top = rect.top - host.top + (rect.height - height) / 2;
    shell.dataset.picture = "ready";
    const shellRect = shell.getBoundingClientRect();
    shell.style.setProperty("--scene-picture-top", `${host.top - shellRect.top + top}px`);
    shell.style.setProperty("--scene-picture-bottom", `${host.top - shellRect.top + top + height}px`);
    shell.style.setProperty("--scene-picture-left", `${host.left - shellRect.left + left}px`);
    shell.style.setProperty("--scene-picture-right", `${host.left - shellRect.left + left + width}px`);
    pictureBounds = { left: host.left - shellRect.left + left, top: host.top - shellRect.top + top, width, height };
    for (const target of anchors) {
      // Match the horizontal strip's 10px viewport inset so edge icons do not
      // jump four pixels when their 44px copied origin is revealed.
      const half = Math.min(target.button.offsetWidth / 2 + 10, width / 2);
      const px = Math.max(half, Math.min(width - half, width * target.x / 100));
      target.button.style.left = `${left + px}px`;
      target.button.style.top = `${top + height * target.y / 100}px`;
    }
    placeMenu();
    layoutNarration();
  }

  function layoutNarration(): void {
    const reading = shell.querySelector<HTMLElement>(".scene-reading");
    if (!reading || shell.dataset.view !== "story") return;
    if (reading !== positionedReading) {
      positionedReading = reading;
      readingPosition = undefined;
    }
    const host = shell.getBoundingClientRect();
    const viewport: Rect = { left: Math.max(0, -host.left) + 12, top: Math.max(0, -host.top) + 12,
      width: Math.max(1, Math.min(host.right, window.innerWidth) - Math.max(host.left, 0) - 24),
      height: Math.max(1, Math.min(host.bottom, window.innerHeight) - Math.max(host.top, 0) - 24) };
    const blockers: Rect[] = [];
    const reserve = (element: HTMLElement, padding = 8) => {
      const box = element.getBoundingClientRect();
      if (element.hidden || !box.width || !box.height) return;
      blockers.push({ left: box.left - host.left - padding, top: box.top - host.top - padding,
        width: box.width + padding * 2, height: box.height + padding * 2 });
    };
    if (!targets.hidden) {
      for (const marker of targets.querySelectorAll<HTMLElement>(".scene-target")) {
        if (marker.getAttribute("aria-expanded") === "true") continue;
        reserve(marker);
        const label = marker.querySelector<HTMLElement>(".scene-target-label");
        if (label) reserve(label, 4);
      }
    }
    if (popup?.isConnected) reserve(popup);
    for (const selector of [".story-nav", ".save-warning", ".scene-caption", ".scene-load-notice", ".scene-reveal-button"]) {
      for (const control of shell.querySelectorAll<HTMLElement>(selector)) reserve(control, 4);
    }
    // The app observer watches class mutations: do not rewrite this attribute
    // on every layout pass, or its own repositioning would keep retriggering it.
    if (!reading.classList.contains("is-positioned")) reading.classList.add("is-positioned");
    const plan = (bounds: Rect) => {
      const preferredWidth = bounds.width >= 600 ? bounds.width * .62 : bounds.width;
      reading.style.width = `${Math.max(1, Math.floor(Math.min(680, preferredWidth)))}px`;
      reading.style.maxHeight = `${Math.max(1, Math.floor(bounds.height))}px`;
      const box = reading.getBoundingClientRect();
      const position = placeNarration(bounds, { width: box.width, height: box.height }, blockers, readingPosition);
      return { ...position, bounds, clipped: reading.scrollHeight > reading.clientHeight + 1 };
    };
    const pictureLeft = Math.max(viewport.left, (pictureBounds?.left ?? viewport.left - 12) + 12);
    const pictureTop = Math.max(viewport.top, (pictureBounds?.top ?? viewport.top - 12) + 12);
    const pictureRight = Math.min(viewport.left + viewport.width, (pictureBounds ? pictureBounds.left + pictureBounds.width - 12 : viewport.left + viewport.width));
    const pictureBottom = Math.min(viewport.top + viewport.height, (pictureBounds ? pictureBounds.top + pictureBounds.height - 12 : viewport.top + viewport.height));
    const inPicture = pictureRight > pictureLeft && pictureBottom > pictureTop
      ? { left: pictureLeft, top: pictureTop, width: pictureRight - pictureLeft, height: pictureBottom - pictureTop } : viewport;
    let result = plan(inPicture);
    if (result.overlap > 0 || result.clipped) {
      const outside = plan(viewport);
      result = outside.overlap < result.overlap || (result.clipped && !outside.clipped) ? outside : plan(inPicture);
    }
    reading.style.left = `${result.left}px`;
    reading.style.top = `${result.top}px`;
    const obstructed = result.overlap > 0 || result.clipped;
    reading.dataset.obstructed = String(obstructed);
    shell.dataset.narrationObstructed = String(obstructed);
    readingPosition = { left: result.left, top: result.top };
  }
  const resize = new ResizeObserver(placeTargets);
  resize.observe(scenery);
  let observedReading: HTMLElement | null = null;
  let observedNav: HTMLElement | null = null;
  // Reading content is replaced by main without rebuilding the persistent scene.
  new MutationObserver(() => {
    const reading = shell.querySelector<HTMLElement>(".scene-reading");
    if (reading !== observedReading) {
      if (observedReading) resize.unobserve(observedReading);
      if (reading) resize.observe(reading);
      observedReading = reading;
    }
    const nav = shell.querySelector<HTMLElement>(".story-nav");
    if (nav !== observedNav) {
      if (observedNav) resize.unobserve(observedNav);
      if (nav) resize.observe(nav);
      observedNav = nav;
    }
    placeTargets();
  }).observe(shell.querySelector("#app") ?? shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  image.addEventListener("load", placeTargets);
  window.addEventListener("resize", placeTargets);

  function choose(id: string, trigger: HTMLButtonElement): void {
    if (chosen || shell.dataset.phase !== "ready" || shell.dataset.view !== "story") return;
    chosen = true;
    // Keep the trigger connected for existing puzzle focus restoration.
    closeActions(false);
    const frame = current;
    try { current?.onChoose(id, trigger); }
    finally { queueMicrotask(() => { if (current === frame) chosen = false; }); }
  }

  function placeMenu(): void {
    if (!popup || !popupTrigger?.isConnected) return;
    const host = shell.getBoundingClientRect();
    const bounds = {
      left: Math.max(host.left, 0) + 10,
      top: Math.max(host.top, 0) + 10,
      width: Math.max(1, Math.min(host.right, window.innerWidth) - Math.max(host.left, 0) - 20),
      height: Math.max(1, Math.min(host.bottom, window.innerHeight) - Math.max(host.top, 0) - 20),
    };
    const actions = popup.querySelector<HTMLElement>(".scene-context-actions");
    // Measure authored text at the maximum width, then let short actions shrink.
    // The two fixed ends are the 44px origin and the 44px close control.
    popup.style.width = `${Math.min(620, bounds.width)}px`;
    popup.style.maxHeight = `${bounds.height}px`;
    popup.style.bottom = "auto";
    popup.style.right = "auto";
    const trigger = (popupTrigger.querySelector<HTMLElement>(".scene-target-symbol") ?? popupTrigger).getBoundingClientRect();
    let textWidth = 0;
    const measuredChoices: { choice: HTMLElement; width: number }[] = [];
    for (const choice of actions?.querySelectorAll<HTMLElement>(".scene-context-choice") ?? []) {
      const previous = { width: choice.style.width, flex: choice.style.flex, maxWidth: choice.style.maxWidth, whiteSpace: choice.style.whiteSpace };
      choice.style.width = "max-content";
      choice.style.flex = "0 0 auto";
      choice.style.maxWidth = "none";
      choice.style.whiteSpace = "nowrap";
      // offsetWidth/scrollWidth round to whole pixels. Preserve the fractional
      // glyph width and a small safety margin before restoring the flex layout.
      const naturalWidth = Math.ceil(Math.max(choice.getBoundingClientRect().width, choice.offsetWidth, choice.scrollWidth)) + 2;
      textWidth += naturalWidth;
      measuredChoices.push({ choice, width: naturalWidth });
      Object.assign(choice.style, previous);
    }
    const desiredWidth = Math.min(620, bounds.width, Math.max(132, textWidth + 88));
    let position = sceneMenuPosition(trigger, bounds, { width: desiredWidth, height: popup.offsetHeight });
    popup.dataset.direction = position.direction;
    popup.style.width = `${position.width}px`;
    popup.style.setProperty("--scene-action-max-width", `${Math.max(44, position.width - 88)}px`);
    for (const measured of measuredChoices) measured.choice.dataset.wrap = String(measured.width > position.width - 88);
    // A narrow viewport can wrap the text; keep the icon vertically centred
    // after that actual height settles rather than opening another row above it.
    position = sceneMenuPosition(trigger, bounds, { width: position.width, height: popup.offsetHeight });
    popup.dataset.direction = position.direction;
    popup.style.left = `${position.left - host.left}px`;
    popup.style.top = `${position.top - host.top}px`;
  }

  function openActions(group: SceneActionGroup, trigger: HTMLButtonElement, activation: "explicit" | "hover", focus = true): void {
    if (chosen || shell.dataset.phase !== "ready" || shell.dataset.view !== "story" || !trigger.isConnected) return;
    // A pointer drifting onto another marker must not remove a menu that the
    // keyboard user is reading. Evaluate here, after the hover delay, since
    // focus may have entered the current menu while that timer was pending.
    if (activation === "hover" && popupTrigger !== trigger && popup?.contains(document.activeElement)) return;
    // An explicit click/keyboard activation is allowed after deliberately
    // collapsing the origin. Automatic pointer entry is gated in renderGroups.
    if (suppressedHoverTrigger === trigger) suppressedHoverTrigger = undefined;
    if (popupTrigger === trigger && popup) {
      hover.stay();
      if (focus) popup.querySelector<HTMLButtonElement>(".scene-context-choice")?.focus({ preventScroll: true });
      return;
    }
    closeActions(false);
    const menuEpoch = epoch;
    popupTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    popup = document.createElement("section");
    const activeMenu = popup;
    popup.className = "scene-context";
    popup.dataset.actionCount = String(group.choices.length);
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", group.label);
    const heading = document.createElement("h2");
    heading.className = "scene-context-heading";
    heading.textContent = group.label;
    const origin = document.createElement("button");
    origin.type = "button";
    origin.className = "scene-context-origin";
    origin.innerHTML = iconForGroup(group).markup;
    origin.setAttribute("aria-label", `收起${group.label}的行动`);
    const dismiss = () => {
      if (menuEpoch !== epoch || popup !== activeMenu) return;
      // Removing the copied icon reveals the original marker under the mouse.
      // That layout hit-test must not immediately reopen what was just closed.
      suppressedHoverTrigger = trigger;
      closeActions();
    };
    origin.addEventListener("click", dismiss);
    const actions = document.createElement("div");
    actions.className = "scene-context-actions";
    actions.addEventListener("wheel", event => {
      if (event.ctrlKey || !event.deltaY || actions.scrollWidth <= actions.clientWidth) return;
      const previous = actions.scrollLeft;
      actions.scrollLeft += event.deltaY;
      if (actions.scrollLeft !== previous) event.preventDefault();
    }, { passive: false });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "scene-context-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "关闭行动");
    close.addEventListener("click", dismiss);
    popup.append(heading, origin, actions, close);
    for (const choice of group.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-context-choice";
      button.textContent = choice.text;
      button.dataset.choiceId = choice.id;
      button.addEventListener("click", () => {
        if (menuEpoch === epoch && trigger === popupTrigger && popup === activeMenu) choose(choice.id, trigger);
      });
      button.addEventListener("focus", () => {
        if (menuEpoch === epoch && popup === activeMenu) button.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
      actions.append(button);
    }
    // Keep the menu outside the narrow-screen scrolling action tray and above
    // the reading layer; otherwise lower choices can be clipped or covered.
    shell.append(popup);
    popup.addEventListener("pointerenter", event => {
      if (popup === activeMenu && event.pointerType === "mouse" && hoverPointer.matches) hover.stay();
    });
    popup.addEventListener("pointerleave", event => {
      if (popup === activeMenu && event.pointerType === "mouse" && hoverPointer.matches) deferClose(trigger);
    });
    placeMenu();
    layoutNarration();
    resize.observe(popup);
    void document.fonts?.ready.then(() => { if (menuEpoch === epoch && popup === activeMenu) placeTargets(); });
    if (focus) popup.querySelector<HTMLButtonElement>(".scene-context-choice")?.focus({ preventScroll: true });
  }

  function deferClose(trigger: HTMLButtonElement): void {
    hover.leave(() => {
      // A keyboard user may continue reading after the pointer has moved away.
      if (popupTrigger === trigger && !popup?.contains(document.activeElement)) closeActions(false);
    });
  }

  document.addEventListener("keydown", event => {
    // Native modal dialogs own Escape and its focus restoration. A handler
    // closer to the target may also have already consumed this key.
    if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog:modal")) return;
    if (popup) {
      event.preventDefault();
      suppressedHoverTrigger = popupTrigger;
      closeActions();
    }
  });
  document.addEventListener("pointerdown", event => {
    if (popup && event.target instanceof Node && !popup.contains(event.target)
      && !popupTrigger?.contains(event.target)) closeActions(false);
  });
  document.addEventListener("pointermove", event => {
    // A close control may be away from the original marker. Real movement
    // outside that marker restores the next intentional approach immediately;
    // a layout-only re-hit under an unmoved pointer remains suppressed.
    if (event.pointerType === "mouse" && suppressedHoverTrigger
      && event.target instanceof Node && !suppressedHoverTrigger.contains(event.target)) suppressedHoverTrigger = undefined;
  });

  function renderGroups(groups: SceneActionGroup[], hasPicture: boolean): void {
    targets.replaceChildren();
    anchors = [];
    tray.replaceChildren();
    const used = groups.filter(group => group.choices.length && group.anchor).map(group => group.anchor!);
    const edgeSlots = [18, 34, 50, 66, 82];
    let exitIndex = 0;
    let contextIndex = 0;
    const edgeAnchor = (group: SceneActionGroup) => {
      const x = group.kind === "exit" ? 6 : 94;
      const next = group.kind === "exit" ? exitIndex++ : contextIndex++;
      const candidates = edgeSlots.map((y, index) => ({ x, y, rank: (index + edgeSlots.length - next) % edgeSlots.length }));
      candidates.sort((a, b) => {
        const distance = (candidate: { x: number; y: number }) => Math.min(...used.map(point => Math.hypot(candidate.x - point.x, candidate.y - point.y)), 100);
        return distance(b) - distance(a) || a.rank - b.rank;
      });
      const selected = candidates[0]!;
      used.push(selected);
      return { x: selected.x, y: selected.y };
    };
    for (const group of groups) {
      if (!group.choices.length) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `scene-target scene-target--${group.kind}`;
      button.dataset.groupId = group.id;
      button.dataset.group = group.id;
      const symbol = document.createElement("span");
      symbol.className = "scene-target-symbol";
      const edge = hasPicture && !group.anchor;
      const icon = iconForGroup(group);
      symbol.innerHTML = icon.markup;
      symbol.dataset.icon = icon.name;
      symbol.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "scene-target-label";
      const markerLabel = edge ? `${group.kind === "exit" ? "方向" : group.kind === "decision" ? "当前决定" : "画外"} · ${sceneActionLabel(group)}` : sceneActionLabel(group);
      label.textContent = markerLabel;
      button.append(symbol, label);
      button.setAttribute("aria-label", `${markerLabel}：展开行动`);
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", event => {
        // Mouse users can leave to dismiss. Keyboard/touch users enter the menu
        // without depending on a hover gesture; subsequent Tab focus stays safe.
        openActions(group, button, "explicit", event.detail === 0 || event.pointerType === "touch");
      });
      button.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse" || !hoverPointer.matches || suppressedHoverTrigger === button) return;
        const version = epoch;
        hover.approach(() => { if (version === epoch) openActions(group, button, "hover", false); });
      });
      button.addEventListener("pointerleave", event => {
        if (event.pointerType === "mouse" && hoverPointer.matches) {
          if (suppressedHoverTrigger === button) suppressedHoverTrigger = undefined;
          deferClose(button);
        }
      });
      if (hasPicture) {
        button.classList.add("scene-target--anchored");
        if (edge) button.classList.add("scene-target--edge");
        targets.append(button);
        const anchor = group.anchor ?? edgeAnchor(group);
        if (anchor.x > 70) button.classList.add("scene-target--label-left");
        anchors.push({ button, ...anchor });
      } else tray.append(button);
    }
    if (tray.childElementCount) targets.append(tray);
    // Reserve the upcoming action boxes before narration becomes visible.
    // The loading/narration CSS keeps them invisible and inert until ready.
    targets.hidden = false;
    targets.inert = true;
    placeTargets();
  }

  async function present(options: SceneStageOptions): Promise<void> {
    cancel();
    const version = epoch;
    const active = new AbortController();
    controller = active;
    const signal = active.signal;
    current = options;
    chosen = false;
    timing.reset();
    shell.dataset.phase = "loading";
    shell.dataset.transition = options.transition;
    scenery.setAttribute("aria-busy", "true");
    notice.hidden = true;
    const viewButton = scenery.querySelector<HTMLButtonElement>(".scene-view-button");
    if (viewButton) viewButton.disabled = true;
    const sameImage = image.getAttribute("src") === options.art.src && image.complete && image.naturalWidth > 0;
    const prepared = sameImage ? image : await prepareSceneImage(options.art.src, signal);
    if (signal.aborted || version !== epoch) return;
    if (prepared) {
      image.hidden = false;
      if (!sameImage) {
        buffer.src = prepared.src;
        buffer.hidden = false;
        buffer.classList.remove("is-visible");
        // Force a start frame before the second decoded image fades in.
        buffer.getBoundingClientRect();
        buffer.classList.add("is-visible");
        await wait(options.transition === "move" ? 360 : 200, signal);
        if (signal.aborted || version !== epoch) return;
        image.src = options.art.src;
        buffer.hidden = true;
      }
      image.alt = options.art.alt;
      environment.src = prepared.src;
      environment.hidden = false;
    } else {
      clearEnvironment();
      image.hidden = true;
      image.src = options.art.src;
      image.alt = "";
      notice.textContent = "当前场景图片暂时无法显示。仍可阅读旁白并继续行动。";
      notice.hidden = false;
    }
    scenery.removeAttribute("aria-busy");
    if (viewButton) viewButton.disabled = !prepared;
    renderGroups(options.groups, Boolean(prepared));
    shell.dataset.phase = "narration";
    await wait(220, signal);
    if (signal.aborted || version !== epoch) return;
    shell.dataset.phase = "ready";
    targets.hidden = false;
    targets.inert = false;
    placeTargets();
    options.onReady();
  }

  return { present, cancel, revealNow, closeActions };
}
