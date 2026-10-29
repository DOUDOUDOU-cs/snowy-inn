import test from 'node:test';
import assert from 'node:assert/strict';
import { iconForGroup } from '../src/ui/sceneIcons.ts';
import { presentationForScene } from '../src/ui/scenePresentation.ts';
import { artForScene } from '../src/ui/sceneArt.ts';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';

test('场景标记按具名对象选择线绘图标，旅馆灯光与木门明确区分', () => {
  const expected = {
    inn: 'lantern', 'inn-road': 'lantern', 'inn-door': 'door', outside: 'door', 'reception-return': 'door',
    'forest-road': 'path', 'hall-portrait': 'frame', photo: 'frame', registry: 'book', ledger: 'book',
    'front-desk': 'person', 'kitchen-person': 'person', stairs: 'stairs', downstairs: 'stairs', descend: 'stairs',
    'well-road': 'well', 'well-water': 'well', windlass: 'windlass', 'well-rope': 'rope', water: 'cup',
    bed: 'bed', wardrobe: 'wardrobe', 'kitchen-door': 'kitchen', 'room-key': 'key', 'desk-drawer': 'drawer',
    'breakfast-plate': 'plate', 'wall-voice': 'sound',
  };
  for (const [id, name] of Object.entries(expected)) assert.equal(iconForGroup({ id, kind: id === 'reception-return' ? 'exit' : 'object' }).name, name, id);
  assert.equal(iconForGroup({ id: 'rest', kind: 'decision' }).name, 'candle', '遗迹休息没有凭空显示床');
  assert.equal(iconForGroup({ id: 'behind-desk', kind: 'object' }).name, 'lens', '柜台后不是抽屉或未见座位');
});

test('图标不读选项或线索，不将未知物件与原文插入SVG', () => {
  const group = { id: 'unmapped-object', kind: 'object' };
  for (const field of ['label', 'choices', 'anchor', 'inventory', 'flags']) {
    Object.defineProperty(group, field, { get() { throw new Error(`不应读取 ${field}`); } });
  }
  assert.equal(iconForGroup(group).name, 'lens');
  assert.equal(iconForGroup({ id: 'unmapped-decision', kind: 'decision' }).name, 'candle');
  assert.equal(iconForGroup({ id: 'unmapped-person', kind: 'person' }).name, 'person');
  for (const id of ['__proto__', 'constructor', '<script>alert(1)</script>', '"><image href="https://invalid"/>']) {
    const icon = iconForGroup({ id, kind: 'exit' });
    assert.equal(icon.name, 'door');
    assert.ok(!icon.markup.includes(id));
  }
});

test('实际节点图标全部为无外部资源的安全静态24像素SVG，装饰图标不替代名称', () => {
  const base = createGame();
  const names = new Set();
  for (const scene of Object.keys(openingScenes)) {
    const state = { ...base, scene };
    for (const group of presentationForScene(state, openingScenes[scene](state), artForScene(state)).groups) {
      const icon = iconForGroup(group);
      names.add(icon.name);
      assert.match(icon.markup, /^<svg class="scene-marker-icon" viewBox="0 0 24 24"/);
      assert.match(icon.markup, /stroke="currentColor"/);
      assert.match(icon.markup, /aria-hidden="true" focusable="false"/);
      assert.match(icon.markup, /<\/(?:svg)>$/);
      assert.doesNotMatch(icon.markup, /(?:↗|›|◇|[\u{1F300}-\u{1FAFF}]|https?:|href=|<script|<foreignObject|\bon\w+=)/u);
      assert.ok(group.label.length > 0, `${scene} 仍保留可发现名称`);
    }
  }
  assert.ok(names.size >= 15, '跨场景确实使用不同物件图标');
});
