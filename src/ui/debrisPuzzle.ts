// 局部解谜界面只管理当前交互；剧情推进与物品保存由调用方完成。
export function openDebrisPuzzle(trigger: HTMLButtonElement, onSolved: () => void): void {
  const dialog = document.createElement("dialog");
  dialog.className = "puzzle-dialog";
  dialog.setAttribute("aria-labelledby", "debris-puzzle-title");
  dialog.setAttribute("aria-describedby", "debris-puzzle-hint");
  dialog.innerHTML = `
    <div class="puzzle-heading">
      <div>
        <p class="puzzle-eyebrow">村庄遗迹 · 局部调查</p>
        <h2 id="debris-puzzle-title">碎木下的亮点</h2>
      </div>
      <button class="puzzle-close" type="button" aria-label="收起调查画面">×</button>
    </div>
    <p class="puzzle-description">木条交错压在一起。试着从最上层开始移开。</p>
    <div class="debris-workbench" role="group" aria-label="碎木堆">
      <button class="debris-ring" type="button" aria-label="拾起露出的戒指" disabled><span aria-hidden="true"></span></button>
      <button class="debris-piece debris-piece-bottom" type="button" aria-label="移开最下层木条" data-order="2"></button>
      <button class="debris-piece debris-piece-middle" type="button" aria-label="移开中间木条" data-order="1"></button>
      <button class="debris-piece debris-piece-top" type="button" aria-label="移开最上层木条" data-order="0"></button>
    </div>
    <p class="puzzle-hint" id="debris-puzzle-hint" role="status">最上面那根木条的边缘已经松动。</p>
    <p class="puzzle-footnote">点击木条拨开。按 Esc 可返回遗迹。</p>`;

  const pieces = [...dialog.querySelectorAll<HTMLButtonElement>(".debris-piece")];
  const ring = dialog.querySelector<HTMLButtonElement>(".debris-ring")!;
  const hint = dialog.querySelector<HTMLElement>(".puzzle-hint")!;
  let cleared = 0;

  function finish(solved: boolean): void {
    dialog.close();
    dialog.remove();
    if (solved) onSolved();
    else trigger.focus({ preventScroll: true });
  }

  dialog.querySelector<HTMLButtonElement>(".puzzle-close")!.addEventListener("click", () => finish(false));
  dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
  for (const piece of pieces) {
    piece.addEventListener("click", () => {
      if (Number(piece.dataset.order) !== cleared) {
        hint.textContent = "这根还被上面的木条压着。";
        return;
      }
      piece.classList.add("is-cleared");
      piece.disabled = true;
      cleared += 1;
      hint.textContent = ["下面那根木条露出来了。", "还有最后一根压在亮点上。", "泥雪里是一枚戒指。点它收起来。"][cleared - 1]!;
      if (cleared === pieces.length) {
        dialog.classList.add("is-uncovered");
        ring.disabled = false;
        ring.focus({ preventScroll: true });
      } else pieces.find(next => Number(next.dataset.order) === cleared)?.focus({ preventScroll: true });
    });
  }
  ring.addEventListener("click", () => { if (cleared === pieces.length) finish(true); });
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>(".debris-piece-top")!.focus({ preventScroll: true });
}
