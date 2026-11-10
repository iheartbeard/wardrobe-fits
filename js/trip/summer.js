/**
 * Летние вещи для поездок (+23…+32 °C). На главной странице лета пока нет, поэтому оно живёт здесь.
 * Обувь и кепки отмечены на лето. Шорт в гардеробе нет: лёгкие штаны отмечены до +22–23,
 * а здесь допущены на всё лето, иначе в жару не собрать ни одного образа. Футболки летом идут как верхний слой.
 */
import {autumnData} from '../data/autumn.js';

const SUMMER_SHOES = 'Лето (от +23)';
const SUMMER_RANGE = [23, 32];

function pick(list, ids) {
  return ids.map((id) => {
    const item = list.find((candidate) => candidate.id === id);
    if (!item) {
      throw new Error(`Нет вещи с id «${id}»`);
    }
    return {...item};
  });
}

export function summerData() {
  const autumn = autumnData();

  const layers = autumn.layers
    .filter((layer) => layer.kind === 'tee')
    .map((tee) => ({...tee, outer: SUMMER_RANGE, under: null}));

  const bottoms = pick(autumn.bottoms, ['g1', 'g2', 'g3', 'mb', 'ue']).map((bottom) => ({
    ...bottom,
    range: SUMMER_RANGE,
  }));

  const shoes = [
    {
      id: 'rpt',
      group: SUMMER_SHOES,
      name: 'Reebok Premier Trinity KFS',
      colorName: 'Mahogany / Sedona Rose',
      hex: '#8A5A4E',
      dry: SUMMER_RANGE,
    },
    {
      id: 'kua',
      group: SUMMER_SHOES,
      name: 'Keen Uneek WK x Afew',
      colorName: 'Past Forward, шоколадный',
      hex: '#5A3F2E',
      dry: SUMMER_RANGE,
    },
    {
      id: 'kun',
      group: SUMMER_SHOES,
      name: 'Keen Uneek',
      colorName: 'Natural / Birch',
      hex: '#E6DCC6',
      dry: SUMMER_RANGE,
    },
    {
      id: 'st4',
      group: SUMMER_SHOES,
      name: 'Saucony ProGrid Triumph 4',
      colorName: 'White / Onyx / Elm',
      hex: '#EDEBE3',
      dry: SUMMER_RANGE,
    },
    {
      id: 'nes',
      group: SUMMER_SHOES,
      name: 'END. x Saucony Triumph 4 «Nessie»',
      colorName: 'navy и бирюзовая замша',
      hex: '#1F2A44',
      dry: SUMMER_RANGE,
    },
    {
      id: 'n993d',
      group: SUMMER_SHOES,
      name: 'New Balance 993',
      colorName: 'Driftwood',
      hex: '#A69580',
      dry: SUMMER_RANGE,
    },
    {
      id: 'tim',
      group: 'Круглый год',
      name: 'Timberland Authentic 3-Eye Boat Shoe',
      colorName: 'Burgundy',
      hex: '#6E2230',
      dry: SUMMER_RANGE,
      rain: SUMMER_RANGE,
    },
  ];

  const headwear = pick(autumn.headwear, ['cP1', 'cP2', 'cK', 'cPa', 'cSl']).map((cap) => ({
    ...cap,
    range: SUMMER_RANGE,
  }));

  return {outer: [], layers, bottoms, shoes, headwear, scarves: []};
}

/** Описание летнего «сезона» в том же виде, что и SEASONS. */
export const SUMMER_SEASON = {
  label: 'Лето',
  title: 'Летний гардероб',
  hero: '',
  range: SUMMER_RANGE,
  scarfRange: '',
  bands: [],
  data: summerData,
  looks: [],
};
