import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, knownClues } from '../src/game/state.ts';
import { choose, getScene, inspectItem, moveCord } from '../src/game/engine.ts';
import { ENDPOINT_COUNT, cordsUntangled } from '../src/game/cordPuzzle.ts';

function route(...choices) {
  return choices.reduce((state, id) => {
    assert.ok(getScene(state).choices.some(choice => choice.id === id), `选项 ${id} 应在 ${state.scene} 中可用`);
    return choose(state, id);
  }, createGame());
}
const findRing = () => route('walk', 'walk', 'walk', 'rest', 'uncover-ring', 'take-ring');
const liftSilverKey = ['pull-rope', 'set-windlass', 'wrap-rope', 'turn-windlass', 'turn-windlass', 'lift-bucket'];

function follow(state, ...choices) {
  return choices.reduce((current, id) => {
    assert.ok(getScene(current).choices.some(choice => choice.id === id), `选项 ${id} 应在 ${current.scene} 中可用`);
    return choose(current, id);
  }, state);
}

test('第三次赶路发现遗迹，第十次才离开，沿途文字发生变化', () => {
  let state = createGame();
  const texts = new Set();
  for (let count = 1; count <= 10; count++) {
    state = choose(state, 'walk');
    assert.equal(state.forestSteps, count);
    if (count === 3) assert.equal(state.scene, 'ruins');
    if (count < 10) assert.notEqual(state.scene, 'escape');
    if (count >= 4 && count <= 9) texts.add(getScene(state).paragraphs.join(''));
  }
  assert.equal(texts.size, 6);
  assert.equal(state.scene, 'escape');
  assert.equal(getScene(state).choices.length, 0);
});

test('靠近旅馆和查看物品不会增加或重置赶路次数', () => {
  const state = route('walk', 'walk', 'walk', 'approach', 'well', 'leave-well', 'ruins');
  const before = structuredClone(state);
  getScene(state); getScene(state); inspectItem(state, 'ring');
  assert.deepEqual(state, before);
  assert.equal(state.forestSteps, 3);
  assert.equal(choose(state, 'walk').forestSteps, 4);
});

test('进过旅馆后林路逐渐绕回门前，文字提示变化但不透露隐藏计数', () => {
  const earlyEntry = route('approach', 'enter', 'leave-inn', 'walk', 'walk');
  assert.equal(earlyEntry.scene, 'forest');
  assert.ok(getScene(earlyEntry).paragraphs.join('').includes('灯光也没有离远'));

  let state = route('walk', 'walk', 'walk', 'approach', 'enter', 'leave-inn');
  assert.ok(getScene(state).paragraphs.join('').includes('认得门内的暖意'));
  assert.equal(getScene(state).choices.find(choice => choice.id === 'walk').text, '沿来路试着离开');

  state = choose(state, 'walk');
  assert.equal(state.scene, 'forest');
  assert.ok(getScene(state).paragraphs.join('').includes('门前积雪'));
  assert.equal(getScene(state).choices.find(choice => choice.id === 'walk').text, '继续寻找出路');

  for (let count = 5; count <= 10; count++) state = choose(state, 'walk');
  assert.equal(state.scene, 'entrance');
  assert.equal(state.forestSteps, 10);
  state = choose(state, 'walk');
  assert.equal(state.scene, 'forest');
  assert.ok(getScene(state).paragraphs.join('').includes('跨进那扇门'));
  assert.equal(getScene(state).paragraphs.join('').includes('第 10 次'), false);

  state = choose(state, 'walk');
  assert.equal(state.scene, 'entrance');
  assert.notEqual(state.scene, 'escape');
  state = choose(state, 'walk');
  assert.equal(state.forestSteps, 13);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'walk'), false);
  assert.ok(getScene(state).paragraphs.join('').includes('试了太多次') || getScene(state).paragraphs.join('').includes('再踏上那条'));
  assert.equal(choose(state, 'walk'), state);
});

test('戒指只获得一次，投井后不能重新拾取', () => {
  const state = findRing();
  assert.deepEqual(state.inventory, ['ring']);
  assert.equal(choose(state, 'take-ring'), state);
  const dropped = ['approach', 'well', 'drop-ring', 'leave-well', 'ruins'].reduce(choose, state);
  assert.equal(dropped.inventory.includes('ring'), false);
  assert.equal(dropped.flags.ringFound, true);
  assert.equal(getScene(dropped).choices.some(choice => choice.id === 'rest'), false);
  const morning = choose(dropped, 'wait-morning');
  assert.equal(getScene(morning).choices.some(choice => choice.id === 'search-ring'), false);
});

test('碎木未移开前不能直接拿戒指，离开局部调查不会得到物品', () => {
  const covered = route('walk', 'walk', 'walk', 'rest');
  assert.equal(covered.scene, 'ringFind');
  assert.equal(choose(covered, 'take-ring'), covered);
  assert.deepEqual(covered.inventory, []);
  const returned = choose(covered, 'leave-ring');
  assert.deepEqual(returned.inventory, []);
  const uncovered = choose(covered, 'uncover-ring');
  assert.equal(uncovered.scene, 'ringUncovered');
  assert.deepEqual(uncovered.inventory, []);
  assert.deepEqual(choose(uncovered, 'take-ring').inventory, ['ring']);
});

test('银钥匙隔天才出现，重复查看水井不会重复获得', () => {
  let state = ['approach', 'well', 'drop-ring', 'look-well'].reduce(choose, findRing());
  assert.equal(state.ringDroppedOnDay, 1);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'pull-rope'), false);
  state = ['leave-well', 'ruins', 'wait-morning', 'approach', 'well', ...liftSilverKey].reduce(choose, state);
  assert.equal(state.day, 2);
  assert.deepEqual(state.inventory, ['silverKey']);
  state = ['leave-well', 'well'].reduce(choose, state);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'pull-rope'), false);
});

test('画像和门牌线索保留，重复调查不会复制画像', () => {
  let state = route('walk', 'walk', 'walk', 'wait-morning', 'house', 'ruins', 'house', 'ruins', 'doorplates');
  assert.equal(state.inventory.filter(item => item === 'portrait').length, 1);
  assert.equal(knownClues(state).length, 2);
  state = ['ruins', 'approach', 'enter'].reduce(choose, state);
  assert.ok(getScene(state).paragraphs.some(text => text.includes('眉眼')));
});

test('未持有戒指时无法投井，也不会让前台认出戒指', () => {
  const well = route('approach', 'well');
  assert.equal(choose(well, 'drop-ring'), well);
  const frontDesk = route('approach', 'enter');
  assert.equal(frontDesk.flags.emilySawRing, false);
  assert.equal(getScene(frontDesk).paragraphs.some(text => text.includes('讶异')), false);
});

test('戒指铭文需要在旅馆内主动查看，查看不推进故事或时间', () => {
  let state = findRing();
  assert.equal(inspectItem(state, 'ring'), state);
  state = ['approach', 'enter'].reduce(choose, state);
  assert.equal(state.flags.emilySawRing, true);
  assert.equal(state.flags.ringInscriptionRead, false);
  const inspected = inspectItem(state, 'ring');
  assert.equal(inspected.flags.ringInscriptionRead, true);
  assert.equal(inspected.scene, state.scene);
  assert.equal(inspected.day, state.day);
  assert.equal(inspected.forestSteps, state.forestSteps);
  assert.equal(state.flags.ringInscriptionRead, false);
});

test('新游戏独立重置全部探索状态', () => {
  const previous = findRing();
  const next = createGame();
  assert.equal(next.scene, 'arrival');
  assert.deepEqual(next.inventory, []);
  assert.equal(next.forestSteps, 0);
  assert.equal(next.flags.ringFound, false);
  assert.equal(previous.inventory.includes('ring'), true);
});

test('登记簿先显示空白退房栏，入住后查看才记录自己的名字', () => {
  let state = route('approach', 'enter', 'look-registry');
  assert.equal(state.flags.registrySeen, true);
  assert.equal(state.flags.ownEntrySeen, false);
  assert.ok(getScene(state).paragraphs.some(text => text.includes('退房日期')));
  state = ['start-check-in', 'finish-check-in'].reduce(choose, state);
  assert.equal(state.flags.checkedIn, true);
  assert.deepEqual(state.inventory, ['roomKey']);
  assert.equal(state.flags.ownEntrySeen, false);
  state = choose(state, 'look-registry');
  assert.equal(state.flags.ownEntrySeen, true);
  assert.ok(getScene(state).paragraphs.some(text => text.includes('你的名字')));
  assert.ok(knownClues(state).some(text => text.includes('你的名字')));
});

test('直接办理入住也能发现登记簿异常，钥匙不会重复领取', () => {
  let state = route('approach', 'enter', 'start-check-in');
  assert.equal(state.flags.registrySeen, true);
  assert.ok(getScene(state).paragraphs.some(text => text.includes('退房栏')));
  state = ['finish-check-in', 'back-reception', 'return-room'].reduce(choose, state);
  assert.equal(state.inventory.filter(item => item === 'roomKey').length, 1);
  assert.equal(state.scene, 'guestRoom');
});

test('第一夜调查隔壁再入睡，清晨可重访登记簿和旅馆外', () => {
  let state = route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'investigate', 'neighbor-door', 'enter-neighbor');
  assert.equal(state.flags.neighborRoomSeen, true);
  assert.ok(knownClues(state).some(text => text.includes('隔壁房门')));
  state = ['back-hallway', 'back-room', 'lie-down', 'sleep'].reduce(choose, state);
  assert.equal(state.scene, 'morningRoom');
  assert.equal(state.day, 2);
  assert.equal(state.time, 'morning');
  assert.equal(state.flags.firstNightSlept, true);
  state = ['go-reception', 'look-registry'].reduce(choose, state);
  assert.equal(state.flags.ownEntrySeen, true);
  state = ['back-reception', 'leave-inn', 'well'].reduce(choose, state);
  assert.equal(state.scene, 'well');
});

test('旅馆过夜也能让前一天投井的戒指在井绳处得到反馈', () => {
  let state = ['approach', 'well', 'drop-ring', 'leave-well', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-outside', 'well'].reduce(choose, findRing());
  assert.equal(state.flags.emilySawRing, false);
  assert.equal(state.day, 2);
  assert.ok(getScene(state).choices.some(choice => choice.id === 'pull-rope'));
  state = liftSilverKey.reduce(choose, state);
  assert.deepEqual(state.inventory, ['roomKey', 'silverKey']);
});

test('清晨抵达后经前台回客房，第一夜仍从当晚开始', () => {
  const state = route('walk', 'walk', 'walk', 'wait-morning', 'approach', 'enter', 'start-check-in', 'finish-check-in', 'back-reception', 'return-room');
  assert.equal(state.day, 2);
  assert.equal(state.time, 'night');
  assert.equal(state.scene, 'guestRoom');
});

const afterFirstNight = () => route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-reception');
function solveWardrobe(state) {
  for (let slot = 0; slot < ENDPOINT_COUNT; slot++) {
    const desired = Math.floor(slot / 2);
    if (state.cordOrder[slot] === desired) continue;
    const other = state.cordOrder.findIndex((cord, index) => index > slot && cord === desired);
    state = moveCord(state, slot, other);
  }
  assert.equal(cordsUntangled(state.cordOrder), true);
  return state;
}

test('吃早餐只增加一次内部融合值，之后仍能查看登记簿', () => {
  let state = ['breakfast-offer', 'accept-breakfast', 'inspect-food', 'eat-breakfast'].reduce(choose, afterFirstNight());
  assert.equal(state.breakfast, 'eaten');
  assert.equal(state.fusion, 1);
  assert.ok(knownClues(state).some(text => text.includes('颜色和气味')));
  state = choose(state, 'back-reception');
  assert.equal(getScene(state).choices.some(choice => choice.id === 'breakfast-offer'), false);
  state = choose(state, 'look-registry');
  assert.equal(state.flags.ownEntrySeen, true);
  assert.equal(state.fusion, 1);
});

test('婉拒或假装吃下早餐均不融合，柜台抽屉可取得一次旧账本', () => {
  for (const response of [['decline-breakfast'], ['accept-breakfast', 'pretend-breakfast']]) {
    let state = ['breakfast-offer', ...response, 'back-reception', 'search-desk'].reduce(choose, afterFirstNight());
    assert.equal(state.fusion, 0);
    assert.equal(state.inventory.filter(item => item === 'oldLedger').length, 1);
    assert.ok(knownClues(state).some(text => text.includes('猪肉香肠')));
    state = choose(state, 'back-reception');
    assert.equal(getScene(state).choices.some(choice => choice.id === 'search-desk'), false);
    assert.equal(getScene(state).choices.some(choice => choice.id === 'look-registry'), true);
  }
});

test('第一夜后的走廊和厨房门口可安全折返，探索不推进时间', () => {
  let state = afterFirstNight();
  const day = state.day;
  state = ['ground-hall', 'kitchen-threshold', 'back-ground-hall', 'back-reception'].reduce(choose, state);
  assert.equal(state.scene, 'reception');
  assert.equal(state.day, day);
  assert.equal(state.breakfast, 'unresolved');
  assert.ok(getScene(state).choices.some(choice => choice.id === 'breakfast-offer'));
});

test('隔壁衣柜白天才可搜寻，古铜色钥匙只取得一次', () => {
  let night = route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'investigate', 'neighbor-door', 'enter-neighbor');
  assert.equal(getScene(night).choices.some(choice => choice.id === 'search-wardrobe'), false);
  night = ['back-hallway', 'back-room', 'lie-down', 'sleep', 'investigate', 'neighbor-door', 'enter-neighbor', 'search-wardrobe'].reduce(choose, night);
  assert.deepEqual(night.inventory, ['roomKey']);
  assert.equal(choose(night, 'take-bronze-key'), night);
  assert.equal(choose(night, 'untangle-wardrobe'), night);
  night = solveWardrobe(night);
  night = ['untangle-wardrobe', 'take-bronze-key'].reduce(choose, night);
  assert.deepEqual(night.inventory, ['roomKey', 'bronzeKey']);
  night = ['back-neighbor', 'back-hallway', 'back-room', 'go-reception'].reduce(choose, night);
  assert.equal(night.scene, 'reception');
  night = ['breakfast-offer', 'decline-breakfast', 'back-reception'].reduce(choose, night);
  assert.equal(getScene(night).choices.some(choice => choice.id === 'inspect-cabinet'), true);
});

test('古铜色钥匙开前台锁柜，合影与画像的关联取决于已知线索', () => {
  let state = afterFirstNight();
  state = ['breakfast-offer', 'decline-breakfast', 'back-reception', 'inspect-cabinet'].reduce(choose, state);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'unlock-cabinet'), false);
  state = ['back-reception', 'return-room', 'investigate', 'neighbor-door', 'enter-neighbor', 'search-wardrobe'].reduce(choose, state);
  state = solveWardrobe(state);
  state = ['untangle-wardrobe', 'take-bronze-key', 'back-neighbor', 'back-hallway', 'back-room', 'go-reception', 'inspect-cabinet', 'unlock-cabinet'].reduce(choose, state);
  assert.equal(state.inventory.filter(item => item === 'adultPhoto').length, 1);
  assert.equal(getScene(state).paragraphs.some(text => text.includes('画像中的小女孩')), false);
  state = ['back-reception', 'inspect-cabinet'].reduce(choose, state);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'unlock-cabinet'), false);
  assert.ok(knownClues(state).some(text => text.includes('合影背面')));
});

test('银白色钥匙可开启地下室并到达水边，无钥匙时只能折返', () => {
  const morning = afterFirstNight();
  let locked = ['ground-hall', 'basement-door'].reduce(choose, morning);
  assert.equal(getScene(locked).choices.some(choice => choice.id === 'unlock-basement'), false);
  assert.equal(choose(locked, 'unlock-basement'), locked);
  let state = ['approach', 'well', 'drop-ring', 'leave-well', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-reception', 'ground-hall', 'basement-door'].reduce(choose, findRing());
  assert.equal(getScene(state).choices.some(choice => choice.id === 'unlock-basement'), false);
  state = ['back-ground-hall', 'back-reception', 'leave-inn', 'well', ...liftSilverKey, 'leave-well', 'enter', 'ground-hall', 'basement-door', 'unlock-basement', 'descend'].reduce(choose, state);
  assert.equal(state.scene, 'basementShore');
  assert.equal(state.flags.basementUnlocked, true);
  assert.equal(state.inventory.includes('silverKey'), true);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'back-basement-stairs'), true);
});

test('清晨投井可通过后续过夜等到银钥匙，安心睡眠只增加一次融合', () => {
  let state = ['wait-morning', 'approach', 'well', 'drop-ring', 'leave-well', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-reception', 'breakfast-offer', 'decline-breakfast', 'back-reception', 'return-room'].reduce(choose, findRing());
  assert.equal(state.day, 3);
  assert.equal(state.ringDroppedOnDay, 2);
  state = choose(state, 'rest-another-night');
  assert.equal(state.day, 4);
  assert.equal(state.fusion, 1);
  state = choose(state, 'rest-another-night');
  assert.equal(state.day, 5);
  assert.equal(state.fusion, 1);
  state = ['go-outside', 'well'].reduce(choose, state);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'pull-rope'), true);
});

function atBasementShore(emilySawRing) {
  let state = findRing();
  const beforeDrop = emilySawRing ? ['approach', 'enter', 'leave-inn', 'well'] : ['approach', 'well'];
  state = [...beforeDrop, 'drop-ring', 'leave-well', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-outside', 'well', ...liftSilverKey, 'leave-well', 'enter', 'ground-hall', 'basement-door', 'unlock-basement', 'descend'].reduce(choose, state);
  assert.equal(state.scene, 'basementShore');
  assert.equal(state.flags.emilySawRing, emilySawRing);
  assert.equal(state.inventory.includes('ring'), false);
  return state;
}

test('沿墙调查能发现肉墙、石柱与龙头，并带线索回前台追问', () => {
  let state = ['wade', 'look-hole', 'follow-wall', 'inspect-pillar', 'back-flesh', 'inspect-tap', 'back-flesh', 'back-passage', 'back-shore', 'back-basement-stairs', 'back-basement-door', 'back-ground-hall', 'back-reception'].reduce(choose, atBasementShore(false));
  assert.equal(state.scene, 'reception');
  assert.equal(state.flags.basementTruthSeen, true);
  assert.equal(state.flags.pillarExamined, true);
  assert.equal(state.flags.tapExamined, true);
  assert.ok(knownClues(state).some(text => text.includes('肉瘤')));
  assert.ok(getScene(state).choices.some(choice => choice.id === 'confront-basement'));
  state = ['confront-basement', 'press-emily'].reduce(choose, state);
  assert.equal(state.flags.emilyAdmittedHouse, true);
  assert.ok(knownClues(state).some(text => text.includes('以前不是它的')));
});

test('戒指在进旅馆前投井，水下无救援并进入正式结局', () => {
  let state = ['wade', 'look-hole', 'jump', 'seek-air'].reduce(choose, atBasementShore(false));
  assert.equal(state.scene, 'drownedEnding');
  assert.ok(getScene(state).ending);
  assert.equal(getScene(state).choices.length, 0);
  assert.equal(choose(state, 'seek-air'), state);
});

test('前台曾见戒指即可在水下获救，即使戒指已投入井中', () => {
  let state = atBasementShore(true);
  assert.equal(state.inventory.includes('ring'), false);
  assert.equal(getScene(state).paragraphs.some(text => text.includes('戒指')), false);
  const day = state.day;
  state = ['wade', 'look-hole', 'jump', 'seek-air'].reduce(choose, state);
  assert.equal(state.scene, 'underwaterRescue');
  state = choose(state, 'wake');
  assert.equal(state.scene, 'recoveryRoom');
  assert.equal(state.day, day + 1);
  assert.equal(state.fusion, 2);
  assert.equal(state.flags.rescuedFromBasement, true);
  state = choose(state, 'go-reception');
  assert.ok(getScene(state).choices.some(choice => choice.id === 'ask-rescue'));
  assert.equal(getScene(state).paragraphs.some(text => text.includes('你手里的戒指')), false);
});

test('救援后的融合变化不超过上限，跳洞前可沿原路返回', () => {
  let state = atBasementShore(true);
  state = ['wade', 'look-hole', 'back-passage', 'back-shore'].reduce(choose, state);
  assert.equal(state.scene, 'basementShore');
  state = ['wade', 'look-hole', 'jump', 'seek-air'].reduce(choose, state);
  state = { ...state, fusion: 5 };
  state = choose(state, 'wake');
  assert.equal(state.fusion, 6);
});

function backFromBasement(emilySawRing = false) {
  return ['wade', 'look-hole', 'follow-wall', 'back-passage', 'back-shore', 'back-basement-stairs', 'back-basement-door', 'back-ground-hall', 'back-reception'].reduce(choose, atBasementShore(emilySawRing));
}

test('无可选证物也能听完婚礼与旅馆真相，填写退房日期离开', () => {
  let state = backFromBasement();
  assert.equal(state.inventory.includes('oldLedger'), false);
  assert.equal(state.inventory.includes('adultPhoto'), false);
  state = ['confront-basement', 'press-emily', 'continue-truth'].reduce(choose, state);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'ask-inn'), false);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'ask-edward'), false);
  state = ['ask-wedding', 'what-after-wedding', 'ask-why-stay', 'back-dialogue'].reduce(choose, state);
  assert.equal(state.flags.weddingStoryHeard, true);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'ask-inn'), true);
  state = ['ask-inn', 'ask-leave-now', 'open-registry'].reduce(choose, state);
  assert.equal(state.flags.checkoutHintSeen, true);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'write-checkout'), true);
  state = choose(state, 'write-checkout');
  assert.equal(state.flags.checkedOut, true);
  assert.equal(state.scene, 'checkoutEnding');
  assert.ok(getScene(state).ending);
  assert.equal(getScene(state).choices.length, 0);
  assert.ok(knownClues(state).some(text => text.includes('退房日期')));
});

test('谈话前登记簿不能退房，旧戒指投井后追问爱德华不会凭空拿出戒指', () => {
  let state = backFromBasement(true);
  state = choose(state, 'look-registry');
  assert.equal(getScene(state).choices.some(choice => choice.id === 'write-checkout'), false);
  state = ['back-reception', 'confront-basement', 'press-emily', 'continue-truth', 'ask-wedding', 'what-after-wedding', 'ask-why-stay', 'back-dialogue', 'ask-edward'].reduce(choose, state);
  const answer = getScene(state).paragraphs.join('');
  assert.ok(answer.includes('银白色钥匙'));
  assert.equal(answer.includes('把戒指放到柜台上'), false);
  state = ['back-dialogue', 'back-reception', 'confront-basement'].reduce(choose, state);
  assert.equal(state.scene, 'truthHub');
});

test('融合程度较高时仍能退房，只改变文字感受', () => {
  let state = backFromBasement();
  state = { ...state, fusion: 6 };
  state = ['confront-basement', 'press-emily', 'continue-truth', 'ask-wedding', 'what-after-wedding', 'ask-why-stay', 'back-dialogue', 'ask-inn', 'ask-leave-now', 'open-registry'].reduce(choose, state);
  assert.ok(getScene(state).paragraphs.join('').includes('不舍'));
  state = choose(state, 'write-checkout');
  assert.equal(state.scene, 'checkoutEnding');
});

function atDeepRecovery() {
  let state = atBasementShore(true);
  state = follow(state, 'back-basement-stairs', 'back-basement-door', 'back-ground-hall', 'back-reception', 'breakfast-offer', 'accept-breakfast', 'eat-breakfast', 'back-reception', 'return-room', 'rest-another-night');
  assert.equal(state.fusion, 2);
  state = follow(state, 'go-reception', 'ground-hall', 'basement-door', 'enter-basement', 'descend', 'wade', 'look-hole', 'jump', 'seek-air', 'wake');
  assert.equal(state.scene, 'recoveryRoom');
  assert.equal(state.fusion, 4);
  return state;
}

test('高融合前台结局可由正常选择抵达，也能在坐下前退回大厅', () => {
  let state = atDeepRecovery();
  assert.equal(getScene(state).choices.some(choice => choice.id === 'stay-one-more-night'), true);
  state = follow(state, 'stay-one-more-night', 'wake-after-stay');
  assert.equal(state.fusion, 5);
  assert.equal(state.flags.choseToStay, true);
  assert.equal(getScene(state).choices.some(choice => choice.id === 'approach-empty-desk'), true);
  state = follow(state, 'approach-empty-desk', 'step-away-desk');
  assert.equal(state.scene, 'reception');
  state = follow(state, 'approach-empty-desk', 'sit-behind-desk');
  assert.ok(getScene(state).paragraphs.join('').includes('还有空房吗'));
  state = follow(state, 'answer-guest');
  assert.equal(state.scene, 'innkeeperEnding');
  assert.ok(getScene(state).paragraphs.join('').endsWith('“……当然。”'));
  assert.ok(getScene(state).ending);
  assert.equal(getScene(state).choices.length, 0);
});

test('一次获救后再跳水只会进入溺水结局，融合不会重复增加', () => {
  let state = follow(atBasementShore(true), 'wade', 'look-hole', 'jump', 'seek-air', 'wake');
  assert.equal(state.fusion, 2);
  state = follow(state, 'go-reception', 'ground-hall', 'basement-door', 'enter-basement', 'descend', 'wade', 'look-hole');
  assert.ok(getScene(state).paragraphs.join('').includes('还会不会出现'));
  state = follow(state, 'jump', 'seek-air');
  assert.equal(state.scene, 'drownedEnding');
  assert.equal(state.fusion, 2);
});

test('高融合时仍可沿真相对话退房，身份疑问保留原设计的回答', () => {
  let state = follow(atDeepRecovery(), 'stay-one-more-night', 'wake-after-stay');
  state = follow(state, 'ground-hall', 'basement-door', 'enter-basement', 'descend', 'wade', 'follow-wall', 'back-passage', 'back-shore', 'back-basement-stairs', 'back-basement-door', 'back-ground-hall', 'back-reception', 'confront-basement', 'press-emily', 'continue-truth', 'ask-identity', 'ask-if-emily');
  assert.ok(getScene(state).paragraphs.join('').includes('那我算不算她'));
  state = follow(state, 'back-dialogue', 'ask-wedding', 'what-after-wedding', 'ask-why-stay', 'back-dialogue', 'ask-inn', 'ask-leave-now', 'open-registry', 'write-checkout');
  assert.equal(state.scene, 'checkoutEnding');
  assert.ok(getScene(state).ending);
});

test('拒绝进入旅馆时外观逐步衰老，晚进门能看见内外矛盾', () => {
  let state = createGame();
  state = follow(state, 'walk', 'walk');
  assert.ok(getScene(state).paragraphs.join('').includes('漆面'));
  state = follow(state, 'walk', 'walk', 'walk');
  assert.ok(getScene(state).paragraphs.join('').includes('招牌褪了色'));
  state = follow(state, 'approach');
  assert.ok(getScene(state).paragraphs.join('').includes('招牌上的字迹'));
  state = follow(state, 'enter');
  assert.ok(getScene(state).paragraphs.join('').includes('室内的木框'));
});

test('见过多次外观变化后可一次决定继续赶路，不必反复点击到第十次', () => {
  let state = route('walk', 'walk', 'walk', 'walk', 'walk');
  assert.equal(state.scene, 'forest');
  assert.equal(getScene(state).choices.some(choice => choice.id === 'keep-walking'), true);
  state = follow(state, 'keep-walking');
  assert.equal(state.scene, 'escape');
  assert.ok(getScene(state).paragraphs.join('').includes('更旧一些'));
  const entered = route('approach', 'enter', 'leave-inn', 'walk', 'walk', 'walk', 'walk', 'walk');
  assert.equal(getScene(entered).choices.some(choice => choice.id === 'keep-walking'), false);
});

test('隔壁房间的水可观察并喝一次，水井与地下室保留感官呼应', () => {
  let state = route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'investigate', 'neighbor-door', 'enter-neighbor');
  assert.ok(getScene(state).paragraphs.join('').includes('没有看见人'));
  state = follow(state, 'inspect-neighbor-water');
  assert.equal(state.flags.neighborWaterSeen, true);
  state = follow(state, 'drink-neighbor-water');
  assert.equal(state.flags.neighborWaterDrank, true);
  assert.ok(getScene(state).paragraphs.join('').includes('铁味'));
  state = follow(state, 'leave-neighbor-water', 'inspect-neighbor-water');
  assert.equal(getScene(state).choices.some(choice => choice.id === 'drink-neighbor-water'), false);
  state = follow(state, 'leave-neighbor-water', 'back-hallway', 'back-room', 'back-reception', 'leave-inn', 'well');
  assert.ok(getScene(state).paragraphs.join('').includes('隔壁'));
  assert.ok(getScene({ ...state, scene: 'basementShore' }).paragraphs.join('').includes('凉涩'));
});

test('第一夜可循声进入原设计厨房，早餐与野猪形成矛盾', () => {
  let state = route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'investigate', 'follow-night-sound', 'kitchen-threshold');
  assert.equal(state.scene, 'nightKitchen');
  assert.ok(getScene(state).paragraphs.join('').includes('半只剥了皮的野猪'));
  state = follow(state, 'greet-night-kitchen', 'ask-night-meat', 'leave-night-kitchen', 'back-hallway', 'back-room', 'lie-down', 'sleep', 'go-reception', 'breakfast-offer', 'accept-breakfast', 'inspect-food', 'eat-breakfast');
  assert.ok(getScene(state).paragraphs.join('').includes('鹿肉'));
  assert.ok(knownClues(state).some(text => text.includes('野猪对不上')));
  const dialogue = { ...state, scene: 'truthHub' };
  assert.equal(getScene(dialogue).choices.some(choice => choice.id === 'ask-kitchen'), true);
  assert.ok(getScene(choose(dialogue, 'ask-kitchen')).paragraphs.join('').includes('你昨夜真的来过'));
});

test('旧宴会厅位于厨房旁，夜间只能观察，白天可调查并提出矛盾', () => {
  let state = route('approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'investigate', 'follow-night-sound', 'banquet-door');
  assert.equal(getScene(state).choices.some(choice => choice.id === 'enter-banquet'), false);
  state = follow(state, 'back-night-kitchen', 'peek-banquet-door');
  assert.equal(state.scene, 'banquetDoor');
  state = follow(state, 'back-ground-hall', 'back-hallway', 'back-room', 'lie-down', 'sleep', 'go-reception', 'breakfast-offer', 'decline-breakfast', 'ground-hall', 'banquet-door', 'enter-banquet', 'inspect-banquet-table', 'back-banquet', 'listen-banquet');
  assert.ok(getScene(state).paragraphs.join('').includes('先把门打开'));
  assert.equal(state.flags.banquetTableSeen, true);
  assert.equal(state.flags.banquetEchoHeard, true);
  state = follow(state, 'back-banquet', 'through-kitchen-side', 'through-banquet-side', 'back-banquet-door', 'back-ground-hall');
  assert.ok(getScene(state).paragraphs.join('').includes('厨房旁'));
  const dialogue = { ...state, scene: 'truthHub' };
  assert.equal(getScene(dialogue).choices.some(choice => choice.id === 'ask-banquet'), true);
  assert.ok(getScene(choose(dialogue, 'ask-banquet')).paragraphs.join('').includes('先把门打开'));
  const tableOnly = { ...dialogue, flags: { ...dialogue.flags, banquetEchoHeard: false } };
  assert.equal(getScene(choose(tableOnly, 'ask-banquet')).paragraphs.join('').includes('先把门打开'), false);
});

test('地下室的残缺对话不直接揭示说话者身份', () => {
  let state = follow(atBasementShore(false), 'wade', 'follow-wall', 'listen-wall');
  assert.equal(state.flags.basementVoiceHeard, true);
  assert.equal(getScene(state).paragraphs.join('').includes('爱德华'), false);
  state = follow(state, 'answer-wall-voice');
  assert.ok(getScene(state).paragraphs.join('').includes('后半句话被水声盖住'));
  assert.equal(getScene(state).paragraphs.join('').includes('爱德华'), false);
});
