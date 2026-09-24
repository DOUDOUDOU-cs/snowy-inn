import { CORD_COUNT, ENDPOINT_COUNT, cordCrossings, cordsUntangled } from "../game/cordPuzzle";
import type { CordOrder } from "../game/cordPuzzle";

const SIZE = 640;
const CENTER = SIZE / 2;
const RADIUS = 268;
const colors = ["#9b7768", "#778a84", "#a18d66", "#7c8493", "#907871", "#819174", "#927c5f", "#6f8588"];
const label = (cord: number): string => String(cord + 1).padStart(2, "0");
const points = Array.from({ length: ENDPOINT_COUNT }, (_, slot) => {
  const angle = -Math.PI / 2 + slot * Math.PI * 2 / ENDPOINT_COUNT;
  return { x: CENTER + Math.cos(angle) * RADIUS, y: CENTER + Math.sin(angle) * RADIUS };
});

interface MoveResult { order: CordOrder; warning?: string }
interface DragState {
  slot: number;
  pointer: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

export function openCordPuzzle(
  initialOrder: CordOrder,
  onMove: (from: number, to: number) => MoveResult,
  onSolved: () => void,
  onClose: () => void,
): void {
  const dialog = document.createElement("dialog");
  dialog.className = "puzzle-dialog cord-dialog";
  dialog.setAttribute("aria-labelledby", "cord-puzzle-title");
  dialog.setAttribute("aria-describedby", "cord-puzzle-hint");
  dialog.innerHTML = `
    <div class="puzzle-heading">
      <div>
        <p class="puzzle-eyebrow">隔壁客房 · 衣柜内侧</p>
        <h2 id="cord-puzzle-title" tabindex="-1">圆框绳阵</h2>
      </div>
      <button class="puzzle-close" type="button" aria-label="收起衣柜画面">×</button>
    </div>
    <div class="cord-puzzle-layout">
      <section class="cord-instructions">
        <p class="puzzle-description">二十根旧绳横穿圆框，每根绳的两端标着同一个编号。圆周上的四十个绳端都能挪动；让圆内不再有绳线相交。</p>
        <p class="cord-progress" aria-live="polite"></p>
        <p class="puzzle-hint" id="cord-puzzle-hint" role="status">拖动任一绳端到别的位置，或依次点选圆周上的两个端点交换。</p>
        <p class="puzzle-footnote">选中端点后，同一根绳及它的另一端会亮起。方向键可将当前端点沿圆周移动一格。每次调整都会自动保存。</p>
      </section>
      <div class="cord-board" role="group" aria-label="圆框上的四十个可移动绳端">
        <svg class="cord-svg" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">
          <g class="cord-frame"></g><g class="cord-lines"></g><g class="cord-pegs"></g>
        </svg>
        <button class="cord-key" type="button" aria-label="取下露出的古铜色钥匙" disabled><span class="cord-key-shape" aria-hidden="true"></span></button>
        <div class="cord-handles"></div>
      </div>
    </div>`;

  const board = dialog.querySelector<HTMLElement>(".cord-board")!;
  const frame = dialog.querySelector<SVGGElement>(".cord-frame")!;
  const lines = dialog.querySelector<SVGGElement>(".cord-lines")!;
  const pegs = dialog.querySelector<SVGGElement>(".cord-pegs")!;
  const handles = dialog.querySelector<HTMLElement>(".cord-handles")!;
  const key = dialog.querySelector<HTMLButtonElement>(".cord-key")!;
  const hint = dialog.querySelector<HTMLElement>(".puzzle-hint")!;
  const progress = dialog.querySelector<HTMLElement>(".cord-progress")!;
  let order: CordOrder = [...initialOrder];
  let selected: number | null = null;
  let moves = 0;
  let dragging: DragState | null = null;

  frame.innerHTML = `
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS + 25}" fill="#17211f" stroke="#513d30" stroke-width="28"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS + 8}" fill="#222c28" stroke="#877052" stroke-width="4"/>
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS - 19}" fill="#131d1c" stroke="#3f5149" stroke-width="2"/>`;
  pegs.innerHTML = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="12" fill="#1a2422" stroke="#796b59" stroke-width="4"/>`).join("");

  const buttons = Array.from({ length: ENDPOINT_COUNT }, () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cord-handle";
    handles.append(button);
    return button;
  });

  function eventPoint(event: PointerEvent): { x: number; y: number } {
    const rect = board.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SIZE, (event.clientX - rect.left) / rect.width * SIZE)),
      y: Math.max(0, Math.min(SIZE, (event.clientY - rect.top) / rect.height * SIZE)),
    };
  }

  function closestSlot(point: { x: number; y: number }): number {
    const angle = Math.atan2(point.y - CENTER, point.x - CENTER) + Math.PI / 2;
    const turn = (angle + Math.PI * 2) % (Math.PI * 2);
    return Math.round(turn / (Math.PI * 2) * ENDPOINT_COUNT) % ENDPOINT_COUNT;
  }

  function endpointPoint(slot: number): { x: number; y: number } {
    return dragging?.slot === slot ? { x: dragging.x, y: dragging.y } : points[slot];
  }

  function cordSlots(cord: number): number[] {
    const slots: number[] = [];
    order.forEach((value, slot) => { if (value === cord) slots.push(slot); });
    return slots;
  }

  function render(): void {
    const selectedCord = selected === null ? null : order[selected];
    const cords = Array.from({ length: CORD_COUNT }, (_, cord) => cord);
    if (selectedCord !== null) cords.sort((a, b) => Number(a === selectedCord) - Number(b === selectedCord));
    lines.innerHTML = cords.map(cord => {
      const [first, second] = cordSlots(cord);
      const start = endpointPoint(first);
      const end = endpointPoint(second);
      const bright = selectedCord === cord || dragging !== null && order[dragging.slot] === cord;
      const opacity = selectedCord !== null && !bright ? ".13" : "1";
      return `<g opacity="${opacity}">
        <path d="M ${start.x} ${start.y} L ${end.x} ${end.y}" stroke="#080e0e" stroke-width="12" fill="none" stroke-linecap="round"/>
        <path d="M ${start.x} ${start.y} L ${end.x} ${end.y}" stroke="${colors[cord % colors.length]}" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M ${start.x} ${start.y} L ${end.x} ${end.y}" stroke="#e8ddc53d" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>`;
    }).join("");

    const solved = cordsUntangled(order);
    buttons.forEach((button, slot) => {
      const cord = order[slot];
      const point = endpointPoint(slot);
      const endpoints = cordSlots(cord);
      const endNumber = endpoints.indexOf(slot) + 1;
      button.style.left = `${point.x / SIZE * 100}%`;
      button.style.top = `${point.y / SIZE * 100}%`;
      button.style.setProperty("--cord-color", colors[cord % colors.length]);
      button.textContent = label(cord);
      button.classList.toggle("is-selected", selected === slot);
      button.classList.toggle("is-partner", selectedCord === cord && selected !== slot);
      button.classList.toggle("is-dragging", dragging?.slot === slot);
      button.disabled = solved;
      button.setAttribute("aria-label", `${label(cord)} 号绳的第 ${endNumber} 个端点，位于圆周第 ${slot + 1} 格${selected === slot ? "，已选中" : ""}`);
    });
    dialog.classList.toggle("cord-solved", solved);
    key.disabled = !solved;
    progress.textContent = solved ? `圆内已无交叉 · 本次调整 ${moves} 次` : `仍有 ${cordCrossings(order)} 处交叉 · 本次打开后调整 ${moves} 次`;
    if (solved) hint.textContent = "绳线已经全部解开。圆框中央的古铜色钥匙现在可以取下。";
  }

  function swap(from: number, to: number): void {
    if (from === to) { selected = null; render(); return; }
    if (order[from] === order[to]) {
      selected = to;
      hint.textContent = `这两个端点同属 ${label(order[to])} 号绳。请再选择另一根绳的端点。`;
      render();
      return;
    }
    const result = onMove(from, to);
    order = [...result.order];
    selected = null;
    moves += 1;
    hint.textContent = result.warning || "两个绳端换了位置。可以选中一根绳，查看它还穿过了哪些绳线。";
    render();
    if (cordsUntangled(order)) key.focus({ preventScroll: true });
  }

  function select(slot: number): void {
    if (cordsUntangled(order)) return;
    if (selected === null) {
      selected = slot;
      hint.textContent = `已选中 ${label(order[slot])} 号绳的一端；同号的另一端也已亮起。再选不同编号的端点即可交换。`;
      render();
    } else if (selected === slot) {
      selected = null;
      hint.textContent = "放下了绳端。";
      render();
    } else swap(selected, slot);
  }

  buttons.forEach((button, slot) => {
    button.addEventListener("pointerdown", event => {
      if (cordsUntangled(order)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      dragging = { slot, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, ...points[slot], moved: false };
    });
    button.addEventListener("pointermove", event => {
      if (!dragging || dragging.pointer !== event.pointerId || dragging.slot !== slot) return;
      if (Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 7) dragging.moved = true;
      if (dragging.moved) {
        Object.assign(dragging, eventPoint(event));
        render();
      }
    });
    button.addEventListener("pointerup", event => {
      if (!dragging || dragging.pointer !== event.pointerId || dragging.slot !== slot) return;
      const moved = dragging.moved;
      const target = closestSlot(eventPoint(event));
      dragging = null;
      if (moved) swap(slot, target);
      else select(slot);
    });
    button.addEventListener("pointercancel", () => { dragging = null; render(); });
    button.addEventListener("click", event => { if (event.detail === 0) select(slot); });
    button.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const to = (slot + (event.key === "ArrowLeft" ? ENDPOINT_COUNT - 1 : 1)) % ENDPOINT_COUNT;
      swap(slot, to);
      if (!cordsUntangled(order)) buttons[to].focus({ preventScroll: true });
    });
  });

  function finish(solved: boolean): void {
    dialog.close();
    dialog.remove();
    if (solved) onSolved();
    else onClose();
  }
  key.addEventListener("click", () => { if (cordsUntangled(order)) finish(true); });
  dialog.querySelector<HTMLButtonElement>(".puzzle-close")!.addEventListener("click", () => finish(false));
  dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
  document.body.append(dialog);
  render();
  dialog.showModal();
  dialog.querySelector<HTMLElement>("#cord-puzzle-title")!.focus({ preventScroll: true });
}
