/**
 * Зимний гардероб (0…+15 °C). Берёт вещи, отмеченные на зиму, из осенних данных и переопределяет
 * то, что в зиму работает иначе, а также добавляет вещи, которые носятся только зимой.
 */
import {autumnData} from './autumn.js';

const WINTER_SHOES = 'Зима (0…+15)';

/** Копии вещей из списка по id. Ошибка, если вещи нет, чтобы опечатка не прошла молча. */
function pick(list, ids) {
  return ids.map((id) => {
    const item = list.find((candidate) => candidate.id === id);
    if (!item) {
      throw new Error(`Нет вещи с id «${id}»`);
    }
    return {...item};
  });
}

export function winterData() {
  const autumn = autumnData();

  const outer = pick(autumn.outer, ['tra', 'ma1', 'chd', 'tai', 'eis', 'vd', 'vc', 'tu']);
  outer.splice(
    4,
    0,
    {
      id: 'det2',
      group: 'Куртки',
      name: 'Carhartt WIP OG Detroit',
      colorName: 'Air Force Blue / Black, aged canvas',
      hex: '#4A5F78',
      minTemp: 5,
      maxOverLight: 15,
      maxOverHeavy: 15,
      warmBelow: 10,
    },
    {
      id: 'rx',
      group: 'Куртки',
      name: 'Patagonia Classic Retro-X',
      colorName: 'Natural, флис',
      hex: '#EDE6D3',
      minTemp: 0,
      minTempByKind: {sw: 5},
      maxOverLight: 10,
      maxOverHeavy: 10,
      warmBelow: 0,
      kinds: ['sw', 'vs'],
    },
    {
      id: 'rxt',
      group: 'Куртки',
      name: 'Patagonia Retro-X поверх Taion',
      colorName: 'Natural, флис поверх пухового лайнера',
      hex: '#EDE6D3',
      minTemp: 0,
      maxOverLight: 8,
      maxOverHeavy: 8,
      warmBelow: 0,
      kinds: ['sw'],
      noRain: true,
    },
  );

  const layers = pick(autumn.layers, [
    'tb',
    'tw',
    'tg',
    'tg2',
    'tm',
    'swd',
    'swf',
    'sws',
    'swl',
    'ssm',
    'ssu',
    'ssh',
    'ssn',
    'ssc',
    'hc',
    'ha1',
    'ha2',
    'hv',
    'tuv',
  ]);
  layers.forEach((layer) => {
    if (layer.kind === 'tee') {
      layer.outer = null; // зимой футболка не бывает верхним слоем
    }
    if (layer.kind === 'sw') {
      layer.under = [0, 15];
    }
    if (layer.kind === 'hd') {
      layer.under = [5, 15];
    }
  });

  const bottoms = pick(autumn.bottoms, ['bw', 'bn1', 'bn2', 'be', 'bd', 'bu', 'bm']);
  bottoms.forEach((bottom) => {
    bottom.range = [0, 15];
  });

  const shoes = [
    {
      id: 'jor',
      group: WINTER_SHOES,
      name: 'Nike Jordan Era CMFT',
      colorName: 'Obsidian / Lucky Green / Chile Red / Pale Ivory',
      hex: '#2B3550',
      dry: [0, 15],
    },
    {id: 'gnyc', group: WINTER_SHOES, name: 'ASICS GEL-NYC', colorName: 'Steeple Grey', hex: '#9C9C9E', dry: [0, 15]},
    {
      id: 'n580',
      group: WINTER_SHOES,
      name: 'New Balance 580',
      colorName: 'White / Nightwatch Green',
      hex: '#EDEBE4',
      dry: [0, 15],
    },
    {
      id: 'n990n',
      group: WINTER_SHOES,
      name: 'New Balance 990v3',
      colorName: 'Navy / Castlerock',
      hex: '#2F3B57',
      dry: [0, 15],
    },
    {
      id: 'miz',
      group: WINTER_SHOES,
      name: 'Mizuno Wave Rider Beta',
      colorName: 'Silver Cloud / White Sand / Cedar',
      hex: '#BFC3C4',
      dry: [5, 12],
    },
    {
      id: 'swc',
      group: WINTER_SHOES,
      name: 'Stepney Workers Club Amiel S-Strike',
      colorName: 'Cordura Black',
      hex: '#3B3B3D',
      dry: [0, 15],
      rain: [0, 15],
    },
    {
      id: 'shp',
      group: WINTER_SHOES,
      name: 'New Balance 2002R Protection Pack',
      colorName: 'Shipyard, тон-в-тон серо-бежевый (greige)',
      hex: '#BDB5A6',
      dry: [8, 15],
      rain: [0, 15],
    },
    {
      id: 'c90',
      group: WINTER_SHOES,
      name: 'Saucony Cross 90',
      colorName: 'кремовый',
      hex: '#E7DEC7',
      dry: [0, 15],
      rain: [0, 15],
    },
    {
      id: 'tim',
      group: 'Круглый год',
      name: 'Timberland Authentic 3-Eye Boat Shoe',
      colorName: 'Burgundy',
      hex: '#6E2230',
      dry: [0, 15],
      rain: [0, 15],
    },
    {
      id: 'bl5',
      group: 'Дождь и сухо',
      name: 'Blundstone 585',
      colorName: 'Rustic Brown',
      hex: '#7C4B2B',
      dry: [0, 15],
      rain: [0, 15],
    },
    {
      id: 'bl7',
      group: 'Дождь и сухо',
      name: 'Blundstone 587',
      colorName: 'Rustic Black',
      hex: '#1E1E1E',
      dry: [0, 15],
      rain: [0, 15],
    },
  ];

  const headwear = pick(autumn.headwear, ['b1', 'b2', 'b3', 'cDi']);
  headwear.forEach((item) => {
    if (item.group.startsWith('Шапки')) {
      item.group = 'Шапки (0…+12)';
      item.range = [0, 12];
    }
  });

  const scarves = pick(autumn.scarves, ['sc1', 'sc2', 'sc3']);
  scarves.forEach((scarf) => {
    scarf.range = [0, 10];
  });

  return {outer, layers, bottoms, shoes, headwear, scarves};
}
