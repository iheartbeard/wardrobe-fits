/**
 * Что доступно и что подсвечивать при текущем выборе. Чистые функции от модели и состояния.
 *
 * Состояние: { selection, weather, band }, где selection — { o, t, m, b, s, h, sc } с id или null,
 * weather — 'any' | 'dry' | 'rain', band — маска выбранной полосы температур.
 */
import {SLOTS} from './config.js';
import {evaluateColors} from './lib/color.js';
import {lookMask, lookPairs} from './model.js';

const OUTFIT_SLOTS = ['o', 't', 'm', 'b', 's'];

export const emptySelection = () => Object.fromEntries(SLOTS.map((slot) => [slot, null]));

const isTee = (model, id) => model.byId[id].kind === 'tee';

function outfitMask(outfit, weather, band) {
  const mask = weather === 'dry' ? outfit.dry : weather === 'rain' ? outfit.rain : outfit.dry | outfit.rain;
  return mask & band;
}

/** Подходит ли комбинация выбору в данном слоте. Футболка под слоем подразумевается всегда. */
function slotMatches(model, selection, outfit, slot) {
  switch (slot) {
    case 'o':
      return !selection.o || selection.o === outfit.o;
    case 'b':
      return !selection.b || selection.b === outfit.b;
    case 's':
      return !selection.s || selection.s === outfit.s;
    case 't':
      return !selection.t || !isTee(model, outfit.m) || outfit.m === selection.t;
    case 'm':
      return !selection.m || outfit.m === selection.m;
    default:
      return true;
  }
}

/**
 * @returns {{available: Record<string, Set<string>>, count: number, hits: [object, number][]}}
 *   available — id вещей, которые ещё можно выбрать, по слотам;
 *   count — число сочетаний; hits — подходящие комбинации с масками температур.
 */
export function computeAvailability(model, state) {
  const {selection, weather, band} = state;
  const all = model.scale.all;
  const headMask = selection.h ? model.byId[selection.h].mask : all;
  const scarfMask = selection.sc ? model.byId[selection.sc].mask : all;
  const available = Object.fromEntries(SLOTS.map((slot) => [slot, new Set()]));
  const hits = [];
  let headTemps = 0;
  let scarfTemps = 0;
  let count = 0;
  let layerSelectable = false;

  for (const outfit of model.outfits) {
    const mask = outfitMask(outfit, weather, band);
    if (!mask) {
      continue;
    }
    const withAccessories = mask & headMask & scarfMask;

    let misses = 0;
    let missed = null;
    for (const slot of OUTFIT_SLOTS) {
      if (!slotMatches(model, selection, outfit, slot)) {
        misses++;
        missed = slot;
        if (misses > 1) {
          break;
        }
      }
    }
    const tee = isTee(model, outfit.m);

    if (misses === 0) {
      if (withAccessories) {
        available.o.add(outfit.o);
        available.b.add(outfit.b);
        available.s.add(outfit.s);
        if (tee) {
          available.t.add(outfit.m);
        } else {
          available.m.add(outfit.m);
          layerSelectable = true;
        }
        count++;
        hits.push([outfit, withAccessories]);
      }
      headTemps |= mask & scarfMask;
      scarfTemps |= mask & headMask;
    } else if (misses === 1 && withAccessories) {
      if (missed === 'o' || missed === 'b' || missed === 's') {
        available[missed].add(outfit[missed]);
      } else if (missed === 't' && tee) {
        available.t.add(outfit.m);
      } else if (missed === 'm' && !tee) {
        available.m.add(outfit.m);
      }
    }
  }

  if (layerSelectable) {
    model.tees.forEach((tee) => available.t.add(tee.id));
  }
  model.headwear.forEach((item) => {
    if (headTemps & item.mask) {
      available.h.add(item.id);
    }
  });
  model.scarves.forEach((item) => {
    if (scarfTemps & item.mask) {
      available.sc.add(item.id);
    }
  });
  if (model.scarves.some((item) => available.sc.has(item.id))) {
    available.sc.add(model.noScarf.id); /* если ни один шарф не подходит, весь раздел недоступен */
  }
  return {available, count, hits};
}

/** Готовый образ, подходящий текущему выбору: его маска температур или null. */
export function matchLook(model, state, look) {
  const {selection, weather, band} = state;
  const mask = lookMask(model, look);
  if (!mask) {
    return null;
  }
  if (weather !== 'any' && weather !== look.weather) {
    return null;
  }
  if (!(mask & band)) {
    return null;
  }
  const pairs = lookPairs(model, look);
  for (const [slot, id] of pairs) {
    if (selection[slot] && selection[slot] !== id) {
      return null;
    }
  }
  if (selection.m && !pairs.some(([slot]) => slot === 'm')) {
    return null;
  }
  if (selection.t && !pairs.some(([slot]) => slot === 't')) {
    return null;
  }
  return mask;
}

/** Вещи выбора без «без верхней одежды» и «без шарфа»: у них нет цвета. */
export function selectedParts(model, selection) {
  return SLOTS.filter((slot) => selection[slot])
    .map((slot) => model.byId[selection[slot]])
    .filter((item) => !item.isNone);
}

/**
 * Состояние каждой карточки: недоступна, «идеально» (есть в готовом образе), «подходит по цвету».
 * «Без верхней одежды» сама по себе цвета не несёт, подсветка начинается, когда выбрано что-то ещё.
 * Футболку подсвечиваем под слой поверх неё (свитшот, худи, свитер, овершот) или под куртку.
 * @returns {Map<string, {disabled: boolean, ideal: boolean, fit: boolean}>} ключ — «слот:id»
 */
export function cardStates(model, state, availability) {
  const {selection} = state;
  const real = (slot) => selection[slot] && !(slot === 'o' && selection[slot] === 'none');
  const any = SLOTS.some(real);
  const hasJacket = !!selection.o && selection.o !== 'none';
  const highlights = (slot) => any && (slot !== 't' || !!selection.m || hasJacket);

  const parts = selectedParts(model, selection);
  const baseScore = parts.length ? (evaluateColors(parts) || {score: 0}).score : 0;

  const ideal = Object.fromEntries(SLOTS.map((slot) => [slot, new Set()]));
  if (any) {
    model.looks.forEach((look) => {
      if (!matchLook(model, state, look)) {
        return;
      }
      lookPairs(model, look).forEach(([slot, id]) => {
        if (id) {
          ideal[slot].add(id);
        }
      });
    });
  }

  const states = new Map();
  const everyItem = [
    model.noJacket,
    ...model.outer,
    ...model.layers,
    ...model.bottoms,
    ...model.shoes,
    ...model.headwear,
    model.noScarf,
    ...model.scarves,
  ];
  for (const item of everyItem) {
    const slot = item.slot;
    const chosen = selection[slot] === item.id;
    const evaluation = chosen ? null : evaluateColors(item.isNone ? parts : [...parts, item]);
    const disabled = !chosen && (selection[slot] !== null || !availability.available[slot].has(item.id) || !evaluation);
    const isIdeal = highlights(slot) && !chosen && !disabled && ideal[slot].has(item.id);
    const isFit =
      highlights(slot) && !chosen && !disabled && !isIdeal && !!evaluation && evaluation.score - baseScore >= 1;
    states.set(`${slot}:${item.id}`, {chosen, disabled, ideal: isIdeal, fit: isFit});
  }
  return states;
}
