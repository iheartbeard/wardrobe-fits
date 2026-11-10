import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SEASONS} from '../js/data/seasons.js';
import {buildModel, lookMask, lookPairs} from '../js/model.js';
import {cardStates, computeAvailability, emptySelection, matchLook} from '../js/selection.js';
import {pickFive, pickRandom} from '../js/suggest.js';

const stateOf = (model, patch = {}) => ({
  selection: emptySelection(),
  weather: 'any',
  band: model.scale.all,
  ...patch,
});

/* Детерминированный генератор для проверки подбора */
function seeded(seed = 7) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

for (const key of Object.keys(SEASONS)) {
  test(`${key}: id вещей уникальны, а образы ссылаются на существующие вещи`, () => {
    const model = buildModel(key);
    const ids = Object.keys(model.byId);
    const total = [
      model.noJacket,
      model.noScarf,
      ...model.outer,
      ...model.layers,
      ...model.bottoms,
      ...model.shoes,
      ...model.headwear,
      ...model.scarves,
    ];
    assert.equal(ids.length, total.length);
    for (const look of model.looks) {
      look.ids.filter(Boolean).forEach((id) => assert.ok(model.byId[id], `нет вещи ${id}`));
    }
  });

  test(`${key}: каждый готовый образ работает хотя бы при одной температуре`, () => {
    const model = buildModel(key);
    model.looks.forEach((look, i) => assert.ok(lookMask(model, look), `образ ${i} недоступен`));
  });

  test(`${key}: без выбора доступно хотя бы одно сочетание и ничего не выбрано`, () => {
    const model = buildModel(key);
    const state = stateOf(model);
    const availability = computeAvailability(model, state);
    assert.ok(availability.count > 0);
    const states = cardStates(model, state, availability);
    assert.ok([...states.values()].every((s) => !s.chosen && !s.ideal && !s.fit));
  });
}

test('количество сочетаний без выбора совпадает с эталоном', () => {
  assert.equal(computeAvailability(buildModel('autumn'), stateOf(buildModel('autumn'))).count, 68719);
  assert.equal(computeAvailability(buildModel('winter'), stateOf(buildModel('winter'))).count, 14315);
});

test('выбор вещи отключает несовместимые по температуре', () => {
  const model = buildModel('autumn');
  const state = stateOf(model, {band: model.scale.mask(18, 22)});
  const {available} = computeAvailability(model, state);
  assert.ok(!available.o.has('tra'), 'Transport нужен от +5 до +15, жарким днём недоступен');
  assert.ok(available.o.has('none'));
});

test('образ с курткой без дождевой защиты не попадает под дождь', () => {
  const model = buildModel('winter');
  const rxt = model.looks.find((look) => look.ids[0] === 'rxt');
  assert.equal(matchLook(model, stateOf(model, {weather: 'rain'}), rxt), null);
});

test('lookPairs вставляет футболку под слой, но не под саму футболку', () => {
  const model = buildModel('autumn');
  const withLayer = model.looks.find((look) => model.byId[look.ids[1]].kind === 'sw');
  assert.ok(lookPairs(model, withLayer).some(([slot]) => slot === 't'));
  const withTee = model.looks.find((look) => model.byId[look.ids[1]].kind === 'tee');
  assert.equal(lookPairs(model, withTee).filter(([slot]) => slot === 't').length, 1);
});

test('«5 образов» возвращает до пяти разных образов под выбранную обувь', () => {
  const model = buildModel('autumn');
  const state = stateOf(model, {selection: {...emptySelection(), s: 'gnyc'}});
  const {hits} = computeAvailability(model, state);
  const picks = pickFive(model, state, hits, seeded());
  assert.ok(picks.length > 0 && picks.length <= 5);
  picks.forEach((pick) => assert.equal(pick.slots.s, 'gnyc'));
  assert.equal(new Set(picks.map((p) => Object.values(p.slots).join('|'))).size, picks.length);
});

test('случайное сочетание проходит проверку цвета', () => {
  const model = buildModel('winter');
  const state = stateOf(model);
  const {hits} = computeAvailability(model, state);
  const result = pickRandom(model, state, hits, seeded());
  assert.ok(result && result.evaluation);
});
