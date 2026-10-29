import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationPages, createNarrationBookmark } from '../src/ui/sceneNarration.ts';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';
import { getScene } from '../src/game/engine.ts';

test('浮字分页保留全部节点正文与线索，不修改规则输入', () => {
  for (const scene of Object.keys(openingScenes)) {
    const state = createGame();
    state.scene = scene;
    const before = structuredClone(state);
    const paragraphs = getScene(state).paragraphs;
    const pages = narrationPages(paragraphs);
    assert.equal(pages.join(''), paragraphs.join(''), scene);
    assert.ok(pages.every(page => Array.from(page).length <= 91));
    assert.deepEqual(state, before);
  }
});

test('优先在句末分段，闭引号不落在下一段开头', () => {
  const first = '你看见木门慢慢打开。';
  const second = '她说：“请进来避雪，火炉还暖着。”';
  const text = first + second + '窗外风雪仍没有停。'.repeat(8);
  const pages = narrationPages([text], 35);
  assert.equal(pages.join(''), text);
  assert.ok(pages.some(page => page.endsWith('。”')));
});

test('没有标点的长段、Unicode字符与异常长度参数也不丢字', () => {
  const text = '雪🌲'.repeat(180);
  for (const size of [0, 30, 90, NaN, Infinity]) {
    const pages = narrationPages([text], size);
    assert.equal(pages.join(''), text);
    assert.ok(pages.every(page => !page.includes('\uFFFD')));
  }
  assert.deepEqual(narrationPages([]), []);
});

test('返回同一旅程场景时保留阅读页和收起状态，重新分页按Unicode字符位置恢复', () => {
  const source = Object.freeze({ journeyId: 'journey-a', scene: 'portrait', paragraphs: Object.freeze(['雪🌲'.repeat(150)]) });
  const bookmark = createNarrationBookmark();
  const desktop = narrationPages(source.paragraphs, 90);
  const narrow = narrationPages(source.paragraphs, 60);
  assert.deepEqual(bookmark.restore(source, desktop), { page: 0, collapsed: false });
  bookmark.remember(source, desktop, 2, true); // Character 180, not UTF-16 offset 270.
  assert.deepEqual(bookmark.restore(structuredClone(source), desktop), { page: 2, collapsed: true });
  assert.deepEqual(bookmark.restore(source, narrow), { page: 3, collapsed: true });
  assert.equal(narrow[3], desktop[2].slice(0, narrow[3].length));
});

test('正文或段落边界、节点、旅程变化不沿用旧书签，实际阅读新场景后旧场景也从头开始', () => {
  const bookmark = createNarrationBookmark();
  const source = { journeyId: 'first', scene: 'registry', paragraphs: ['甲'.repeat(90), '乙'.repeat(90)] };
  const pages = narrationPages(source.paragraphs);
  bookmark.remember(source, pages, 1, true);
  const variants = [
    { ...source, journeyId: 'loaded-save' }, { ...source, scene: 'hallPortrait' },
    { ...source, paragraphs: ['丙'.repeat(90), source.paragraphs[1]] },
    { ...source, paragraphs: [source.paragraphs.join('')] },
  ];
  for (const candidate of variants) assert.deepEqual(bookmark.restore(candidate, narrationPages(candidate.paragraphs)), { page: 0, collapsed: false });
  bookmark.remember(variants[1], pages, 0, false);
  assert.deepEqual(bookmark.restore(source, pages), { page: 0, collapsed: false });
});

test('来回缩放、收起与系统页返回保留原字符锚点，只有主动翻页才更改', () => {
  const bookmark = createNarrationBookmark();
  const source = { journeyId: 'one', scene: 'registry', paragraphs: ['雪'.repeat(300)] };
  const desktop = narrationPages(source.paragraphs, 90);
  const narrow = narrationPages(source.paragraphs, 60);
  bookmark.remember(source, desktop, 1, false);
  for (let repeat = 0; repeat < 3; repeat++) {
    const small = bookmark.restore(source, narrow);
    assert.equal(small.page, 1);
    bookmark.remember(source, narrow, small.page, true, 'layout'); // Collapse/reflow/system return.
    const returned = bookmark.restore(structuredClone(source), desktop);
    assert.deepEqual(returned, { page: 1, collapsed: true });
    bookmark.remember(source, desktop, returned.page, false, 'layout');
  }
  bookmark.remember(source, narrow, 2, false, 'page'); // Deliberate reading moves to character 120.
  assert.equal(bookmark.restore(source, narrow).page, 2);
  assert.equal(bookmark.restore(source, desktop).page, 1);
  bookmark.remember(source, narrow, 0, false, 'page');
  assert.equal(bookmark.restore(source, desktop).page, 0);
});

test('阅读书签只保存最后一个视图，不污染正文，异常页和空正文安全归零', () => {
  const bookmark = createNarrationBookmark();
  const source = { journeyId: 'one', scene: 'arrival', paragraphs: ['雪夜'] };
  const pages = Object.freeze(narrationPages(source.paragraphs));
  for (const page of [-1, NaN, Infinity, 900]) {
    bookmark.remember(source, pages, page, false);
    assert.deepEqual(bookmark.restore(source, pages), { page: 0, collapsed: false });
  }
  bookmark.remember({ ...source, paragraphs: [] }, [], 0, true);
  assert.deepEqual(bookmark.restore({ ...source, paragraphs: [] }, []), { page: 0, collapsed: true });
  assert.deepEqual(source.paragraphs, ['雪夜']);
  assert.deepEqual(pages, ['雪夜']);
});
