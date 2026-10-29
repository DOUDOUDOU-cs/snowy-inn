import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';
import { choose, getScene } from '../src/game/engine.ts';
import { artForScene, sceneArtwork } from '../src/ui/sceneArt.ts';

test('全部剧情场景都对应本地场景图，且有可读的环境描述', () => {
  for (const scene of Object.keys(openingScenes)) {
    assert.ok(sceneArtwork[scene], `${scene} 缺少场景图映射`);
    const art = artForScene({ ...createGame(), scene });
    assert.ok(existsSync(join(process.cwd(), 'public', art.src.slice(1))), `${scene} 图片文件不存在`);
    assert.ok(art.alt.length > 12);
    assert.ok(art.caption.length > 4);
  }
});

function follow(state, ...choices) {
  return choices.reduce((current, id) => {
    assert.ok(getScene(current).choices.some(choice => choice.id === id), `${current.scene} 没有可用的 ${id}`);
    return choose(current, id);
  }, state);
}

test('夜间门前近景与林中远景区分，进入后返回门前恢复原外观', () => {
  const start = createGame();
  const early = artForScene({ ...start, scene: 'forest', forestSteps: 2 });
  const aged = artForScene({ ...start, scene: 'forest', forestSteps: 8 });
  const inside = artForScene({ ...start, scene: 'reception', forestSteps: 8, flags: { ...start.flags, enteredInn: true } });
  const returned = artForScene({ ...start, scene: 'entrance', forestSteps: 8, flags: { ...start.flags, enteredInn: true } });
  assert.equal(early.age, 1);
  assert.equal(aged.age, 3);
  assert.notEqual(aged.src, early.src);
  assert.ok(existsSync(join(process.cwd(), 'public', aged.src.slice(1))));
  assert.equal(inside.age, 0);
  assert.equal(returned.age, 0);
  assert.equal(returned.src, '/scenes/inn-entrance.webp');
  assert.notEqual(returned.src, artForScene(start).src);
  const entrance = follow(start, 'approach');
  assert.equal(artForScene(entrance).src, returned.src);
  assert.equal(artForScene(follow(entrance, 'enter')).src, '/scenes/reception-attended.webp');
});

test('清晨室外图保留衰老结构，进入后返回只重置衰老，不重置时间', () => {
  let state = follow(createGame(), 'walk', 'walk', 'walk', 'walk', 'walk', 'approach');
  assert.equal(artForScene(state).src, '/scenes/forest-inn-aged.webp');
  state = follow(state, 'ruins', 'wait-morning', 'approach');
  assert.equal(state.time, 'morning');
  assert.equal(artForScene(state).src, '/scenes/forest-inn-aged-morning.webp');
  assert.equal(artForScene(state).age, 2);
  state = follow(state, 'enter', 'leave-inn');
  assert.equal(artForScene(state).src, '/scenes/forest-inn-morning.webp');
  assert.equal(artForScene(state).age, 0);
  assert.equal(artForScene(follow(state, 'well')).src, '/scenes/well-morning.webp');
});

test('前台人物随真实接待、早餐离柜与回归剧情切换', () => {
  const reception = follow(createGame(), 'approach', 'enter');
  const morning = follow(reception, 'start-check-in', 'finish-check-in', 'go-room', 'lie-down', 'sleep', 'go-reception');
  assert.equal(artForScene(reception).src, '/scenes/reception-attended.webp');
  assert.equal(artForScene(morning).src, '/scenes/reception-attended.webp');
  for (const breakfast of ['decline-breakfast', 'eat-breakfast', 'pretend-breakfast']) {
    let state = follow(morning, 'breakfast-offer');
    if (breakfast !== 'decline-breakfast') state = follow(state, 'accept-breakfast');
    state = follow(state, breakfast);
    assert.equal(artForScene(state).src, '/scenes/reception.webp', `${breakfast} 后前台应已离开`);
    state = follow(state, 'back-reception');
    assert.equal(artForScene(state).src, '/scenes/reception.webp');
    for (const flag of ['basementTruthSeen', 'rescuedFromBasement']) {
      assert.equal(artForScene({ ...state, flags: { ...state.flags, [flag]: true } }).src, '/scenes/reception-attended.webp');
    }
  }
});

test('留宿离柜优先于救援和真相，不把前台小姐放在空柜台结局中', () => {
  const start = createGame();
  const state = { ...start, scene: 'reception', fusion: 5, flags: { ...start.flags, checkedIn: true, firstNightSlept: true, choseToStay: true, basementTruthSeen: true, rescuedFromBasement: true } };
  assert.equal(artForScene(state).src, '/scenes/reception.webp');
  for (const scene of ['emptyDesk', 'newGuest', 'innkeeperEnding']) {
    assert.equal(artForScene({ ...state, scene }).src, '/scenes/reception.webp');
  }
  assert.equal(artForScene(follow(state, 'confront-basement')).src, '/scenes/reception-attended.webp');
});

test('两幅肖像与成人合影只在实际调查节点显示，不因已获得线索污染环境图', () => {
  let state = follow(createGame(), 'walk', 'walk', 'walk', 'wait-morning');
  assert.equal(artForScene(state).src, '/scenes/ruins.webp');
  state = follow(state, 'house');
  assert.equal(artForScene(state).src, '/scenes/ruins-family-portrait.webp');
  state = follow(state, 'ruins', 'approach', 'enter');
  assert.equal(artForScene(state).src, '/scenes/reception-attended.webp');
  state = follow(state, 'look-hall-portrait');
  assert.equal(artForScene(state).src, '/scenes/hall-portrait.webp');
  state = follow(state, 'back-reception');
  assert.equal(artForScene(state).src, '/scenes/reception-attended.webp');
  const cabinet = { ...state, scene: 'cabinet', inventory: [...state.inventory, 'bronzeKey'] };
  assert.equal(artForScene(cabinet).src, '/scenes/reception.webp');
  assert.equal(artForScene(follow(cabinet, 'unlock-cabinet')).src, '/scenes/adult-photo.webp');
  assert.equal(artForScene({ ...cabinet, inventory: [...cabinet.inventory, 'adultPhoto'] }).src, '/scenes/reception.webp');
});

test('肉墙必须走到深处才显示，已调查过也不让入口和水道泄露细节', () => {
  const start = createGame();
  const passage = { ...start, scene: 'floodedPassage' };
  assert.equal(artForScene(passage).src, '/scenes/basement.webp');
  const flesh = follow(passage, 'follow-wall');
  assert.equal(artForScene(flesh).src, '/scenes/basement-flesh.webp');
  for (const scene of ['basementStairs', 'basementShore', 'floodedPassage', 'drainHole']) {
    assert.equal(artForScene({ ...flesh, scene }).src, '/scenes/basement.webp');
  }
  assert.equal(artForScene(follow(flesh, 'back-passage')).src, '/scenes/basement.webp');
});

test('跳入水道后画面转入暗水，救援与溺亡不显示陆上台阶或人物身份', () => {
  const start = createGame();
  const hole = { ...start, scene: 'drainHole' };
  const underwater = follow(hole, 'jump');
  assert.equal(artForScene(underwater).src, '/scenes/basement-underwater.webp');
  assert.notEqual(artForScene(underwater).src, artForScene(hole).src);
  const drowned = follow(underwater, 'seek-air');
  assert.equal(drowned.scene, 'drownedEnding');
  assert.equal(artForScene(drowned).src, '/scenes/basement-underwater.webp');
  const rescued = follow({ ...underwater, flags: { ...underwater.flags, emilySawRing: true } }, 'seek-air');
  assert.equal(rescued.scene, 'underwaterRescue');
  assert.equal(artForScene(rescued).src, '/scenes/basement-underwater.webp');
});

test('进入宴会厅后使用可见杯印与拖痕的画面，门外不先暴露调查特写', () => {
  const start = createGame();
  const door = { ...start, scene: 'banquetDoor', flags: { ...start.flags, firstNightSlept: true } };
  const hall = follow(door, 'enter-banquet');
  assert.equal(artForScene(door).src, '/scenes/ground-hall.webp');
  assert.equal(artForScene(hall).src, '/scenes/banquet-hall-observed.webp');
  assert.equal(artForScene(follow(hall, 'inspect-banquet-table')).src, artForScene(hall).src);
});

test('第一夜走近虚掩房门仍显示暗长廊，入房才显示水杯和衣柜，睡后使用原长廊', () => {
  const guestRoom = follow(createGame(), 'approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room');
  const hallway = follow(guestRoom, 'investigate');
  assert.equal(artForScene(hallway).src, '/scenes/upstairs-hall-night.webp');
  const door = follow(hallway, 'neighbor-door');
  assert.equal(artForScene(door).src, artForScene(hallway).src);
  assert.doesNotMatch(artForScene(door).alt, /水杯|半杯水|衣柜/u);
  const neighborRoom = follow(door, 'enter-neighbor');
  assert.equal(artForScene(neighborRoom).src, '/scenes/neighbor-room-night.webp');
  assert.notEqual(artForScene(neighborRoom).src, artForScene(door).src);
  const morningHall = follow(guestRoom, 'lie-down', 'sleep', 'investigate');
  assert.equal(artForScene(morningHall).src, '/scenes/upstairs-hall.webp');
  assert.equal(artForScene(follow(morningHall, 'neighbor-door')).src, '/scenes/upstairs-hall.webp');
});

test('夜间厨房有制作香肠的人，清晨台面清理；第一夜隔壁房没有亮灯', () => {
  let state = follow(createGame(), 'approach', 'enter', 'start-check-in', 'finish-check-in', 'go-room', 'investigate', 'neighbor-door', 'enter-neighbor');
  assert.equal(artForScene(state).src, '/scenes/neighbor-room-night.webp');
  state = follow(state, 'back-hallway', 'follow-night-sound', 'kitchen-threshold');
  assert.equal(artForScene(state).src, '/scenes/night-kitchen-attended-v2.webp');
  const morning = { ...state, scene: 'groundHall', time: 'morning', flags: { ...state.flags, firstNightSlept: true } };
  assert.equal(artForScene(follow(morning, 'kitchen-threshold')).src, '/scenes/kitchen-morning-v2.webp');
  assert.equal(artForScene({ ...morning, scene: 'neighborRoom' }).src, '/scenes/neighbor-room.webp');
});

test('早餐接受之后才显示餐盘，登记簿只在翻看和填写时显示', () => {
  const start = createGame();
  const offer = { ...start, scene: 'breakfastOffer' };
  assert.equal(artForScene(offer).src, '/scenes/reception-attended.webp');
  const plate = follow(offer, 'accept-breakfast');
  assert.equal(artForScene(plate).src, '/scenes/breakfast-detail.webp');
  assert.equal(artForScene(follow(plate, 'inspect-food')).src, '/scenes/breakfast-detail.webp');
  const reception = follow(start, 'approach', 'enter');
  assert.equal(artForScene(reception).src, '/scenes/reception-attended.webp');
  assert.equal(artForScene(follow(reception, 'look-registry')).src, '/scenes/registry-detail.webp');
  assert.equal(artForScene(follow(reception, 'start-check-in')).src, '/scenes/registry-detail.webp');
});

test('图片读取无副作用，所有状态变体都只引用离线素材', () => {
  const start = createGame();
  for (const scene of Object.keys(openingScenes)) {
    for (const time of ['night', 'morning']) {
      for (const enteredInn of [false, true]) {
        const state = { ...start, scene, time, forestSteps: 8, flags: { ...start.flags, enteredInn } };
        const before = structuredClone(state);
        const art = artForScene(state);
        assert.deepEqual(state, before);
        assert.match(art.src, /^\/scenes\/[a-z0-9-]+\.webp$/);
        assert.ok(existsSync(join(process.cwd(), 'public', art.src.slice(1))), `${scene} ${time} 变体 ${art.src} 不存在`);
      }
    }
  }
});
