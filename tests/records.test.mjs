import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, getScene } from '../src/game/engine.ts';
import { createGame } from '../src/game/state.ts';
import { emptyRecords, startJourney, recordChoice, recordItemInspection, recordCordMove, saveManualSlot, loadManualSlot, replayCheckpoint, parseRecords, openRecordStore, SAVE_KEY } from '../src/game/records.ts';
import { ENDPOINT_COUNT, cordsUntangled, initialCordOrder } from '../src/game/cordPuzzle.ts';

function travel(records, ...ids) {
  for (const id of ids) {
    assert.ok(getScene(records.current.state).choices.some(choice => choice.id === id), `${id} 应在 ${records.current.state.scene} 可选`);
    records = recordChoice(records, id);
  }
  return records;
}

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('日记只保留关键发现和决定，普通折返不会反复写入', () => {
  let records = travel(startJourney(emptyRecords()), 'walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring', 'approach', 'enter');
  const original = structuredClone(records);
  assert.deepEqual(records.current.entries.map(entry => entry.key), ['departure', 'ruins', 'ring', 'entered']);
  assert.ok(records.current.entries.every(entry => entry.text.includes('我')));
  records = travel(records, 'leave-inn', 'enter', 'leave-inn', 'enter');
  assert.equal(records.current.entries.length, 4);
  records = travel(records, 'leave-inn', 'well', 'drop-ring');
  assert.equal(records.current.state.inventory.includes('ring'), false);
  assert.deepEqual(records.current.entries.map(entry => entry.key), ['departure', 'ruins', 'ring', 'entered', 'ring-well']);
  assert.equal(original.current.entries.length, 4);
  const before = JSON.stringify(records);
  getScene(records.current.state);
  getScene(records.current.state);
  assert.equal(JSON.stringify(records), before);
  assert.equal(recordChoice(records, '不存在的选项'), records);
});

test('自动保存后可恢复同一场景、物品、线索与历史，接着选择只新增一段', () => {
  const storage = memoryStorage();
  const first = openRecordStore(() => storage);
  let records = travel(startJourney(first.data), 'walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring', 'approach', 'enter');
  const count = records.current.entries.length;
  records = recordItemInspection(records, 'ring');
  assert.equal(records.current.entries.length, count + 1);
  records = recordItemInspection(records, 'ring');
  assert.equal(records.current.entries.length, count + 1);
  assert.equal(records.current.state.flags.ringInscriptionRead, true);
  assert.equal(first.save(records), true);
  const reopened = openRecordStore(() => storage);
  assert.deepEqual(reopened.data, records);
  records = travel(reopened.data, 'start-check-in', 'finish-check-in');
  assert.equal(records.current.entries.length, count + 2);
  assert.equal(records.current.state.flags.ringInscriptionRead, true);
  assert.equal(reopened.save(records), true);
});

test('重新开始保存旧旅程，通关与未完旅程都能留存且新局不继承物品', () => {
  let records = travel(startJourney(emptyRecords()), 'walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring');
  const abandoned = structuredClone(records.current);
  records = startJourney(records);
  assert.deepEqual(records.current.state.inventory, []);
  assert.deepEqual(records.archives[0].entries, abandoned.entries);
  assert.equal(records.archives[0].state, undefined);
  records = travel(records, ...Array(10).fill('walk'));
  assert.equal(records.current.entries.at(-1).ending, '结局 · 一直向前');
  assert.equal(records.current.entries.some(entry => entry.ending === '结局 · 退房'), false);
  records = startJourney(records);
  assert.equal(records.archives.length, 2);
  assert.equal(records.archives[1].entries.at(-1).ending, '结局 · 一直向前');
  assert.deepEqual(parseRecords(JSON.stringify(records)), records);
});

test('三个手动存档位可在结局后读取，原旅程归档且存档保持原样', () => {
  let records = travel(startJourney(emptyRecords()), 'approach', 'enter');
  const savedState = structuredClone(records.current.state);
  records = saveManualSlot(records, 1, '2026-09-30T01:00:00.000Z');
  assert.equal(records.saves.length, 1);
  assert.deepEqual(records.saves[0].snapshot.state, savedState);
  records = travel(records, 'leave-inn', 'walk');
  records = saveManualSlot(records, 2, '2026-09-30T02:00:00.000Z');
  records = saveManualSlot(records, 3, '2026-09-30T03:00:00.000Z');
  assert.deepEqual(records.saves.map(save => save.slot), [1, 2, 3]);
  const beforeOverwrite = records.saves[0];
  records = saveManualSlot(records, 4);
  assert.equal(records.saves[0], beforeOverwrite);
  records = saveManualSlot(records, 2, '2026-09-30T04:00:00.000Z');
  assert.equal(records.saves.length, 3);
  assert.equal(records.saves[1].savedAt, '2026-09-30T04:00:00.000Z');
  records = travel(startJourney(records), ...Array(10).fill('walk'));
  assert.equal(getScene(records.current.state).ending, '结局 · 一直向前');
  const endingId = records.current.id;
  records = loadManualSlot(records, 1);
  assert.deepEqual(records.current.state, savedState);
  assert.notEqual(records.current.id, endingId);
  assert.equal(records.archives.at(-1).entries.at(-1).ending, '结局 · 一直向前');
  assert.deepEqual(records.saves[0].snapshot.state, savedState);
  assert.deepEqual(parseRecords(JSON.stringify(records)), records);
});

test('关键节点保存选择前状态，结局后回溯并重新作出选择', () => {
  let records = travel(startJourney(emptyRecords()), 'approach', 'enter');
  const point = records.current.checkpoints[0];
  assert.equal(point.key, 'before-enter');
  assert.equal(point.state.scene, 'entrance');
  assert.equal(point.state.flags.enteredInn, false);
  records = travel(records, 'leave-inn', ...Array(10).fill('walk'));
  const finished = structuredClone(records.current);
  records = replayCheckpoint(records, 'before-enter');
  assert.deepEqual(records.current.state, point.state);
  assert.deepEqual(records.current.entries, point.entries);
  assert.equal(records.current.checkpoints.length, 0);
  assert.equal(records.archives.at(-1).entries.at(-1).ending, finished.entries.at(-1).ending);
  records = travel(records, 'walk');
  assert.equal(records.current.state.flags.enteredInn, false);
  assert.equal(records.current.state.forestSteps, 1);
  assert.equal(replayCheckpoint(records, 'missing'), records);
  assert.deepEqual(parseRecords(JSON.stringify(records)), records);
});

test('损坏的手动存档和关键节点被拒绝，旧 1.0 记录仍能读取', () => {
  const old = startJourney(emptyRecords());
  delete old.saves;
  delete old.current.checkpoints;
  assert.deepEqual(parseRecords(JSON.stringify(old)), old);
  const withSave = saveManualSlot(old, 1);
  const broken = structuredClone(withSave);
  broken.saves[0].snapshot.state.scene = 'missing';
  assert.equal(parseRecords(JSON.stringify(broken)), null);
  const withPoint = travel(startJourney(emptyRecords()), 'approach', 'enter');
  withPoint.current.checkpoints[0].entries = [];
  assert.equal(parseRecords(JSON.stringify(withPoint)), null);
});

test('旧版逐节点存档读取后凝练为日记，游戏状态和原有文件都保留', () => {
  const states = [createGame()];
  for (let index = 0; index < 3; index++) states.push(choose(states.at(-1), 'walk'));
  const steps = states.map((state, index) => ({
    scene: state.scene, day: state.day, time: state.time,
    location: getScene(state).location, title: getScene(state).title,
    paragraphs: getScene(state).paragraphs,
    ...(index < 3 ? { choice: { id: 'walk', text: '继续行进' } } : {}),
  }));
  const old = {
    version: 1, archives: [], current: {
      id: 'old-journey', startedAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:01:00.000Z',
      state: states.at(-1), entries: steps,
    },
  };
  const storage = memoryStorage();
  const raw = JSON.stringify(old);
  storage.setItem(SAVE_KEY, raw);
  const store = openRecordStore(() => storage);
  assert.equal(storage.getItem(SAVE_KEY), raw);
  assert.equal(store.data.version, 2);
  assert.deepEqual(store.data.current.state, states.at(-1));
  assert.deepEqual(store.data.current.entries.map(entry => entry.key), ['departure', 'ruins']);
  assert.equal(store.save(store.data), true);
  assert.deepEqual(parseRecords(storage.getItem(SAVE_KEY)), store.data);
});

test('井绳操作每一步可恢复，拉起木桶前不会提前获得钥匙', () => {
  const storage = memoryStorage();
  const first = openRecordStore(() => storage);
  let records = travel(startJourney(first.data), 'walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring', 'approach', 'well', 'drop-ring', 'leave-well', 'ruins', 'wait-morning', 'approach', 'well', 'pull-rope', 'set-windlass');
  assert.equal(records.current.state.scene, 'ropeOnWindlass');
  assert.equal(records.current.state.inventory.includes('silverKey'), false);
  assert.equal(first.save(records), true);
  const reopened = openRecordStore(() => storage);
  records = travel(reopened.data, 'wrap-rope', 'turn-windlass', 'turn-windlass');
  assert.equal(records.current.state.scene, 'ropeWoundTwice');
  assert.equal(records.current.state.inventory.includes('silverKey'), false);
  records = travel(records, 'lift-bucket');
  assert.equal(records.current.state.inventory.filter(item => item === 'silverKey').length, 1);
  assert.equal(records.current.entries.filter(entry => entry.key === 'silver-key').length, 1);
  assert.equal(reopened.save(records), true);
});

test('衣柜钥匙在解开绳端并取下后才进入背包和日记', () => {
  const storage = memoryStorage();
  const first = openRecordStore(() => storage);
  let records = travel(startJourney(first.data), 'approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'investigate', 'neighbor-door', 'enter-neighbor', 'search-wardrobe');
  assert.equal(records.current.state.inventory.includes('bronzeKey'), false);
  assert.equal(records.current.entries.some(entry => entry.key === 'bronze-key'), false);
  assert.equal(recordChoice(records, 'untangle-wardrobe'), records);
  records = recordCordMove(records, 0, 1);
  assert.equal(records.current.state.inventory.includes('bronzeKey'), false);
  assert.equal(first.save(records), true);
  const reopened = openRecordStore(() => storage);
  records = reopened.data;
  assert.notDeepEqual(records.current.state.cordOrder, initialCordOrder);
  for (let slot = 0; slot < ENDPOINT_COUNT; slot++) {
    const desired = Math.floor(slot / 2);
    if (records.current.state.cordOrder[slot] === desired) continue;
    const other = records.current.state.cordOrder.findIndex((cord, index) => index > slot && cord === desired);
    records = recordCordMove(records, slot, other);
  }
  assert.equal(cordsUntangled(records.current.state.cordOrder), true);
  records = travel(records, 'untangle-wardrobe');
  assert.equal(records.current.state.inventory.includes('bronzeKey'), false);
  records = travel(records, 'take-bronze-key');
  assert.equal(records.current.state.inventory.includes('bronzeKey'), true);
  assert.equal(records.current.entries.filter(entry => entry.key === 'bronze-key').length, 1);
  assert.equal(reopened.save(records), true);
});

test('旧版存档缺少绳阵顺序时仍可读取', () => {
  const older = startJourney(emptyRecords());
  delete older.current.state.cordOrder;
  assert.deepEqual(parseRecords(JSON.stringify(older)), older);

  const previousPuzzle = startJourney(emptyRecords());
  previousPuzzle.current.state.cordOrder = [9, 16, 3, 14, 1, 18, 7, 12, 0, 15, 5, 19, 10, 2, 17, 6, 13, 4, 11, 8];
  assert.deepEqual(parseRecords(JSON.stringify(previousPuzzle)), previousPuzzle);
});

test('1.0 存档缺少新增场景标记时仍可读取并继续调查', () => {
  const saved = startJourney(emptyRecords());
  for (const key of ['neighborWaterSeen', 'neighborWaterDrank', 'nightKitchenSeen', 'nightKitchenSpoken', 'banquetTableSeen', 'banquetEchoHeard', 'basementVoiceHeard']) {
    delete saved.current.state.flags[key];
  }
  const reopened = parseRecords(JSON.stringify(saved));
  assert.ok(reopened);
  reopened.current.state.scene = 'neighborRoom';
  const next = recordChoice(reopened, 'inspect-neighbor-water');
  assert.equal(next.current.state.flags.neighborWaterSeen, true);
  assert.ok(parseRecords(JSON.stringify(next)));
});

test('坏档、未知版本和不完整状态不崩溃，也不被新旅程覆盖', () => {
  for (const raw of ['{broken', JSON.stringify({version: 9}), 'null']) {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, raw);
    const store = openRecordStore(() => storage);
    assert.equal(store.data.current, null);
    assert.ok(store.message);
    assert.equal(store.save(startJourney(store.data)), false);
    assert.equal(storage.getItem(SAVE_KEY), raw);
  }
  const valid = startJourney(emptyRecords());
  for (const mutate of [
    data => { data.current.state.scene = 'missing-scene'; },
    data => { data.current.state.fusion = 500; },
    data => { data.current.state.inventory = ['unknown-item']; },
    data => { data.current.state.cordOrder = Array(20).fill(0); },
    data => { delete data.current.state.flags.choseToStay; },
    data => { data.current.entries = []; },
    data => { data.current.entries[0].text = 17; },
    data => { data.current.entries.push(structuredClone(data.current.entries[0])); },
  ]) {
    const broken = structuredClone(valid);
    mutate(broken);
    assert.equal(parseRecords(JSON.stringify(broken)), null);
  }
});

test('存储失败时保留上次记录并提示，恢复可用后再次保存成功', () => {
  const storage = memoryStorage();
  let failing = false;
  const port = { getItem: storage.getItem, setItem: (key, raw) => { if (failing) throw new Error('quota'); storage.setItem(key, raw); } };
  const store = openRecordStore(() => port);
  let records = startJourney(store.data);
  assert.equal(store.save(records), true);
  const previous = storage.getItem(SAVE_KEY);
  failing = true;
  records = travel(records, 'walk');
  assert.equal(store.save(records), false);
  assert.ok(store.message.includes('暂未保存'));
  assert.equal(storage.getItem(SAVE_KEY), previous);
  failing = false;
  assert.equal(store.save(records), true);
  assert.equal(store.message, '');
});

test('其他窗口更新进度后不互相覆盖，读取权限错误也不使游戏崩溃', () => {
  const storage = memoryStorage();
  const first = openRecordStore(() => storage);
  const second = openRecordStore(() => storage);
  const records = startJourney(first.data);
  assert.equal(first.save(records), true);
  assert.equal(second.save(startJourney(second.data)), false);
  assert.ok(second.message.includes('另一个窗口'));
  assert.deepEqual(parseRecords(storage.getItem(SAVE_KEY)), records);
  const denied = openRecordStore(() => { throw new Error('unavailable'); });
  assert.equal(denied.data.current, null);
  assert.equal(denied.save(startJourney(denied.data)), false);
  assert.ok(denied.message);
});
