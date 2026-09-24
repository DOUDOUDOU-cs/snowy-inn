import test from 'node:test';
import assert from 'node:assert/strict';
import { CORD_COUNT, ENDPOINT_COUNT, initialCordOrder, solvedCordOrder, swapCordEnds, cordsUntangled, cordCrossings, isCordOrder, isLegacyCordOrder, normalizeCordOrder } from '../src/game/cordPuzzle.ts';

test('二十根绳的四十个端点形成环形交错绳阵', () => {
  assert.equal(CORD_COUNT, 20);
  assert.equal(ENDPOINT_COUNT, 40);
  assert.equal(isCordOrder(initialCordOrder), true);
  assert.equal(cordCrossings(initialCordOrder), 92);
  assert.equal(cordsUntangled(initialCordOrder), false);
  for (let cord = 0; cord < CORD_COUNT; cord++) {
    assert.equal(initialCordOrder.filter(value => value === cord).length, 2);
  }

  let order = initialCordOrder;
  let moves = 0;
  for (let slot = 0; slot < ENDPOINT_COUNT; slot++) {
    const desired = Math.floor(slot / 2);
    if (order[slot] === desired) continue;
    const other = order.findIndex((cord, index) => index > slot && cord === desired);
    order = swapCordEnds(order, slot, other);
    moves += 1;
  }
  assert.equal(moves, 34);
  assert.deepEqual(order, solvedCordOrder);
  assert.equal(cordCrossings(order), 0);
  assert.equal(cordsUntangled(order), true);
});

test('环形存档要求每根绳恰好出现两个端点', () => {
  assert.equal(isCordOrder(Array(40).fill(0)), false);
  assert.equal(isCordOrder([...initialCordOrder.slice(0, 39), 18]), false);
  assert.equal(isCordOrder([...initialCordOrder.slice(0, 39), 20]), false);
  assert.equal(swapCordEnds(initialCordOrder, 0, 40), initialCordOrder);
  assert.equal(swapCordEnds(initialCordOrder, 0, 28), initialCordOrder, '同一根绳的两端交换不产生假进度');
});

test('上一版二十位绳阵存档可迁移', () => {
  const unsolvedLegacy = [9, 16, 3, 14, 1, 18, 7, 12, 0, 15, 5, 19, 10, 2, 17, 6, 13, 4, 11, 8];
  const solvedLegacy = [...Array(CORD_COUNT).keys()];
  assert.equal(isLegacyCordOrder(unsolvedLegacy), true);
  assert.equal(normalizeCordOrder(unsolvedLegacy), initialCordOrder);
  assert.equal(normalizeCordOrder(solvedLegacy), solvedCordOrder);
});
