import {autumnData} from './autumn.js';
import {winterData} from './winter.js';
import {AUTUMN_LOOKS, WINTER_LOOKS} from './looks.js';

/**
 * Описание сезонов. Порядок ключей задаёт порядок кнопок на странице.
 * bands: полосы температур, которые показывает фильтр (кроме «Весь диапазон» и «Сейчас»).
 *
 * @typedef {object} SeasonConfig
 * @property {string} label Подпись на кнопке сезона
 * @property {string} title Заголовок страницы
 * @property {string} hero Подзаголовок
 * @property {[number, number]} range Диапазон температур сезона
 * @property {string} scarfRange Подпись диапазона шарфов
 * @property {[string, number, number][]} bands Полосы: [ключ, нижняя граница, верхняя граница]
 * @property {() => object} data Возвращает свежие данные вещей
 * @property {object[]} looks Готовые образы
 */

/** @type {Record<string, SeasonConfig>} */
export const SEASONS = {
  autumn: {
    label: 'Осень',
    title: 'Осенний гардероб',
    hero: 'Все вещи, которые ты носишь осенью, от +5 до +22 °C, сухо и в дождь. Выбери вещь, и несовместимые по температуре, слоям и погоде карточки станут недоступными.',
    range: [5, 22],
    scarfRange: '+5…+10',
    bands: [
      ['5', 5, 10],
      ['10', 10, 15],
      ['15', 15, 18],
      ['18', 18, 22],
    ],
    data: autumnData,
    looks: AUTUMN_LOOKS,
  },
  winter: {
    label: 'Зима',
    title: 'Зимний гардероб',
    hero: 'Вещи для зимы, от 0 до +15 °C, сухо и в дождь. Попадают только те, что отмечены на зиму. Выбери вещь, и несовместимые по температуре, слоям и погоде карточки станут недоступными.',
    range: [0, 15],
    scarfRange: '0…+10',
    bands: [
      ['0', 0, 5],
      ['5', 5, 10],
      ['10', 10, 15],
    ],
    data: winterData,
    looks: WINTER_LOOKS,
  },
};

export const DEFAULT_SEASON = 'autumn';
