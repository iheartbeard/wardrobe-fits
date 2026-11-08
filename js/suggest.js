/**
 * Подбор образов: «5 образов под выбранную обувь» и «случайное сочетание с проверкой цвета».
 * Генератор случайных чисел передаётся параметром, чтобы подбор можно было проверять в тестах.
 */
import {SUGGESTION_COUNT} from './config.js';
import {evaluateColors} from './lib/color.js';
import {emptySelection, matchLook} from './selection.js';
import {lookPairs} from './model.js';

const FIVE_RANDOM_SAMPLES = 4000;
const RANDOM_SAMPLES = 1500;
const RANDOM_POOL_LIMIT = 600;
const SCARF_CHANCE_FIVE = 0.4;
const SCARF_CHANCE_RANDOM = 0.5;

const sample = (list, rng) => list[Math.floor(rng() * list.length)];
const popcount = (model, mask) => model.scale.temps(mask).length;

/**
 * Случайная сборка поверх подходящей комбинации: головной убор, шарф и футболка под слой.
 * @returns {{parts: object[], mask: number, outfit: object, head: object, scarf: object|null, tee: object|null} | null}
 */
function randomCandidate(model, state, outfit, outfitMask, scarfChance, rng) {
  const {selection} = state;
  const heads = model.headwear.filter((h) => h.mask & outfitMask && (!selection.h || selection.h === h.id));
  if (!heads.length) {
    return null;
  }
  const head = sample(heads, rng);
  const scarves = model.scarves.filter(
    (s) => s.mask & outfitMask & head.mask && (!selection.sc || selection.sc === s.id),
  );
  const withScarf = scarves.length && (selection.sc || rng() < scarfChance);
  const scarf = withScarf ? (selection.sc ? model.byId[selection.sc] : sample(scarves, rng)) : null;
  const layerIsTee = model.byId[outfit.m].kind === 'tee';
  const tee = layerIsTee ? null : selection.t ? model.byId[selection.t] : sample(model.tees, rng);
  const mask = outfitMask & head.mask & (scarf ? scarf.mask : model.scale.all);
  if (!mask) {
    return null;
  }
  const parts = [
    model.byId[outfit.o],
    ...(tee ? [tee] : []),
    model.byId[outfit.m],
    model.byId[outfit.b],
    model.byId[outfit.s],
    head,
    ...(scarf ? [scarf] : []),
  ].filter((item) => !item.isNone);
  return {parts, mask, outfit, head, scarf, tee};
}

/** Кандидаты для «5 образов»: готовые образы под выбор плюс случайные сборки. */
function fiveCandidates(model, state, hits, rng) {
  const pool = [];
  const seen = new Set();
  const push = (candidate) => {
    const key = Object.values(candidate.slots).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      pool.push(candidate);
    }
  };

  model.looks.forEach((look) => {
    const mask = matchLook(model, state, look);
    if (!mask) {
      return;
    }
    const slots = emptySelection();
    const pairs = lookPairs(model, look);
    pairs.forEach(([slot, id]) => {
      slots[slot] = id;
    });
    const parts = pairs.map(([, id]) => model.byId[id]).filter((item) => item && !item.isNone);
    const evaluation = evaluateColors(parts);
    if (evaluation) {
      push({
        slots,
        parts,
        mask,
        evaluation,
        fromLook: true,
        dry: look.weather === 'dry',
        rain: look.weather === 'rain',
      });
    }
  });

  for (let i = 0; i < FIVE_RANDOM_SAMPLES && hits.length; i++) {
    const [outfit, outfitMask] = sample(hits, rng);
    const candidate = randomCandidate(model, state, outfit, outfitMask, SCARF_CHANCE_FIVE, rng);
    if (!candidate) {
      continue;
    }
    const evaluation = evaluateColors(candidate.parts);
    if (!evaluation) {
      continue;
    }
    const layerIsTee = model.byId[outfit.m].kind === 'tee';
    const slots = {
      o: outfit.o,
      t: layerIsTee ? outfit.m : candidate.tee.id,
      m: layerIsTee ? null : outfit.m,
      b: outfit.b,
      s: outfit.s,
      h: candidate.head.id,
      sc: candidate.scarf ? candidate.scarf.id : 'nosc',
    };
    push({
      slots,
      parts: candidate.parts,
      mask: candidate.mask,
      evaluation,
      fromLook: false,
      dry: state.weather !== 'rain' && !!(outfit.dry & candidate.mask),
      rain: state.weather !== 'dry' && !!(outfit.rain & candidate.mask),
    });
  }
  return pool;
}

/**
 * Пять разных образов с разбросом по температуре: диапазон делится на равные части,
 * в каждой берётся лучший по цвету, штрафуются повторы куртки, слоя, низа, шапки и футболки.
 * @returns {object[]} образы по возрастанию температуры
 */
export function pickFive(model, state, hits, rng = Math.random) {
  const pool = fiveCandidates(model, state, hits, rng);
  if (!pool.length) {
    return [];
  }
  let union = 0;
  pool.forEach((c) => {
    union |= c.mask;
  });
  const temps = model.scale.temps(union);
  const parts = Math.min(SUGGESTION_COUNT, temps.length);
  const chunks = [];
  for (let i = 0; i < parts; i++) {
    const from = Math.floor((i * temps.length) / parts);
    const to = Math.floor(((i + 1) * temps.length) / parts);
    chunks.push(temps.slice(from, to).reduce((m, t) => m | (1 << (t - model.scale.min)), 0));
  }

  const picked = [];
  for (let i = 0; i < SUGGESTION_COUNT; i++) {
    let best = null;
    for (const chunk of [chunks[i % parts], model.scale.all]) {
      let bestValue = -1e9;
      for (const c of pool) {
        if (picked.includes(c)) {
          continue;
        }
        const inChunk = c.mask & chunk;
        if (!inChunk) {
          continue;
        }
        let value =
          c.evaluation.score * 10 +
          (c.fromLook ? 4 : 0) +
          rng() * 3 +
          (popcount(model, inChunk) / popcount(model, chunk)) * 4;
        for (const p of picked) {
          if (p.slots.o === c.slots.o) value -= 7;
          if (p.slots.m && p.slots.m === c.slots.m) value -= 5;
          if (p.slots.b === c.slots.b) value -= 5;
          if (p.slots.h === c.slots.h) value -= 3;
          if (p.slots.t === c.slots.t) value -= 2;
        }
        if (value > bestValue) {
          bestValue = value;
          best = c;
        }
      }
      if (best) {
        break;
      }
    }
    if (!best) {
      break;
    }
    picked.push(best);
  }
  const middle = (c) => {
    const t = model.scale.temps(c.mask);
    return (t[0] + t[t.length - 1]) / 2;
  };
  return picked.sort((a, b) => middle(a) - middle(b));
}

/**
 * Случайное сочетание, прошедшее проверку цвета; из лучших по оценке (не хуже лучшей минус один) берётся случайное.
 * @returns {{parts: object[], mask: number, evaluation: object} | null}
 */
export function pickRandom(model, state, hits, rng = Math.random) {
  let pool = [];
  let bestScore = -9;
  for (let i = 0; i < RANDOM_SAMPLES && hits.length; i++) {
    const [outfit, outfitMask] = sample(hits, rng);
    const candidate = randomCandidate(model, state, outfit, outfitMask, SCARF_CHANCE_RANDOM, rng);
    if (!candidate) {
      continue;
    }
    const evaluation = evaluateColors(candidate.parts);
    if (!evaluation) {
      continue;
    }
    if (pool.length < RANDOM_POOL_LIMIT) {
      pool.push({parts: candidate.parts, mask: candidate.mask, evaluation});
    }
    bestScore = Math.max(bestScore, evaluation.score);
  }
  pool = pool.filter((c) => c.evaluation.score >= bestScore - 1);
  return pool.length ? sample(pool, rng) : null;
}
