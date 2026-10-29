import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneTiming, prepareSceneImage, sceneActionLabel, createSceneHoverIntent, sceneMenuPosition, createSceneStage } from '../src/ui/sceneStage.ts';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';

test('场景标记只命名位置，丢弃与退房的作者原文保留到确认菜单', () => {
  for (const [sceneId, choiceId, label] of [['well', 'drop-ring', '井口'], ['registry', 'write-checkout', '登记簿上的日期']]) {
    const base = createGame();
    const choice = openingScenes[sceneId]({ ...base, scene: sceneId, inventory: ['ring'], flags: { ...base.flags, checkedIn: true, checkoutHintSeen: true } }).choices.find(item => item.id === choiceId);
    assert.ok(choice);
    assert.equal(sceneActionLabel({ id: choiceId, label, kind: 'object', choices: [choice] }), label);
    assert.notEqual(sceneActionLabel({ id: choiceId, label, kind: 'object', choices: [choice] }), choice.text);
  }
  assert.equal(sceneActionLabel({ id: 'decide', label: '桌边的决定', kind: 'decision', choices: [{ text: '吃下早餐' }, { text: '假装吃过' }] }), '桌边的决定');
});

test('靠近和离开分别等待120/300ms，跨菜单间隙与取消阻止迟到回调', () => {
  const pending = [];
  const hover = createSceneHoverIntent((callback, ms) => { pending.push({ callback, ms }); return pending.length; }, () => {});
  const seen = [];
  hover.approach(() => seen.push('open'));
  assert.equal(pending[0].ms, 120);
  hover.leave(() => seen.push('close'));
  assert.equal(pending[1].ms, 300);
  pending[0].callback();
  assert.deepEqual(seen, []);
  hover.stay(); // The pointer crossed from a marker into its menu.
  pending[1].callback();
  assert.deepEqual(seen, []);
  hover.approach(() => seen.push('old view'));
  hover.cancel();
  pending[2].callback();
  assert.deepEqual(seen, []);
  hover.approach(() => seen.push('new view'));
  pending[3].callback();
  assert.deepEqual(seen, ['new view']);
});

test('菜单由图标横向接出，右侧不足时向左，保留图标中心与视口边界', () => {
  const bounds = { left: 10, top: 10, width: 370, height: 824 };
  const trigger = { left: 320, top: 380, width: 44, height: 44 };
  const size = { width: 340, height: 60 };
  const location = sceneMenuPosition(trigger, bounds, size);
  assert.equal(location.direction, 'left');
  assert.equal(location.left + location.width - 22, trigger.left + 22);
  assert.equal(location.top + location.height / 2, trigger.top + 22);
  assert.ok(location.left >= 10 && location.left + location.width <= 380);
  const desktop = sceneMenuPosition({ left: 500, top: 300, width: 44, height: 44 },
    { left: 10, top: 10, width: 1180, height: 780 }, { width: 300, height: 60 });
  assert.equal(desktop.direction, 'right');
  assert.equal(desktop.left, 500, '右向条直接从原图标44px盒起点开始');
  assert.equal(desktop.top, 292, '保持同一个图标中心，没有上下另起菜单');
  const leftEdge = sceneMenuPosition({ left: 10, top: 300, width: 44, height: 44 }, bounds, { width: 620, height: 60 });
  assert.equal(leftEdge.direction, 'right');
  assert.equal(leftEdge.left, 10);
  assert.equal(leftEdge.left + 22, 32, '边缘原图标中心32px与展开中心一致');
  assert.equal(leftEdge.width, 370, '长条按实际可用横向空间限宽');
  const rightEdge = sceneMenuPosition({ left: 336, top: 300, width: 44, height: 44 }, bounds, { width: 620, height: 60 });
  assert.equal(rightEdge.direction, 'left');
  assert.equal(rightEdge.left + rightEdge.width, 380);
  assert.equal(rightEdge.width, 370);
  assert.equal(rightEdge.left + rightEdge.width - 22, 358);
  const legacyOutside = sceneMenuPosition({ left: 6, top: 300, width: 44, height: 44 }, bounds, { width: 200, height: 60 });
  assert.equal(legacyOutside.left + 22, 32, '几何对外部越界输入仍限制到安全边缘，实际标记已使用相同10px留边');
  const bottom = sceneMenuPosition({ left: 320, top: 790, width: 44, height: 44 }, bounds, { width: 300, height: 140 });
  assert.ok(bottom.top + bottom.height <= 834, '只在纵向视口边缘限制溢出');
});

function stageDOM() {
  const originals = new Map(['document', 'window', 'Node', 'ResizeObserver', 'MutationObserver', 'Image'].map(key => [key, globalThis[key]]));
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.dataset = {};
      this.hidden = false; this.inert = false; this.className = ''; this.parent = null; this._scrollLeft = 0; this.classWrites = 0;
      this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
      this.classList = { contains: value => this.className.split(' ').includes(value),
        add: (...values) => { this.classWrites++; this.className = [...new Set([...this.className.split(' '), ...values])].join(' '); },
        remove: (...values) => { this.className = this.className.split(' ').filter(value => !values.includes(value)).join(' '); } };
    }
    get isConnected() { return this.root === true || Boolean(this.parent?.isConnected); }
    get childElementCount() { return this.children.length; }
    get offsetWidth() { return this.className === 'scene-context' ? Number.parseFloat(this.style.width) || 620 : 44; }
    get offsetHeight() {
      if (this.className !== 'scene-context') return 44;
      const actions = this.querySelector('.scene-context-actions');
      const available = Number.parseFloat(this.style['--scene-action-max-width']) || Math.max(44, this.offsetWidth - 88);
      return Math.max(44, ...(actions?.children ?? []).map(child => Math.ceil((child.textContent?.length ?? 0) * 17 / Math.max(1, available - 32)) * 28 + 18));
    }
    get scrollWidth() {
      if (this.className === 'scene-context-actions') return this.children.reduce((width, child) => width + child.scrollWidth, 0);
      return (this.textContent?.length ?? 0) * 17 + 32;
    }
    get clientWidth() { return this.className === 'scene-context-actions' ? Math.max(0, this.parent.offsetWidth - 88) : this.offsetWidth; }
    get clientHeight() { return this.className.split(' ').includes('scene-reading') ? this.getBoundingClientRect().height : this.offsetHeight; }
    get scrollHeight() { return this.className.split(' ').includes('scene-reading') ? this.readingHeight ?? 128 : this.clientHeight; }
    get scrollLeft() { return this._scrollLeft; }
    set scrollLeft(value) { this._scrollLeft = Math.max(0, Math.min(value, this.scrollWidth - this.clientWidth)); }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parent = this; this.children.push(node); } }
    prepend(node) { this.append(node); this.children.unshift(this.children.pop()); }
    after(node) { this.parent.append(node); }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; } }
    replaceChildren() { for (const child of [...this.children]) child.remove(); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(key, handler) { const handlers = this.listeners.get(key) ?? []; handlers.push(handler); this.listeners.set(key, handlers); }
    fire(key, event = {}) { for (const handler of this.listeners.get(key) ?? []) handler({ target: this, detail: 0, ...event }); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    focus() { doc.activeElement = this; this.fire('focus'); }
    showModal() { this.open = true; this.modal = true; }
    close() { this.open = false; this.modal = false; }
    scrollIntoView(options) { this.lastScrollIntoView = options; }
    getBoundingClientRect() {
      let rect;
      if (this.className.split(' ').includes('scene-target')) rect = { left: Number.parseFloat(this.style.left) - 22 || 24, top: Number.parseFloat(this.style.top) - 22 || 210, width: 44, height: 44 };
      else if (this.className === 'scene-target-symbol') {
        const parent = this.parent.getBoundingClientRect();
        rect = { left: parent.left + 5, top: parent.top + 5, width: 34, height: 34 };
      } else if (this.className === 'scene-target-label') {
        const parent = this.parent.getBoundingClientRect();
        rect = { left: parent.left + 47, top: parent.top + 8, width: 80, height: 28 };
      } else if (this.className === 'scene-context-choice') {
        rect = { left: 0, top: 0, width: this.scrollWidth + .35, height: 44 };
      } else if (this.className.split(' ').includes('scene-reading')) {
        rect = { left: Number.parseFloat(this.style.left) || 0, top: Number.parseFloat(this.style.top) || 0,
          width: Number.parseFloat(this.style.width) || 240, height: Math.min(this.readingHeight ?? 128, Number.parseFloat(this.style.maxHeight) || Infinity) };
      } else if (this.className === 'scene-context') rect = { left: Number.parseFloat(this.style.left) || 0, top: Number.parseFloat(this.style.top) || 0, width: this.offsetWidth, height: this.offsetHeight };
      else rect = { left: 0, top: 0, width: 1000, height: 800 };
      return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return all;
      if (selector === 'dialog:modal') return all.filter(child => child.tagName === 'dialog' && child.open && child.modal);
      return all.filter(child => selector.startsWith('.') && child.className.split(' ').includes(selector.slice(1)));
    }
  }
  const doc = new Element(); doc.root = true; doc.activeElement = null; doc.createElement = tag => new Element(tag); doc.fonts = { ready: Promise.resolve() };
  globalThis.document = doc;
  globalThis.window = { innerWidth: 1000, innerHeight: 800, matchMedia: () => ({ matches: true }), addEventListener() {} };
  globalThis.Node = Element;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} };
  globalThis.MutationObserver = class { observe() {} };
  const shell = new Element(); shell.dataset.view = 'story'; doc.append(shell);
  const scenery = new Element(); shell.append(scenery);
  const image = new Element('img'); image.complete = true; image.naturalWidth = 1000; image.naturalHeight = 800; image.src = '/same.png'; image.setAttribute('src', '/same.png'); scenery.append(image);
  const targets = new Element(); scenery.append(targets);
  return { doc, shell, image, targets, stage: createSceneStage({ shell, scenery, image, targets }), restore() {
    for (const [key, value] of originals) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  } };
}

test('687px短选项保留亚像素字宽及余量，有空间时不换行，长句仍可换行', async () => {
  const dom = stageDOM();
  try {
    globalThis.window.innerWidth = 687;
    globalThis.window.innerHeight = 668;
    const group = { id: 'inn-door', label: '旅馆木门', kind: 'exit', anchor: { x: 45, y: 56 }, choices: [{ id: 'enter', text: '进入旅馆' }] };
    const options = { art: { src: '/same.png', alt: '木门' }, groups: [group], transition: 'move', onReady() {}, onChoose() { assert.fail('只展开不执行'); } };
    await dom.stage.present(options);
    dom.targets.querySelector('.scene-target').fire('click');
    const menu = dom.shell.querySelector('.scene-context');
    const action = menu.querySelector('.scene-context-choice');
    assert.equal(action.dataset.wrap, 'false');
    assert.ok(menu.querySelector('.scene-context-actions').clientWidth >= action.getBoundingClientRect().width + 1);
    assert.ok(menu.offsetWidth < 300);
    assert.equal(action.style.whiteSpace, undefined, '临时nowrap测量不能永久覆盖长句样式');
    dom.stage.closeActions(false);
    group.choices[0].text = '这是一个需要在狭窄位置完整阅读的长行动句子。'.repeat(8);
    await dom.stage.present(options);
    dom.targets.querySelector('.scene-target').fire('click');
    assert.equal(dom.shell.querySelector('.scene-context-choice').dataset.wrap, 'true');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('舞台旁白避让展开横条，安全位置保持稳定且只改变显示', async () => {
  const dom = stageDOM();
  try {
    const reading = dom.doc.createElement('div');
    reading.className = 'scene-reading'; reading.readingHeight = 128;
    const line = dom.doc.createElement('p'); line.textContent = '保留正在阅读的旁白。'; reading.append(line);
    dom.shell.append(reading);
    const group = { id: 'inn-door', label: '旅馆木门', kind: 'exit', anchor: { x: 45, y: 65 },
      choices: [{ id: 'enter', text: '完整行动原文'.repeat(40) }] };
    await dom.stage.present({ art: { src: '/same.png', alt: '木门' }, groups: [group], transition: 'move', onReady() {}, onChoose() { assert.fail('避让不能推进剧情'); } });
    const previous = { left: reading.style.left, top: reading.style.top };
    dom.targets.querySelector('.scene-target').fire('click');
    const menu = dom.shell.querySelector('.scene-context');
    const textBox = reading.getBoundingClientRect(), menuBox = menu.getBoundingClientRect();
    const intersection = Math.max(0, Math.min(textBox.right, menuBox.right) - Math.max(textBox.left, menuBox.left))
      * Math.max(0, Math.min(textBox.bottom, menuBox.bottom) - Math.max(textBox.top, menuBox.top));
    assert.equal(intersection, 0, '旁白不能盖在展开行动条上');
    assert.notDeepEqual({ left: reading.style.left, top: reading.style.top }, previous, '行动展开后可重新选位');
    const safe = { left: reading.style.left, top: reading.style.top };
    dom.stage.closeActions(false);
    assert.deepEqual({ left: reading.style.left, top: reading.style.top }, safe, '障碍消失后安全位置不无故跳回固定位置');
    assert.equal(line.textContent, '保留正在阅读的旁白。');
    assert.equal(reading.classWrites, 1, '重复避让不能重写class触发自身MutationObserver循环');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('完全无旁白空位时提供阅读退化标志，仍可展开并执行原行动', async () => {
  const dom = stageDOM();
  try {
    const reading = dom.doc.createElement('div'); reading.className = 'scene-reading';
    const line = dom.doc.createElement('p'); line.textContent = '拥挤时正文仍保留。'; reading.append(line); dom.shell.append(reading);
    // Reserve the whole view, modelling a genuinely obstructed small surface.
    const reserve = dom.doc.createElement('nav'); reserve.className = 'story-nav'; dom.shell.append(reserve);
    const choices = [];
    await dom.stage.present({ art: { src: '/same.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit',
      anchor: { x: 45, y: 56 }, choices: [{ id: 'enter', text: '进入旅馆' }] }], transition: 'move', onReady() {}, onChoose(id) { choices.push(id); } });
    assert.equal(reading.dataset.obstructed, 'true');
    assert.equal(dom.shell.dataset.narrationObstructed, 'true');
    assert.equal(line.textContent, '拥挤时正文仍保留。');
    dom.targets.querySelector('.scene-target').fire('click');
    dom.shell.querySelector('.scene-context-choice').fire('click');
    assert.deepEqual(choices, ['enter']);
    dom.stage.cancel();
    assert.equal(dom.shell.dataset.narrationObstructed, 'false', '退出视图清理阅读退化标志');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('点单动作标记只展开，必须选择完整原文才执行；取消后的旧菜单不能执行', async () => {
  const dom = stageDOM();
  try {
    const choices = [];
    const group = { id: 'well', label: '井口', kind: 'object', choices: [{ id: 'drop-ring', text: '把戒指丢进井里' }] };
    const options = { art: { src: '/same.png', alt: '井口' }, groups: [group], transition: 'inspect', onReady() {}, onChoose(id) { choices.push(id); } };
    await dom.stage.present(options);
    const marker = dom.targets.querySelector('.scene-target');
    assert.ok(marker.className.includes('scene-target--edge'), '未绘制物件作为方向边缘入口');
    assert.equal(marker.querySelector('.scene-target-label').textContent, '画外 · 井口');
    marker.fire('click');
    assert.deepEqual(choices, []);
    const menu = dom.shell.querySelector('.scene-context');
    assert.equal(menu.parent, dom.shell, '横条保留顶层挂载避免旁白和托盘裁切');
    assert.equal(menu.querySelector('.scene-context-heading').tagName, 'h2');
    const origin = menu.querySelector('.scene-context-origin');
    assert.equal(origin.innerHTML, marker.querySelector('.scene-target-symbol').innerHTML, '展开图标使用同一场景SVG');
    assert.ok(menu.offsetWidth < 300, '短行动按内容收紧，不再固定300px大片空白');
    const markerRect = marker.querySelector('.scene-target-symbol').getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    assert.equal(menuRect.left + (menu.dataset.direction === 'right' ? 22 : menuRect.width - 22), markerRect.left + markerRect.width / 2);
    assert.equal(menuRect.top + menuRect.height / 2, markerRect.top + markerRect.height / 2);
    origin.fire('click');
    assert.deepEqual(choices, [], '起点图标只收起，不执行单行动');
    assert.equal(dom.doc.activeElement, marker);
    marker.fire('click');
    const action = dom.shell.querySelector('.scene-context-choice');
    assert.equal(action.textContent, '把戒指丢进井里');
    assert.equal(dom.doc.activeElement, action, '点击和键盘激活进入完整行动菜单');
    action.fire('click');
    assert.deepEqual(choices, ['drop-ring']);
    await Promise.resolve();
    marker.fire('click');
    const stale = dom.shell.querySelector('.scene-context-choice');
    dom.stage.closeActions(false);
    marker.fire('click');
    stale.fire('click');
    assert.deepEqual(choices, ['drop-ring'], '同视图重新打开后旧详情回调也不能执行');
    const cancelled = dom.shell.querySelector('.scene-context-choice');
    dom.stage.cancel();
    cancelled.fire('click');
    assert.deepEqual(choices, ['drop-ring']);
    assert.equal(marker.getAttribute('aria-expanded'), 'false');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('多行动保留一个横向动作容器，滚轮与Tab可达远端全文，陈旧关闭不能收起新菜单', async () => {
  const dom = stageDOM();
  try {
    globalThis.window.innerWidth = 390;
    const choices = [];
    const group = { id: 'meal', label: '桌边的决定', kind: 'decision', anchor: { x: 32, y: 30 }, choices: [
      { id: 'eat', text: '吃下桌上的整份香肠早餐' }, { id: 'pretend', text: '假装吃过早餐，先观察前台反应' },
    ] };
    await dom.stage.present({ art: { src: '/same.png', alt: '早餐' }, groups: [group], transition: 'dialogue', onReady() {}, onChoose(id) { choices.push(id); } });
    const marker = dom.targets.querySelector('.scene-target');
    marker.fire('click');
    const menu = dom.shell.querySelector('.scene-context');
    const actions = menu.querySelector('.scene-context-actions');
    const buttons = actions.querySelectorAll('.scene-context-choice');
    assert.equal(buttons.length, 2);
    assert.deepEqual(buttons.map(button => button.textContent), group.choices.map(choice => choice.text));
    assert.equal(menu.querySelectorAll('.scene-context-actions').length, 1);
    assert.ok(menu.offsetWidth <= 370);
    assert.equal(menu.style['--scene-action-max-width'], `${Math.max(44, menu.offsetWidth - 88)}px`, '单个动作换行受实际展开侧可用宽度约束');
    assert.ok(menu.offsetHeight > 46, '窄屏长文换行产生实际高度变化');
    const menuRect = menu.getBoundingClientRect();
    const iconRect = marker.querySelector('.scene-target-symbol').getBoundingClientRect();
    assert.equal(menuRect.top + menuRect.height / 2, iconRect.top + iconRect.height / 2, '限宽换行后重新测量高度保持起点同位');
    assert.ok(actions.scrollWidth > actions.clientWidth, '窄屏动作区需要横向浏览');
    let prevented = false;
    actions.fire('wheel', { deltaY: 90, ctrlKey: false, preventDefault() { prevented = true; } });
    assert.equal(actions.scrollLeft, 90);
    assert.equal(prevented, true);
    prevented = false;
    actions.fire('wheel', { deltaY: 90, ctrlKey: true, preventDefault() { prevented = true; } });
    assert.equal(actions.scrollLeft, 90, '保留Ctrl缩放');
    assert.equal(prevented, false);
    buttons[1].focus();
    assert.deepEqual(buttons[1].lastScrollIntoView, { block: 'nearest', inline: 'nearest' }, '键盘焦点滚入远端完整选项');
    const staleClose = menu.querySelector('.scene-context-close');
    dom.stage.closeActions(false);
    marker.fire('click');
    staleClose.fire('click');
    assert.ok(dom.shell.querySelector('.scene-context'), '旧菜单关闭回调不操作新菜单');
    assert.deepEqual(choices, []);
    dom.shell.querySelectorAll('.scene-context-choice')[1].fire('click');
    assert.deepEqual(choices, ['pretend']);
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('同位起点主动收起不会因重新命中标记而自动展开，真正离开或显式点击可再开', async () => {
  const dom = stageDOM();
  try {
    const options = { art: { src: '/same.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit', anchor: { x: 40, y: 50 }, choices: [{ id: 'enter', text: '进入旅馆' }] }], transition: 'move', onReady() {}, onChoose() { assert.fail('收起不执行'); } };
    await dom.stage.present(options);
    const marker = dom.targets.querySelector('.scene-target');
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    dom.shell.querySelector('.scene-context-origin').fire('click');
    marker.fire('pointerenter', { pointerType: 'mouse' }); // Re-hit after removing the copied icon.
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context'), null);
    marker.fire('pointerleave', { pointerType: 'mouse' });
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.ok(dom.shell.querySelector('.scene-context'));
    const staleOrigin = dom.shell.querySelector('.scene-context-origin');
    staleOrigin.fire('click');
    marker.fire('click', { detail: 0 });
    staleOrigin.fire('click');
    assert.ok(dom.shell.querySelector('.scene-context'), '显式再次打开及旧起点回调隔离');
    dom.doc.fire('keydown', { key: 'Escape', preventDefault() {} });
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context'), null, 'Esc主动收起也防止同位原标记重新命中而重开');
    dom.doc.fire('pointermove', { pointerType: 'mouse', target: dom.shell });
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.ok(dom.shell.querySelector('.scene-context'), '从远端关闭后真实移动到原标记外，下一次靠近不被抑制');
    dom.doc.fire('keydown', { key: 'Escape', preventDefault() {} });
    marker.fire('pointerleave', { pointerType: 'mouse' });
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.ok(dom.shell.querySelector('.scene-context'), 'Esc之后真正离开并重新靠近可以展开');
    dom.doc.fire('keydown', { key: 'Escape', preventDefault() {} });
    marker.fire('click', { detail: 0 });
    assert.ok(dom.shell.querySelector('.scene-context'), 'Esc之后显式点击可立即展开');
    dom.shell.querySelector('.scene-context-origin').fire('click');
    dom.stage.cancel();
    await dom.stage.present(options);
    const nextMarker = dom.targets.querySelector('.scene-target');
    nextMarker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.ok(dom.shell.querySelector('.scene-context'), '换视图清除旧标记的收起抑制');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('触屏靠近不展开，点击再选择；Escape恢复标记焦点，外部点击关闭详情', async () => {
  const dom = stageDOM();
  try {
    let chosen = 0;
    await dom.stage.present({ art: { src: '/same.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit', anchor: { x: 40, y: 50 }, choices: [{ id: 'enter', text: '推门进入旅馆' }] }], transition: 'move', onReady() {}, onChoose() { chosen++; } });
    const marker = dom.targets.querySelector('.scene-target');
    marker.fire('pointerenter', { pointerType: 'touch' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context'), null);
    marker.fire('click', { detail: 1, pointerType: 'touch' });
    const action = dom.shell.querySelector('.scene-context-choice');
    assert.equal(dom.doc.activeElement, action);
    assert.equal(chosen, 0);
    let prevented = false;
    dom.doc.fire('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(dom.doc.activeElement, marker);
    assert.equal(dom.shell.querySelector('.scene-context'), null);
    marker.fire('click', { detail: 1, pointerType: 'touch' });
    dom.doc.fire('pointerdown', { target: dom.shell });
    assert.equal(dom.shell.querySelector('.scene-context'), null);
    assert.equal(chosen, 0);
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('悬停另一标记不移除持有焦点的菜单，显式鼠标和键盘仍可切换，纯悬停保持切换', async () => {
  const dom = stageDOM();
  try {
    const groups = ['A', 'B'].map((label, index) => ({ id: label, label, kind: 'object', anchor: { x: 30 + index * 40, y: 50 },
      choices: [{ id: label, text: `调查${label}` }] }));
    await dom.stage.present({ art: { src: '/same.png', alt: '房间' }, groups, transition: 'inspect', onReady() {}, onChoose() { assert.fail('展开不能执行行动'); } });
    const [a, b] = dom.targets.querySelectorAll('.scene-target');
    a.fire('click', { detail: 0 });
    const menuA = dom.shell.querySelector('.scene-context');
    const actionA = menuA.querySelector('.scene-context-choice');
    assert.equal(dom.doc.activeElement, actionA);
    b.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context'), menuA);
    assert.equal(dom.doc.activeElement, actionA, '鼠标偶然靠近不移走键盘焦点');
    b.fire('click', { detail: 1, pointerType: 'mouse' });
    assert.equal(menuA.isConnected, false, '明确鼠标点击仍可切换');
    assert.equal(dom.shell.querySelector('.scene-context-choice').textContent, '调查B');
    a.fire('click', { detail: 0 });
    assert.equal(dom.doc.activeElement, dom.shell.querySelector('.scene-context-choice'), '键盘明确切换进入新菜单');
    assert.equal(dom.doc.activeElement.textContent, '调查A');
    dom.stage.closeActions(false);
    dom.doc.activeElement = null;
    a.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    const hoverA = dom.shell.querySelector('.scene-context');
    b.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(hoverA.isConnected, false, '未持有焦点时纯鼠标仍自然切换');
    assert.equal(dom.shell.querySelector('.scene-context-choice').textContent, '调查B');
    // Focus can arrive after B's delayed approach was already scheduled.
    a.fire('pointerenter', { pointerType: 'mouse' });
    const focusedB = dom.shell.querySelector('.scene-context-choice');
    focusedB.focus();
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context-choice'), focusedB);
    assert.equal(dom.doc.activeElement, focusedB);
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('全局Escape不抢已消费的按键或原生模态框焦点，模态框关闭后正常收起行动', async () => {
  const dom = stageDOM();
  try {
    await dom.stage.present({ art: { src: '/same.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit',
      anchor: { x: 40, y: 50 }, choices: [{ id: 'enter', text: '进入旅馆' }] }], transition: 'move', onReady() {}, onChoose() { assert.fail('Escape不能行动'); } });
    const marker = dom.targets.querySelector('.scene-target');
    marker.fire('click', { detail: 0 });
    const menu = dom.shell.querySelector('.scene-context');
    const action = menu.querySelector('.scene-context-choice');
    dom.doc.fire('keydown', { key: 'Escape', defaultPrevented: true, preventDefault() { assert.fail('不得再次消费按键'); } });
    assert.equal(dom.shell.querySelector('.scene-context'), menu);
    assert.equal(dom.doc.activeElement, action);
    const modal = dom.doc.createElement('dialog');
    const modalControl = dom.doc.createElement('button');
    modal.append(modalControl); dom.shell.append(modal); modal.showModal(); modalControl.focus();
    dom.doc.fire('keydown', { key: 'Escape', defaultPrevented: false, preventDefault() { assert.fail('原生模态框应自行处理Escape'); } });
    assert.equal(dom.shell.querySelector('.scene-context'), menu);
    assert.equal(dom.doc.activeElement, modalControl, '背景菜单不能将焦点拉到模态框外');
    modal.close();
    action.focus();
    let prevented = false;
    dom.doc.fire('keydown', { key: 'Escape', defaultPrevented: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(dom.shell.querySelector('.scene-context'), null);
    assert.equal(dom.doc.activeElement, marker, '没有顶层模态框时仍返回标记');
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('缺图保留明确文字行动，移除图片定位变量且仍须选择原文', async () => {
  const dom = stageDOM();
  try {
    globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror?.()); } };
    dom.image.complete = false;
    dom.shell.style.setProperty('--scene-picture-bottom', '800px');
    const chosen = [];
    await dom.stage.present({ art: { src: '/missing.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit', anchor: { x: 40, y: 50 }, choices: [{ id: 'enter', text: '推门进入旅馆' }] }], transition: 'move', onReady() {}, onChoose(id) { chosen.push(id); } });
    assert.equal(dom.shell.dataset.picture, 'missing');
    assert.equal(dom.shell.style['--scene-picture-bottom'], undefined);
    const marker = dom.targets.querySelector('.scene-action-tray').querySelector('.scene-target');
    assert.equal(marker.querySelector('.scene-target-label').textContent, '木门');
    marker.fire('click');
    assert.deepEqual(chosen, []);
    dom.shell.querySelector('.scene-context-choice').fire('click');
    assert.deepEqual(chosen, ['enter']);
  } finally { dom.stage.cancel(); dom.restore(); }
});

test('鼠标靠近展开不抢焦点，移入菜单保留详情，换视图取消待开的菜单', async () => {
  const dom = stageDOM();
  try {
    await dom.stage.present({ art: { src: '/same.png', alt: '门' }, groups: [{ id: 'door', label: '木门', kind: 'exit', anchor: { x: 40, y: 50 }, choices: [{ id: 'enter', text: '推门进入旅馆' }] }], transition: 'move', onReady() {}, onChoose() { assert.fail('仅靠近不得行动'); } });
    const marker = dom.targets.querySelector('.scene-target');
    marker.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 140));
    const menu = dom.shell.querySelector('.scene-context');
    assert.ok(menu);
    assert.equal(dom.doc.activeElement, null);
    marker.fire('pointerleave', { pointerType: 'mouse' });
    menu.fire('pointerenter', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 330));
    assert.ok(menu.isConnected);
    dom.stage.closeActions(false);
    marker.fire('click', { detail: 1, pointerType: 'mouse' });
    marker.fire('pointerleave', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 330));
    assert.equal(dom.shell.querySelector('.scene-context'), null, '鼠标点击展开也能离开关闭');
    marker.fire('click', { detail: 0 });
    marker.fire('pointerleave', { pointerType: 'mouse' });
    await new Promise(resolve => setTimeout(resolve, 330));
    assert.ok(dom.shell.querySelector('.scene-context'), '键盘展开后可继续阅读');
    dom.stage.closeActions(false);
    marker.fire('pointerenter', { pointerType: 'mouse' });
    dom.stage.cancel();
    await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(dom.shell.querySelector('.scene-context'), null);
  } finally { dom.stage.cancel(); dom.restore(); }
});

function candidate(decode = async () => {}) {
  return { src: '', decoding: '', onload: null, onerror: null, decode };
}

test('立即显示跳过呈现计时，但仍等待目标图片完成解码', async () => {
  const timing = createSceneTiming(() => false);
  const signal = new AbortController().signal;
  let resolveDecode;
  const image = candidate(() => new Promise(resolve => { resolveDecode = resolve; }));
  let prepared = false;
  const pending = prepareSceneImage('/new.png', signal, () => image).then(value => { prepared = true; return value; });
  image.onload();
  timing.revealNow();
  await timing.wait(60000, signal);
  assert.equal(prepared, false, '图片尚未解码，不允许借用旧图动作');
  resolveDecode();
  assert.equal(await pending, image);
});

test('取消图片准备立即完成，迟到的解码不会恢复旧任务', async () => {
  const controller = new AbortController();
  let resolveDecode;
  const image = candidate(() => new Promise(resolve => { resolveDecode = resolve; }));
  const pending = prepareSceneImage('/old.png', controller.signal, () => image);
  image.onload();
  controller.abort();
  assert.equal(await pending, undefined);
  resolveDecode();
  await Promise.resolve();
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});

test('图片加载错误或解码错误明确返回失败供文字行动退化', async () => {
  const signal = new AbortController().signal;
  const failed = candidate();
  const pending = prepareSceneImage('/missing.png', signal, () => failed);
  failed.onerror();
  assert.equal(await pending, undefined);
  const badDecode = candidate(async () => { throw new Error('decode failed'); });
  const decoding = prepareSceneImage('/bad.png', signal, () => badDecode);
  badDecode.onload();
  assert.equal(await decoding, undefined);
});

test('图片永不响应时超时结束，不永久锁住行动', async () => {
  const image = candidate();
  assert.equal(await prepareSceneImage('/stalled.png', new AbortController().signal, () => image, 5), undefined);
  assert.equal(image.onload, null);
});

test('中断淡入计时会及时结束，后续一代可以重新计时', async () => {
  const timing = createSceneTiming(() => false);
  const controller = new AbortController();
  const pending = timing.wait(60000, controller.signal);
  controller.abort();
  await pending;
  timing.reset();
  let ready = false;
  const next = timing.wait(60000, new AbortController().signal).then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  timing.revealNow();
  await next;
  assert.equal(ready, true);
});

test('减少动画与已取消信号都不启动长计时', async () => {
  const timing = createSceneTiming(() => true);
  await timing.wait(60000, new AbortController().signal);
  const aborted = new AbortController();
  aborted.abort();
  await createSceneTiming(() => false).wait(60000, aborted.signal);
});

test('已经取消的图片准备不开始网络或本地请求', async () => {
  const controller = new AbortController();
  controller.abort();
  const image = candidate();
  assert.equal(await prepareSceneImage('/never.png', controller.signal, () => image), undefined);
  assert.equal(image.src, '');
});
