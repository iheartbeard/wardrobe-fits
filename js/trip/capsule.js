/**
 * Капсула для поездки. Берёт все сезоны (осень, зиму и летние вещи для поездок), собирает образы,
 * которые работают при температурах и погоде поездки, и подбирает небольшой набор вещей,
 * из которого получается как можно больше сочетаний без цветовых конфликтов.
 * Модуль не зависит от DOM.
 */
import {SEASONS} from '../data/seasons.js';
import {buildModel} from '../model.js';
import {evaluateColors} from '../lib/color.js';
import {SUMMER_SEASON} from './summer.js';

/** Лимиты вещей по размеру багажа. Обувь считается вместе с парой, в которой едешь. */
export const LUGGAGE = {
  cabin: {label: 'Ручная кладь', o: 1, m: 2, t: 4, b: 2, s: 2, h: 1},
  checked: {label: 'Чемодан', o: 2, m: 4, t: 7, b: 3, s: 3, h: 2},
};

export const SLOT_TITLES = {
  o: 'Верхняя одежда',
  m: 'Средний слой',
  t: 'Футболки',
  b: 'Низ',
  s: 'Обувь',
  h: 'Головной убор',
  sc: 'Шарф',
};

/** Самый холодный и самый тёплый день, которые умеет собрать гардероб. */
export const TRIP_LIMITS = [0, 32];

const COVER_WEIGHT = 1000;

/** Модели всех сезонов и общий каталог вещей. У аксессуаров диапазоны сезонов объединяются. */
export function buildPool() {
  const models = [...Object.keys(SEASONS).map((key) => buildModel(key)), buildModel('summer', SUMMER_SEASON)];
  const items = {};
  for (const model of models) {
    for (const item of Object.values(model.byId)) {
      if (item.isNone) {
        continue;
      }
      const known = items[item.id];
      if (!known) {
        items[item.id] = {...item};
      } else if (item.range && known.range) {
        known.range = [Math.min(known.range[0], item.range[0]), Math.max(known.range[1], item.range[1])];
      }
    }
  }
  return {models, items};
}

/** Слот вещи в капсуле: футболки отдельно от остального среднего слоя. */
export const capsuleSlot = (item) =>
  item.slot === 'm' || item.slot === 't' ? (item.kind === 'tee' ? 't' : 'm') : item.slot;

const clampTemp = (t) => Math.max(TRIP_LIMITS[0], Math.min(TRIP_LIMITS[1], Math.round(t)));

/** Условия поездки без повторов: [{t, rain}]. */
export function uniqueConditions(days) {
  const seen = new Map();
  days.forEach((day) => {
    const t = clampTemp(day.t);
    seen.set(`${t}|${day.rain ? 1 : 0}`, {t, rain: !!day.rain});
  });
  return [...seen.values()].sort((a, b) => a.t - b.t || Number(a.rain) - Number(b.rain));
}

/**
 * Все образы, которые работают хотя бы при одном условии поездки и проходят проверку цвета.
 * Образ: {o, m, b, s, ids, conds: Set<number>, score}.
 */
export function tripOutfits(pool, conditions) {
  const byKey = new Map();
  for (const model of pool.models) {
    const {scale} = model;
    for (const outfit of model.outfits) {
      conditions.forEach((cond, index) => {
        if (cond.t < scale.min || cond.t > scale.max) {
          return;
        }
        const bit = 1 << (cond.t - scale.min);
        if (!((cond.rain ? outfit.rain : outfit.dry) & bit)) {
          return;
        }
        const key = `${outfit.o}|${outfit.m}|${outfit.b}|${outfit.s}`;
        let entry = byKey.get(key);
        if (!entry) {
          const ids = [outfit.o, outfit.m, outfit.b, outfit.s].filter((id) => id !== 'none');
          const evaluation = evaluateColors(ids.map((id) => pool.items[id]));
          entry = {
            o: outfit.o,
            m: outfit.m,
            b: outfit.b,
            s: outfit.s,
            ids,
            conds: new Set(),
            score: evaluation ? evaluation.score : null,
          };
          byKey.set(key, entry);
        }
        entry.conds.add(index);
      });
    }
  }
  return [...byKey.values()].filter((entry) => entry.score !== null);
}

/**
 * Подбор капсулы.
 * @param {object} pool Результат buildPool()
 * @param {{t: number, rain: boolean}[]} days Дни поездки
 * @param {{luggage?: string, pinned?: string[], excluded?: string[]}} [options]
 */
export function buildCapsule(pool, days, options = {}) {
  const limits = {...LUGGAGE[options.luggage || 'cabin']};
  const excluded = new Set(options.excluded || []);
  const pinned = (options.pinned || []).filter((id) => pool.items[id] && !excluded.has(id));
  const conditions = uniqueConditions(days);
  const outfits = tripOutfits(pool, conditions).filter((outfit) => outfit.ids.every((id) => !excluded.has(id)));

  /* Сколько образов поездки держится на вещи: универсальные вещи важнее */
  const freq = {};
  const byItem = {};
  outfits.forEach((outfit) => {
    outfit.ids.forEach((id) => {
      freq[id] = (freq[id] || 0) + 1;
      (byItem[id] = byItem[id] || []).push(outfit);
    });
  });

  const pinnedCounts = {o: 0, m: 0, t: 0, b: 0, s: 0};
  pinned.forEach((id) => {
    const slot = capsuleSlot(pool.items[id]);
    if (slot in pinnedCounts) {
      pinnedCounts[slot] += 1;
    }
  });
  Object.keys(pinnedCounts).forEach((slot) => {
    limits[slot] = Math.max(limits[slot], pinnedCounts[slot]);
  });
  limits.t = Math.min(limits.t, Math.max(2, days.length, pinnedCounts.t));

  /* Холодные дни определяют куртку и низ, жаркие лёгкие вещи, поэтому пробуем несколько порядков и берём лучший */
  const optionCount = conditions.map((_, index) => outfits.filter((o) => o.conds.has(index)).length);
  const indexes = conditions.map((_, index) => index);
  const orders = [[...indexes], [...indexes].reverse(), [...indexes].sort((a, b) => optionCount[a] - optionCount[b])];
  let chosen = null;
  let counts = null;
  let best = null;
  for (const order of orders) {
    const run = greedy(order);
    const runOutfits = outfits.filter((outfit) => outfit.ids.every((id) => run.chosen.has(id)));
    const covered = new Set();
    runOutfits.forEach((outfit) => outfit.conds.forEach((c) => covered.add(c)));
    const value = covered.size * COVER_WEIGHT + runOutfits.length;
    if (!best || value > best.value) {
      best = {value, ...run};
    }
  }
  ({chosen, counts} = best);
  const add = (id) => {
    if (!chosen.has(id)) {
      chosen.add(id);
      counts[capsuleSlot(pool.items[id])] += 1;
    }
  };
  const complete = (outfit) => outfit.ids.every((id) => chosen.has(id));
  const coveredSet = () => {
    const covered = new Set();
    outfits.forEach((outfit) => {
      if (complete(outfit)) {
        outfit.conds.forEach((c) => covered.add(c));
      }
    });
    return covered;
  };

  function greedy(order) {
    const chosen = new Set();
    const counts = {o: 0, m: 0, t: 0, b: 0, s: 0};
    const add = (id) => {
      if (!chosen.has(id)) {
        chosen.add(id);
        counts[capsuleSlot(pool.items[id])] += 1;
      }
    };
    pinned.filter((id) => capsuleSlot(pool.items[id]) in counts).forEach(add);

    const fits = (ids) => {
      const extra = {};
      for (const id of ids) {
        if (chosen.has(id)) {
          continue;
        }
        const slot = capsuleSlot(pool.items[id]);
        extra[slot] = (extra[slot] || 0) + 1;
        if (counts[slot] + extra[slot] > limits[slot]) {
          return false;
        }
      }
      return true;
    };
    const complete = (outfit) => outfit.ids.every((id) => chosen.has(id));
    const coveredSet = () => {
      const covered = new Set();
      outfits.forEach((outfit) => {
        if (complete(outfit)) {
          outfit.conds.forEach((c) => covered.add(c));
        }
      });
      return covered;
    };

    /* Шаг 1: каждое условие поездки закрывается хотя бы одним образом */
    for (const index of order) {
      if (coveredSet().has(index)) {
        continue;
      }
      let best = null;
      let bestValue = Infinity;
      for (const outfit of outfits) {
        if (!outfit.conds.has(index) || !fits(outfit.ids)) {
          continue;
        }
        const fresh = outfit.ids.filter((id) => !chosen.has(id));
        const versatility = fresh.reduce((sum, id) => sum + freq[id], 0);
        const value = fresh.length * 10 - outfit.score - outfit.conds.size * 0.5 - versatility * 0.002;
        if (value < bestValue) {
          bestValue = value;
          best = outfit;
        }
      }
      if (best) {
        best.ids.forEach(add);
      }
    }

    /* Шаг 2: добавляем вещи, пока они дают новые сочетания */
    for (;;) {
      const covered = coveredSet();
      let bestId = null;
      let bestGain = 0;
      for (const id of Object.keys(byItem)) {
        if (chosen.has(id) || excluded.has(id) || !fits([id])) {
          continue;
        }
        let gain = 0;
        const newConds = new Set();
        for (const outfit of byItem[id]) {
          if (outfit.ids.every((other) => other === id || chosen.has(other))) {
            gain += 1 + 0.25 * outfit.score;
            outfit.conds.forEach((c) => {
              if (!covered.has(c)) {
                newConds.add(c);
              }
            });
          }
        }
        gain += newConds.size * COVER_WEIGHT;
        if (gain > bestGain) {
          bestGain = gain;
          bestId = id;
        }
      }
      if (!bestId) {
        break;
      }
      add(bestId);
    }
    return {chosen, counts};
  }

  const capsuleOutfits = outfits.filter(complete);

  /* Футболки под свитеры и свитшоты: добираем до лимита теми, что спокойнее ложатся по цвету */
  const tees = Object.values(pool.items).filter(
    (item) => capsuleSlot(item) === 't' && !chosen.has(item.id) && !excluded.has(item.id),
  );
  const teeFit = (tee) =>
    capsuleOutfits.filter((outfit) => evaluateColors([...outfit.ids, tee.id].map((id) => pool.items[id]))).length;
  tees
    .map((tee) => ({tee, fit: teeFit(tee)}))
    .sort((a, b) => b.fit - a.fit)
    .forEach(({tee}) => {
      if (counts.t < limits.t) {
        add(tee.id);
      }
    });

  const temps = conditions.map((cond) => cond.t);
  const accessoryFit = (item) =>
    capsuleOutfits.length
      ? capsuleOutfits.filter((outfit) => evaluateColors([...outfit.ids, item.id].map((id) => pool.items[id]))).length /
        capsuleOutfits.length
      : 0;
  const pickAccessories = (slot, limit, needed) => {
    if (!needed.length || !limit) {
      return [];
    }
    const pinnedHere = pinned.filter((id) => pool.items[id].slot === slot);
    const result = [...pinnedHere];
    const uncovered = new Set(needed.filter((t) => !pinnedHere.some((id) => inRange(pool.items[id], t))));
    const candidates = Object.values(pool.items).filter(
      (item) => item.slot === slot && !excluded.has(item.id) && !result.includes(item.id),
    );
    while (result.length < limit && uncovered.size) {
      let best = null;
      let bestValue = 0;
      candidates.forEach((item) => {
        if (result.includes(item.id)) {
          return;
        }
        const hits = [...uncovered].filter((t) => inRange(item, t)).length;
        const value = hits ? hits + accessoryFit(item) * 2 : 0;
        if (value > bestValue) {
          bestValue = value;
          best = item;
        }
      });
      if (!best) {
        break;
      }
      result.push(best.id);
      [...uncovered].forEach((t) => {
        if (inRange(best, t)) {
          uncovered.delete(t);
        }
      });
    }
    return result;
  };
  const head = pickAccessories('h', limits.h, temps);
  const scarves = pickAccessories(
    'sc',
    1,
    temps.filter((t) => t <= 10),
  );
  [...head, ...scarves].forEach((id) => chosen.add(id));

  const finalCovered = coveredSet();
  return {
    conditions,
    limits,
    ids: [...chosen],
    outfits: capsuleOutfits,
    gaps: conditions.filter((_, index) => !finalCovered.has(index)),
    impossible: conditions.filter((_, index) => !outfits.some((outfit) => outfit.conds.has(index))),
  };
}

const inRange = (item, t) => item.range && t >= item.range[0] && t <= item.range[1];

/**
 * План по дням: на каждый день образ из капсулы, по возможности без повторов.
 * @returns {{day: object, outfit: object|null, tee: string|null, head: string|null, scarf: string|null}[]}
 */
export function planDays(pool, capsule, days) {
  const used = {};
  const usedKey = new Set();
  const teeUse = {};
  const tees = capsule.ids.filter((id) => capsuleSlot(pool.items[id]) === 't');
  const heads = capsule.ids.filter((id) => pool.items[id].slot === 'h');
  const scarves = capsule.ids.filter((id) => pool.items[id].slot === 'sc');
  let previous = null;

  return days.map((day) => {
    const condIndex = capsule.conditions.findIndex((c) => c.t === clampTemp(day.t) && c.rain === !!day.rain);
    const options = capsule.outfits.filter((outfit) => outfit.conds.has(condIndex));
    let best = null;
    let bestValue = -Infinity;
    options.forEach((outfit) => {
      const key = outfit.ids.join('|');
      let value = outfit.score * 2;
      value -= (used[outfit.m] || 0) * 3 + (used[outfit.b] || 0) * 2 + (used[outfit.o] || 0) * 0.5;
      if (usedKey.has(key)) {
        value -= 6;
      }
      value -= (used[outfit.s] || 0) * 1;
      if (previous && previous.s === outfit.s) {
        value -= 1.5;
      }
      if (value > bestValue) {
        bestValue = value;
        best = outfit;
      }
    });
    if (!best) {
      return {day, outfit: null, tee: null, head: null, scarf: null};
    }
    usedKey.add(best.ids.join('|'));
    [best.m, best.b, best.o, best.s].forEach((id) => {
      used[id] = (used[id] || 0) + 1;
    });
    previous = best;

    let tee = null;
    if (pool.items[best.m].kind !== 'tee') {
      const ranked = tees
        .map((id) => ({id, ok: evaluateColors([...best.ids, id].map((x) => pool.items[x]))}))
        .filter((x) => x.ok)
        .sort((a, b) => (teeUse[a.id] || 0) - (teeUse[b.id] || 0) || b.ok.score - a.ok.score);
      tee = ranked.length ? ranked[0].id : tees[0] || null;
      if (tee) {
        teeUse[tee] = (teeUse[tee] || 0) + 1;
      }
    }
    const t = clampTemp(day.t);
    const fitting = (ids) =>
      ids
        .filter((id) => inRange(pool.items[id], t))
        .find((id) => evaluateColors([...best.ids, id].map((x) => pool.items[x]))) || null;
    return {day, outfit: best, tee, head: fitting(heads), scarf: t <= 10 ? fitting(scarves) : null};
  });
}

/** Дни для режима без прогноза: температуры от tmax до tmin вперемешку (тёплый, прохладный, …), дождь каждый третий день. */
export function manualDays({days, tmin, tmax, rain}) {
  const count = Math.max(1, Math.min(30, Math.round(days)));
  const lo = Math.min(tmin, tmax);
  const hi = Math.max(tmin, tmax);
  const spread = Array.from({length: count}, (_, i) => (count === 1 ? hi : hi - ((hi - lo) * i) / (count - 1)));
  const order = [];
  for (let left = 0, right = count - 1; left <= right; left++, right--) {
    order.push(spread[left]);
    if (left !== right) {
      order.push(spread[right]);
    }
  }
  return order.map((t, i) => ({t: Math.round(t), rain: !!rain && i % 3 === 1}));
}
