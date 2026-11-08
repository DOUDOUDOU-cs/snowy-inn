import test from 'node:test';
import assert from 'node:assert/strict';
import { openingScenes } from '../src/story/opening.ts';
import { createGame } from '../src/game/state.ts';
import { choose, getScene } from '../src/game/engine.ts';
import { artForScene } from '../src/ui/sceneArt.ts';
import { presentationForScene } from '../src/ui/scenePresentation.ts';
import { layoutScene, hotspotLabel } from '../src/ui/sceneLayout.ts';

const layoutOf = state => {
  const scene = getScene(state);
  const frame = presentationForScene(state, scene, artForScene(state));
  return { scene, layout: layoutScene(frame.mode, frame.groups) };
};
const idsIn = layout => ({
  hotspots: layout.hotspots.flatMap(spot => spot.group.choices.map(choice => choice.id)),
  edges: layout.edges.flatMap(edge => edge.group.choices.map(choice => choice.id)),
  options: layout.options.map(option => option.choice.id),
});

test('每个节点的每个可用选择恰好以一种方式出现：物体、出口或选项', () => {
  const base = createGame();
  const variants = [base.flags, { ...base.flags, checkedIn: true, firstNightSlept: true },
    Object.fromEntries(Object.keys(base.flags).map(flag => [flag, true]))];
  for (const scene of Object.keys(openingScenes)) {
    for (const flags of variants) for (const time of ['night', 'morning']) {
      const state = { ...base, scene, flags, time, day: 2, inventory: ['ring', 'silverKey', 'bronzeKey', 'roomKey'], forestSteps: 5 };
      const { scene: authored, layout } = layoutOf(state);
      const shown = Object.values(idsIn(layout)).flat().sort();
      assert.deepEqual(shown, authored.choices.map(choice => choice.id).sort(), `${scene}/${time}`);
    }
  }
});

test('门前：木门、水井和来路都是画中的东西，遗迹在画外左侧', () => {
  // The ruins path only exists once the player has wandered the forest a few times.
  const entrance = { ...choose(createGame(), 'approach'), forestSteps: 3 };
  const { layout } = layoutOf(entrance);
  assert.deepEqual(idsIn(layout).hotspots.sort(), ['enter', 'walk', 'well'].sort());
  assert.deepEqual(layout.edges.map(edge => [edge.group.id, edge.side]), [['ruins-road', 'left']]);
  assert.deepEqual(layout.options, []);
  // A single action names itself on hover, so the click does what the label says.
  const door = layout.hotspots.find(spot => spot.group.id === 'inn-door');
  assert.equal(hotspotLabel(door.group), '进入旅馆');
});

test('交谈时人物的话题成为文字选项，物体和出口仍在画面里', () => {
  const base = createGame();
  const hub = { ...base, scene: 'truthHub', flags: { ...base.flags, checkedIn: true, emilyAdmittedHouse: true } };
  const { scene, layout } = layoutOf(hub);
  const talk = scene.choices.filter(choice => choice.id.startsWith('ask-')).map(choice => choice.id);
  assert.ok(talk.length >= 2);
  assert.deepEqual(idsIn(layout).options.filter(id => id.startsWith('ask-')), talk, '话题保持作者顺序');
  assert.ok(layout.hotspots.every(spot => spot.group.kind !== 'person'));
  assert.ok(idsIn(layout).edges.includes('back-reception'));
});

test('探索时前台小姐本人可点；小物件排在大物件之后，叠在上层可点到', () => {
  const reception = choose(choose(createGame(), 'approach'), 'enter');
  const { layout } = layoutOf(reception);
  const order = layout.hotspots.map(spot => spot.group.id);
  assert.ok(order.includes('front-desk'));
  assert.ok(order.indexOf('registry') > order.indexOf('front-desk'), '登记簿压在人物热区之上');
  const areas = layout.hotspots.map(spot => spot.w * spot.h);
  assert.deepEqual(areas, [...areas].sort((a, b) => b - a));
});

test('旁白避开热区更多的一侧', () => {
  const spot = (y) => ({ id: `s${y}`, label: 'x', kind: 'object', anchor: { x: 50, y }, choices: [{ id: `c${y}`, text: 't' }] });
  assert.equal(layoutScene('environment', [spot(70), spot(80), spot(20)]).textBand, 'top');
  assert.equal(layoutScene('environment', [spot(20), spot(30), spot(80)]).textBand, 'bottom');
  assert.equal(layoutScene('environment', []).textBand, 'bottom');
});
