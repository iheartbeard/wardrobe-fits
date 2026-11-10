/**
 * Модель сезона: вещи с температурными масками, все допустимые комбинации (outfits)
 * и готовые образы. Не зависит от DOM, поэтому легко проверяется в тестах.
 */
import {SEASONS} from './data/seasons.js';
import {LAYER_LABELS} from './config.js';
import {createScale} from './lib/temperature.js';
import {evaluateColors, colorFamily} from './lib/color.js';

/**
 * Температуры, при которых слой можно носить под курткой (или без неё, если куртка — «без верхней одежды»).
 * @returns {number} маска температур
 */
export function layerMask(scale, jacket, layer) {
  if (!jacket || jacket.isNone) {
    return layer.outerMask;
  }
  if (jacket.kinds && !jacket.kinds.includes(layer.kind)) {
    return 0;
  }
  if (jacket.ban && jacket.ban.includes(layer.kind)) {
    return 0;
  }
  if (!layer.under) {
    return 0;
  }
  const upper = layer.weight <= 1 ? jacket.maxOverLight : jacket.maxOverHeavy;
  const override = jacket.minTempByKind && jacket.minTempByKind[layer.kind];
  const lower = override != null ? override : jacket.minTemp;
  let result = 0;
  for (let t = Math.max(lower, layer.under[0], scale.min); t <= Math.min(upper, layer.under[1], scale.max); t++) {
    if (t >= jacket.warmBelow || layer.warm) {
      result |= 1 << (t - scale.min);
    }
  }
  return result;
}

function describeType(item, group) {
  if (item.slot === 'o') {
    return group === 'Жилетки' ? 'Жилетка' : 'Куртка';
  }
  if (item.slot === 't' || item.slot === 'm') {
    return LAYER_LABELS[item.kind] || 'Слой';
  }
  if (item.slot === 'b') {
    return 'Штаны';
  }
  if (item.slot === 's') {
    return 'Обувь';
  }
  if (item.slot === 'h') {
    return group === 'Кепки' ? 'Кепка' : 'Шапка';
  }
  return 'Шарф';
}

function withSlot(items, slot) {
  return items.map((item) => ({...item, slot, type: describeType({...item, slot}, item.group)}));
}

/** Слоты образа в порядке отображения: куртка, [футболка], слой, низ, обувь, головной убор, шарф. */
export function lookPairs(model, look) {
  const [outer, layer, bottom, shoe, head, scarf] = look.ids;
  const layerItem = model.byId[layer];
  const pairs = [
    ['o', outer],
    [layerItem.kind === 'tee' ? 't' : 'm', layer],
    ['b', bottom],
    ['s', shoe],
    ['h', head],
    ['sc', scarf || 'nosc'],
  ];
  if (look.tee && layerItem.kind !== 'tee') {
    pairs.splice(1, 0, ['t', look.tee]);
  }
  return pairs;
}

/** Температуры, при которых готовый образ работает (учитывает дождь, обувь и аксессуары). */
export function lookMask(model, look) {
  const [outer, layer, bottom, shoe, head, scarf] = look.ids.map((id) => (id ? model.byId[id] : null));
  let mask = layerMask(model.scale, outer, layer);
  if (look.weather === 'rain') {
    if (outer.noRain) {
      return 0;
    }
    mask &= bottom.mask & shoe.rainMask;
  } else {
    mask &= bottom.mask & shoe.dryMask;
  }
  if (head) {
    mask &= head.mask;
  }
  if (scarf) {
    mask &= scarf.mask;
  }
  return mask;
}

/** К готовым образам с обычным слоем подбирается футболка с лучшей оценкой цвета. */
function assignTees(model) {
  model.looks.forEach((look) => {
    look.tee = null;
    const [outer, layerId] = look.ids;
    const layer = model.byId[layerId];
    if (layer.kind === 'tee') {
      return;
    }
    let best = null;
    let bestValue = -99;
    model.tees.forEach((tee, index) => {
      const parts = [outer, tee.id, ...look.ids.slice(1)].filter(Boolean).map((id) => model.byId[id]);
      const evaluation = evaluateColors(parts);
      if (!evaluation) {
        return;
      }
      const value = evaluation.score * 10 + (colorFamily(tee.hex) !== colorFamily(layer.hex) ? 3 : 0) - index * 0.1;
      if (value > bestValue) {
        bestValue = value;
        best = tee;
      }
    });
    if (best) {
      look.tee = best.id;
    }
  });
}

/**
 * @param {string} seasonKey Ключ сезона из SEASONS
 * @param {import('./data/seasons.js').SeasonConfig} [season] Описание сезона, если его нет в SEASONS (например, лето для поездок)
 */
export function buildModel(seasonKey, season = SEASONS[seasonKey]) {
  const scale = createScale(...season.range);
  const data = season.data();

  const noJacket = {
    id: 'none',
    slot: 'o',
    type: 'Куртка',
    isNone: true,
    name: 'Без верхней одежды',
    colorName: 'только средний слой',
    hex: null,
  };
  const noScarf = {
    id: 'nosc',
    slot: 'sc',
    type: 'Шарф',
    isNone: true,
    name: 'Без шарфа',
    colorName: 'пропустить шарф',
    hex: null,
    mask: scale.all,
  };

  const outer = withSlot(data.outer, 'o');
  const layers = data.layers.map((layer) => {
    const slot = layer.kind === 'tee' ? 't' : 'm';
    return {
      ...layer,
      slot,
      type: describeType({...layer, slot}, layer.group),
      outerMask: layer.outer ? scale.mask(...layer.outer) : 0,
    };
  });
  const bottoms = withSlot(data.bottoms, 'b').map((item) => ({...item, mask: scale.mask(...item.range)}));
  const shoes = withSlot(data.shoes, 's').map((item) => ({
    ...item,
    dryMask: item.dry ? scale.mask(...item.dry) : 0,
    rainMask: item.rain ? scale.mask(...item.rain) : 0,
  }));
  const headwear = withSlot(data.headwear, 'h').map((item) => ({...item, mask: scale.mask(...item.range)}));
  const scarves = withSlot(data.scarves, 'sc').map((item) => ({...item, mask: scale.mask(...item.range)}));

  const byId = {};
  [...outer, ...layers, ...bottoms, ...shoes, ...headwear, ...scarves, noJacket, noScarf].forEach((item) => {
    byId[item.id] = item;
  });

  const model = {
    key: seasonKey,
    season,
    scale,
    noJacket,
    noScarf,
    outer,
    layers,
    bottoms,
    shoes,
    headwear,
    scarves,
    tees: layers.filter((layer) => layer.kind === 'tee'),
    byId,
    outfits: [],
    looks: season.looks.map((look) => ({
      weather: look.weather,
      ids: [look.outer, look.layer, look.bottom, look.shoe, look.head, look.scarf],
      note: look.note,
      tee: null,
    })),
  };

  for (const jacket of [noJacket, ...outer]) {
    for (const layer of layers) {
      const withLayer = layerMask(scale, jacket, layer);
      if (!withLayer) {
        continue;
      }
      const inRain = jacket.noRain ? 0 : withLayer;
      for (const bottom of bottoms) {
        const dryBottom = withLayer & bottom.mask;
        const rainBottom = inRain & bottom.mask;
        if (!dryBottom && !rainBottom) {
          continue;
        }
        for (const shoe of shoes) {
          const dry = dryBottom & shoe.dryMask;
          const rain = rainBottom & shoe.rainMask;
          if (dry || rain) {
            model.outfits.push({o: jacket.id, m: layer.id, b: bottom.id, s: shoe.id, dry, rain});
          }
        }
      }
    }
  }

  assignTees(model);
  return model;
}
