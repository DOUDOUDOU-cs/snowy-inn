import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationPages } from '../src/ui/sceneNarration.ts';
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
