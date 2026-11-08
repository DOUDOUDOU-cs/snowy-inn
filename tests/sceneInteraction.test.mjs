import test from 'node:test';
import assert from 'node:assert/strict';
import { keyIntent, prepareSceneImage } from '../src/ui/sceneView.ts';

const fakeImage = behavior => class {
  decoding = 'async';
  onload = null;
  onerror = null;
  _src = '';
  get src() { return this._src; }
  set src(value) {
    this._src = value;
    queueMicrotask(() => {
      if (behavior === 'load') this.onload?.();
      else if (behavior === 'error') this.onerror?.();
    });
  }
  decode() {
    return behavior === 'decode-fail' ? Promise.reject(new Error('decode failed')) : Promise.resolve();
  }
};

test('隐藏文字时键盘只允许恢复，不推进剧情或选项', () => {
  const hidden = { hidden: true, hasMenu: false, onControl: false, optionIndex: 0 };
  for (const key of ['1', '2', ' ', 'Enter', 'ArrowRight', 'ArrowUp', 'Escape']) {
    const intent = keyIntent(key, hidden);
    assert.ok(intent === 'none' || intent === 'restore-text', `${key} 不应推进剧情：${intent}`);
  }
  assert.equal(keyIntent(' ', hidden), 'restore-text');
  assert.equal(keyIntent('1', hidden), 'none');
  assert.equal(keyIntent('h', hidden), 'toggle-text');

  // 可见状态保持原有行为：数字键选项、方向键翻页、Esc 关菜单、焦点在控件上时空格不翻页。
  assert.equal(keyIntent('1', { ...hidden, hidden: false }), 'choose');
  assert.equal(keyIntent('ArrowLeft', { ...hidden, hidden: false }), 'prev');
  assert.equal(keyIntent('ArrowRight', { ...hidden, hidden: false }), 'next');
  assert.equal(keyIntent('Escape', { hidden: false, hasMenu: true, onControl: false, optionIndex: null }), 'close-menu');
  assert.equal(keyIntent(' ', { hidden: false, hasMenu: false, onControl: true, optionIndex: null }), 'none');
});

test('场景图加载的成功、失败、解码失败、中止与超时都走可控分支', async () => {
  const ok = await prepareSceneImage('/ok.webp', new AbortController().signal, () => new (fakeImage('load'))(), 100);
  assert.ok(ok, '成功时返回准备完成的图片');

  const failed = await prepareSceneImage('/error.webp', new AbortController().signal, () => new (fakeImage('error'))(), 100);
  assert.equal(failed, undefined);

  const decodeFailed = await prepareSceneImage('/decode.webp', new AbortController().signal, () => new (fakeImage('decode-fail'))(), 100);
  assert.equal(decodeFailed, undefined);

  const abortedController = new AbortController();
  abortedController.abort();
  const aborted = await prepareSceneImage('/abort.webp', abortedController.signal, () => new (fakeImage('load'))(), 100);
  assert.equal(aborted, undefined);

  const timedOut = await prepareSceneImage('/slow.webp', new AbortController().signal, () => new (fakeImage('slow'))(), 15);
  assert.equal(timedOut, undefined);
});
