import test from 'node:test';
import assert from 'node:assert/strict';
import { getScene } from '../src/game/engine.ts';
import { emptyRecords, startJourney, recordChoice, parseRecords, openRecordStore } from '../src/game/records.ts';
import { wellPuzzleAction, wellPuzzleView } from '../src/game/wellPuzzle.ts';

const interactions = ['rope', 'groove', 'grip', 'crank', 'bucket'];
function travel(records, ...ids) {
  for (const id of ids) {
    assert.ok(getScene(records.current.state).choices.some(choice => choice.id === id), `${id} unavailable at ${records.current.state.scene}`);
    records = recordChoice(records, id);
  }
  return records;
}
function readyWell() {
  return travel(startJourney(emptyRecords()), 'walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring',
    'approach', 'well', 'drop-ring', 'leave-well', 'ruins', 'wait-morning', 'approach', 'well', 'pull-rope');
}

test('井边小游戏沿真实投戒指及隔日路线进入，原文字步骤映射同一动作且只在提桶时获得钥匙', () => {
  let records = readyWell();
  assert.equal(records.current.state.scene, 'ropeSlips');
  const expectedIds = ['set-windlass', 'wrap-rope', 'turn-windlass', 'turn-windlass', 'lift-bucket'];
  for (const [step, action] of ['groove', 'grip', 'crank', 'crank', 'bucket'].entries()) {
    assert.equal(records.current.state.inventory.includes('silverKey'), false);
    const view = wellPuzzleView(records.current.state);
    assert.equal(view.stage, step);
    const proposal = wellPuzzleAction(records.current.state, action);
    assert.equal(proposal.choiceId, expectedIds[step]);
    assert.equal(view.textAction.interaction, action);
    assert.equal(view.textAction.label, getScene(records.current.state).choices.find(choice => choice.id === proposal.choiceId).text);
    records = recordChoice(records, proposal.choiceId);
  }
  assert.equal(wellPuzzleView(records.current.state).stage, 5);
  assert.equal(wellPuzzleView(records.current.state).textAction, undefined);
  assert.equal(records.current.state.inventory.filter(item => item === 'silverKey').length, 1);
  assert.equal(records.current.entries.filter(entry => entry.key === 'silver-key').length, 1);
  for (const action of interactions) assert.equal(wellPuzzleAction(records.current.state, action).choiceId, undefined);
});

test('每阶段只有当前合法操作能推进，提前提桶/转动/重复操作不写状态或记录', () => {
  let records = readyWell();
  for (const correct of ['groove', 'grip', 'crank', 'crank', 'bucket']) {
    const frozen = structuredClone(records.current.state);
    Object.freeze(frozen.inventory); Object.freeze(frozen.flags); Object.freeze(frozen);
    const before = JSON.stringify(records);
    for (const action of interactions.filter(candidate => candidate !== correct)) {
      const proposal = wellPuzzleAction(frozen, action);
      assert.equal(proposal.choiceId, undefined, `stage ${wellPuzzleView(frozen).stage} must block ${action}`);
      assert.ok(proposal.feedback.length > 0);
    }
    assert.equal(JSON.stringify(records), before);
    records = recordChoice(records, wellPuzzleAction(frozen, correct).choiceId);
  }
});

test('旧rope节点原样保存恢复后可接着玩，打开/读提示和关闭都不产生额外存档动作', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let records = readyWell();
  let store = openRecordStore(() => storage);
  for (const action of ['groove', 'grip', 'crank', 'crank', 'bucket']) {
    assert.equal(store.save(records), true);
    const raw = JSON.stringify(records);
    const view = wellPuzzleView(records.current.state);
    assert.ok(view.hint.length > 0);
    assert.equal(JSON.stringify(records), raw);
    const restored = parseRecords(raw);
    assert.ok(restored);
    assert.deepEqual(wellPuzzleView(restored.current.state), view);
    store = openRecordStore(() => storage);
    records = recordChoice(store.data, wellPuzzleAction(store.data.current.state, action).choiceId);
  }
  assert.equal(store.save(records), true);
  assert.equal(openRecordStore(() => storage).data.current.state.inventory.includes('silverKey'), true);
});

test('非井绳节点、未知节点及没有钥匙的完成坏状态不生成小游戏或越权动作', () => {
  const records = startJourney(emptyRecords());
  for (const scene of ['arrival', 'well', 'wardrobe', 'unknown', '__proto__']) {
    const state = { ...records.current.state, scene };
    assert.equal(wellPuzzleView(state), null);
    for (const action of interactions) assert.equal(wellPuzzleAction(state, action).choiceId, undefined);
  }
  assert.equal(wellPuzzleView({ ...records.current.state, scene: 'silverKey' }), null);
});
