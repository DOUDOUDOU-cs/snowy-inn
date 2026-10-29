import test from 'node:test';
import assert from 'node:assert/strict';
import { placeNarration } from '../src/ui/narrationLayout.ts';

const bounds = { left: 12, top: 80, width: 760, height: 520 };
const size = { width: 380, height: 140 };
const rectAt = (position, dimensions) => ({ ...position, ...dimensions });
const intersects = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left &&
  a.top < b.top + b.height && a.top + a.height > b.top;
const inside = (position, area, dimensions) => {
  assert.ok(position.left >= area.left && position.top >= area.top);
  assert.ok(position.left + Math.min(dimensions.width, area.width) <= area.left + area.width);
  assert.ok(position.top + Math.min(dimensions.height, area.height) <= area.top + area.height);
};

test('初始旁白避开图面底部按钮，仍限制在图面内', () => {
  const button = { left: 360, top: 480, width: 44, height: 44 };
  const position = placeNarration(bounds, size, [button]);
  assert.equal(position.overlap, 0);
  assert.equal(intersects(rectAt(position, size), button), false);
  inside(position, bounds, size);
});

test('横向展开行动后重新选位，关闭后保留新的安全位置', () => {
  const initial = placeNarration(bounds, size, []);
  const menu = { left: initial.left - 20, top: initial.top + 40, width: 460, height: 65 };
  const next = placeNarration(bounds, size, [menu], initial);
  assert.equal(next.overlap, 0);
  assert.notDeepEqual({ left: next.left, top: next.top }, { left: initial.left, top: initial.top });
  assert.deepEqual(placeNarration(bounds, size, [], next), next);
});

test('上一位置仍安全时不因新按钮或分页尺寸改变而来回跳动', () => {
  const previous = { left: 29, top: 151 };
  const position = placeNarration(bounds, { width: 400, height: 160 },
    [{ left: 490, top: 270, width: 80, height: 60 }], previous);
  assert.deepEqual(position, { ...previous, overlap: 0 });
});

test('390px窄屏旁白在门标记与导航之间找到完整空位', () => {
  const area = { left: 12, top: 150, width: 366, height: 540 };
  const dimensions = { width: 366, height: 180 };
  const obstacles = [{ left: 110, top: 300, width: 230, height: 65 },
    { left: 120, top: 650, width: 44, height: 40 }];
  const position = placeNarration(area, dimensions, obstacles);
  assert.equal(position.overlap, 0);
  for (const rect of obstacles) assert.equal(intersects(rectAt(position, dimensions), rect), false);
  inside(position, area, dimensions);
});

test('找到九宫格采样遗漏的狭窄横向空隙', () => {
  const area = { left: 0, top: 0, width: 300, height: 400 };
  const dimensions = { width: 200, height: 60 };
  const obstacles = [{ left: 0, top: 0, width: 300, height: 109 },
    { left: 0, top: 169, width: 300, height: 231 }];
  assert.deepEqual(placeNarration(area, dimensions, obstacles), { left: 50, top: 109, overlap: 0 });
});

test('找到非中心的窄矩形空洞并支持小数坐标', () => {
  const area = { left: 0, top: 0, width: 400, height: 400 };
  const dimensions = { width: 60, height: 70 };
  const obstacles = [{ left: 0, top: 0, width: 400, height: 102.25 },
    { left: 0, top: 172.25, width: 400, height: 227.75 },
    { left: 0, top: 102.25, width: 73.5, height: 70 },
    { left: 133.5, top: 102.25, width: 266.5, height: 70 }];
  assert.deepEqual(placeNarration(area, dimensions, obstacles), { left: 73.5, top: 102.25, overlap: 0 });
});

test('没有空位时返回实际最小重叠面积，供舞台选择退化', () => {
  const area = { left: 0, top: 0, width: 200, height: 100 };
  const dimensions = { width: 80, height: 40 };
  const obstacles = [{ left: 0, top: 0, width: 200, height: 100 },
    { left: 0, top: 0, width: 60, height: 100 }];
  const position = placeNarration(area, dimensions, obstacles);
  assert.equal(position.overlap, 3200);
  assert.ok(position.left >= 60);
  inside(position, area, dimensions);
});

test('尺寸与旧位置超界时夹紧，退化或空bounds也只产生有限坐标', () => {
  const area = { left: 10, top: 20, width: 50, height: 40 };
  assert.deepEqual(placeNarration(area, { width: 200, height: 300 }, [],
    { left: -300, top: 900 }), { left: 10, top: 20, overlap: 0 });
  assert.deepEqual(placeNarration({ left: 5, top: 6, width: 0, height: -4 },
    { width: 100, height: 100 }, []), { left: 5, top: 6, overlap: 0 });
  const position = placeNarration(area, { width: 30, height: 20 },
    [{ left: NaN, top: 0, width: 40, height: 50 }], { left: Infinity, top: NaN });
  inside(position, area, { width: 30, height: 20 });
  assert.equal(position.overlap, 0);
});
