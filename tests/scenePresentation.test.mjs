import test from 'node:test';
import assert from 'node:assert/strict';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';
import { choose, getScene } from '../src/game/engine.ts';
import { artForScene } from '../src/ui/sceneArt.ts';
import { presentationForScene } from '../src/ui/scenePresentation.ts';
import { solvedCordOrder } from '../src/game/cordPuzzle.ts';

const present = state => presentationForScene(state, getScene(state), artForScene(state));
const actionGroup = (state, id) => present(state).groups.find(group => group.choices.some(choice => choice.id === id));
function follow(state, ...ids) {
  return ids.reduce((current, id) => {
    assert.ok(actionGroup(current, id), `${current.scene}: ${id} 无呈现入口`);
    return choose(current, id);
  }, state);
}

function states() {
  const base = createGame();
  const allFlags = Object.fromEntries(Object.keys(base.flags).map(flag => [flag, true]));
  const flagVariants = [base.flags,
    { ...base.flags, checkedIn: true },
    { ...base.flags, checkedIn: true, firstNightSlept: true },
    allFlags,
    { ...allFlags, basementTruthSeen: false, choseToStay: false },
    { ...allFlags, basementTruthSeen: false, rescuedFromBasement: false, choseToStay: false }];
  return flagVariants.flatMap(flags => ['night', 'morning'].flatMap(time =>
    ['unresolved', 'eaten', 'pretended', 'declined'].flatMap(breakfast =>
      [[], ['ring', 'silverKey', 'bronzeKey'], ['roomKey', 'oldLedger', 'adultPhoto']].flatMap(inventory =>
        [0, 5, 13].flatMap(forestSteps => [0, 5].map(fusion =>
          ({ ...base, flags, time, breakfast, inventory, forestSteps, fusion, day: 3, ringDroppedOnDay: 1 })))))));
}

test('所有节点在多种规则状态下可用选择恰好分组一次，且已有内容均显式配置', () => {
  for (const profile of states()) {
    for (const scene of Object.keys(openingScenes)) {
      const state = { ...profile, scene };
      const story = getScene(state);
      const frame = presentationForScene(state, story, artForScene(state));
      const choices = frame.groups.flatMap(group => group.choices);
      assert.equal(choices.length, story.choices.length, `${scene} 数量不同`);
      assert.equal(new Set(choices).size, choices.length, `${scene} 重复分组`);
      assert.deepEqual(new Set(choices), new Set(story.choices), `${scene} 选择遗漏或泄漏`);
      assert.ok(!frame.groups.some(group => group.id.startsWith('context-')), `${scene} 缺少显式映射`);
      assert.equal(new Set(frame.groups.map(group => group.id)).size, frame.groups.length);
      assert.ok(frame.space.length > 0);
      assert.ok(['environment', 'detail', 'dialogue', 'decision', 'ending'].includes(frame.mode));
      for (const group of frame.groups) {
        assert.ok(group.label.length > 0 && group.choices.length > 0);
        if (group.anchor) for (const value of Object.values(group.anchor)) assert.ok(value >= 0 && value <= 100);
      }
    }
  }
});

test('真实门前到大厅调查及返回同属大厅空间，办理与画像入口对准不同对象', () => {
  const entrance = follow(createGame(), 'approach');
  assert.deepEqual(actionGroup(entrance, 'enter').anchor, { x: 47, y: 51 });
  // 门前近景里水井就画在右侧，直接点它。
  assert.deepEqual(actionGroup(entrance, 'well').anchor, { x: 93, y: 55 });
  const reception = follow(entrance, 'enter');
  assert.equal(actionGroup(reception, 'start-check-in').kind, 'person');
  assert.equal(actionGroup(reception, 'look-hall-portrait').id, 'hall-portrait');
  assert.equal(actionGroup(reception, 'look-registry').id, 'registry');
  for (const id of ['look-hall-portrait', 'look-registry']) {
    const detail = follow(reception, id);
    assert.equal(present(detail).mode, 'detail');
    assert.equal(present(detail).space, present(reception).space);
    assert.equal(actionGroup(detail, 'back-reception').kind, 'exit');
    const returned = follow(detail, 'back-reception');
    assert.equal(returned.scene, 'reception');
    assert.equal(present(returned).mode, 'environment');
    assert.ok(actionGroup(returned, id));
  }
});

test('同图动作和角色在场变化随真实可用选择更新，不显示未获得线索的追问', () => {
  let state = follow(createGame(), 'approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-reception');
  assert.equal(actionGroup(state, 'start-check-in'), undefined);
  assert.equal(actionGroup(state, 'confront-basement'), undefined);
  assert.ok(actionGroup(state, 'breakfast-offer'));
  state = follow(state, 'breakfast-offer', 'decline-breakfast', 'back-reception');
  assert.equal(actionGroup(state, 'breakfast-offer'), undefined);
  assert.ok(actionGroup(state, 'inspect-cabinet'));
  const truth = { ...state, scene: 'truthHub', flags: { ...state.flags, emilyAdmittedHouse: true } };
  for (const id of ['ask-edward', 'ask-kitchen', 'ask-banquet', 'ask-inn', 'ask-leave']) assert.equal(actionGroup(truth, id), undefined, id);
  const informed = { ...truth, breakfast: 'eaten', flags: { ...truth.flags, weddingStoryHeard: true, nightKitchenSeen: true, banquetTableSeen: true, innNatureHeard: true } };
  for (const id of ['ask-edward', 'ask-kitchen', 'ask-banquet', 'ask-inn', 'ask-leave']) assert.ok(actionGroup(informed, id), id);
  assert.equal(present(informed).space, present(state).space);
  assert.equal(present(informed).mode, 'dialogue');
  assert.ok(present(informed).groups.every(group => !group.label.includes('艾米莉') && !group.label.includes('爱德华')));
});

test('共享choice id按节点表达返回语义，特写动作不误称空间移动', () => {
  const base = createGame();
  assert.equal(actionGroup({ ...base, scene: 'registry' }, 'start-check-in').kind, 'object');
  assert.equal(actionGroup({ ...base, scene: 'reception' }, 'start-check-in').kind, 'person');
  assert.equal(actionGroup({ ...base, scene: 'guestRoom' }, 'back-reception').id, 'room-door');
  assert.equal(actionGroup({ ...base, scene: 'hallPortrait' }, 'back-reception').id, 'reception-return');
  assert.equal(present({ ...base, scene: 'neighborWater' }).mode, 'detail');
  assert.equal(present({ ...base, scene: 'wallVoice' }).mode, 'dialogue');
});

test('绳阵解开前后与旧状态缺省字段不漏行动，也不提前显示取钥匙', () => {
  const base = { ...createGame(), scene: 'wardrobe' };
  assert.ok(actionGroup(base, 'inspect-ropes'));
  assert.equal(actionGroup(base, 'untangle-wardrobe'), undefined);
  const solved = { ...base, cordOrder: [...solvedCordOrder] };
  assert.equal(actionGroup(solved, 'inspect-ropes'), undefined);
  assert.equal(actionGroup(solved, 'untangle-wardrobe').id, 'wardrobe');
  const taken = { ...solved, inventory: ['bronzeKey'] };
  assert.deepEqual(present(taken).groups.flatMap(group => group.choices.map(choice => choice.id)), ['back-neighbor']);
  const legacy = createGame();
  delete legacy.cordOrder;
  for (const flag of ['neighborWaterSeen', 'neighborWaterDrank', 'nightKitchenSeen', 'nightKitchenSpoken', 'banquetTableSeen', 'banquetEchoHeard', 'basementVoiceHeard']) delete legacy.flags[flag];
  for (const scene of Object.keys(openingScenes)) {
    const state = { ...legacy, scene };
    assert.deepEqual(new Set(present(state).groups.flatMap(group => group.choices.map(choice => choice.id))), new Set(getScene(state).choices.map(choice => choice.id)), scene);
  }
});

test('图像变体中门前锚点跟随远近景，空柜台不放人物热点', () => {
  const base = createGame();
  const morning = { ...base, scene: 'entrance', time: 'morning' };
  assert.deepEqual(actionGroup(morning, 'enter').anchor, { x: 62, y: 46 });
  // 远景里看不见水井：改为画面右侧的出口，而不是落在空地上的热区。
  assert.equal(actionGroup(morning, 'well').anchor, undefined);
  assert.equal(actionGroup(morning, 'well').edge, 'right');
  const aged = { ...base, scene: 'entrance', forestSteps: 8 };
  assert.deepEqual(actionGroup(aged, 'enter').anchor, { x: 62, y: 46 });
  const empty = { ...base, scene: 'reception', fusion: 5, flags: { ...base.flags, checkedIn: true, firstNightSlept: true, choseToStay: true, basementTruthSeen: true } };
  assert.equal(actionGroup(empty, 'confront-basement').anchor, undefined);
  assert.equal(actionGroup(empty, 'confront-basement').label, '柜台前交谈');
});

test('呈现为纯读取：冻结输入、不执行规则回调、返回对象与配置互不污染', () => {
  const state = createGame();
  state.scene = 'reception';
  const fail = () => { throw new Error('呈现不能执行规则'); };
  const choice = Object.freeze({ id: 'look-registry', text: '测试登记簿', next: fail, apply: fail, available: fail });
  const scene = Object.freeze({ location: '前台', title: '测试', paragraphs: Object.freeze([]), choices: Object.freeze([choice]) });
  Object.freeze(state.flags); Object.freeze(state.inventory); Object.freeze(state);
  const art = Object.freeze(artForScene(state));
  const before = JSON.stringify(state);
  const frame = presentationForScene(state, scene, art);
  assert.strictEqual(frame.groups[0].choices[0], choice);
  frame.groups[0].anchor.x = 1;
  frame.groups[0].area.w = 1;
  frame.groups[0].choices.splice(0, 1);
  assert.equal(presentationForScene(state, scene, art).groups[0].anchor.x, 23);
  assert.equal(presentationForScene(state, scene, art).groups[0].area.w, 15);
  assert.equal(scene.choices.length, 1);
  assert.equal(JSON.stringify(state), before);
});

test('未来新增未配置选择仍以作者原文独立可达，不能静默消失', () => {
  const state = createGame();
  const scene = getScene(state);
  const added = { id: 'future-action', text: '望向新的岔路', next: 'forest' };
  const result = presentationForScene(state, { ...scene, choices: [...scene.choices, added] }, artForScene(state));
  const fallback = result.groups.find(group => group.choices.includes(added));
  assert.equal(fallback.label, added.text);
  assert.equal(fallback.kind, 'decision');
  assert.equal(fallback.anchor, undefined);
});

test('全部环境探索使用各自物件或出口，特写与结局模式不生成不存在的通行', () => {
  const base = createGame();
  for (const scene of ['reception', 'neighborRoom', 'groundHall', 'nightKitchen', 'banquetHall', 'fleshCorridor']) {
    const state = { ...base, scene, flags: { ...base.flags, checkedIn: true, firstNightSlept: true } };
    assert.ok(present(state).groups.some(group => group.anchor), `${scene} 缺少图内入口`);
  }
  for (const scene of ['escape', 'drownedEnding', 'checkoutEnding', 'innkeeperEnding']) {
    assert.equal(present({ ...base, scene }).mode, 'ending');
    assert.deepEqual(present({ ...base, scene }).groups, []);
  }
});
