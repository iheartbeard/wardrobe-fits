/**
 * Приложение: состояние выбора, отрисовка и обработчики событий.
 * Вся работа с DOM собрана здесь, расчёты лежат в model.js, selection.js и suggest.js.
 */
import {SLOTS, WEATHER_FILTERS, STORAGE_KEYS, DEFAULT_LOCATION} from '../config.js';
import {SEASONS, DEFAULT_SEASON} from '../data/seasons.js';
import {buildModel, lookPairs} from '../model.js';
import {formatTemp} from '../lib/temperature.js';
import {cardStates, computeAvailability, emptySelection, matchLook} from '../selection.js';
import {pickFive, pickRandom} from '../suggest.js';
import {
  bandButtonsMarkup,
  chipMarkup,
  emptyMarkup,
  lookCardMarkup,
  randomLookMarkup,
  sectionsMarkup,
  seasonButtonsMarkup,
  suggestionMarkup,
  weatherButtonsMarkup,
} from './templates.js';

const FOOTNOTE =
  'Недоступными страница отмечает вещи, которые не подходят по температуре, слоям или погоде. Готовые образы подобраны вручную. Случайное сочетание проходит проверку цвета по теории: отсекаются только пары ярких насыщенных цветов, которые не соседние и не дополнительные (например, чистый красный с насыщенным зелёным). Землистые и приглушённые тона сочетаются свободно. Hex у Barbour Rokig примерный.';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* хранилище может быть недоступно (приватный режим), приложение работает и без него */
  }
}

/**
 * @param {Document} doc
 * @returns {{setWeather: (weather: {t: number, rain?: boolean, soon?: boolean, place?: string}) => void}}
 */
export function createApp(doc) {
  const $ = (id) => doc.getElementById(id);

  const state = {
    seasonKey: DEFAULT_SEASON,
    model: null,
    bands: [],
    bandKey: 'all',
    band: 0,
    weather: 'any',
    selection: emptySelection(),
    now: {t: 17, rain: false, soon: false, place: DEFAULT_LOCATION.place},
    hits: [],
  };

  /* Полосы температур: весь диапазон, полосы сезона и «Сейчас» с текущей погодой */
  function buildBands() {
    const {scale, season} = state.model;
    state.bands = [
      {key: 'all', label: 'Весь диапазон', mask: scale.all},
      ...season.bands.map(([key, lo, hi]) => ({
        key,
        label: `${formatTemp(lo)}…${formatTemp(hi)}`,
        mask: scale.mask(lo, hi),
      })),
      {key: 'now', label: '', mask: 0},
    ];
    updateNowBand();
  }

  function updateNowBand() {
    const band = state.bands.find((b) => b.key === 'now');
    if (!band) {
      return;
    }
    const {scale} = state.model;
    const {t, rain, soon, place} = state.now;
    const outOfSeason = t < scale.min || t > scale.max;
    const rainNote = rain ? (soon ? ', скоро дождь' : ', дождь') : '';
    band.label = `Сейчас · ${place}: ${formatTemp(t)} ощущ.${rainNote}${outOfSeason ? ' (вне сезона)' : ''}`;
    band.mask = scale.mask(t, t);
    if (state.bandKey === 'now') {
      state.band = band.mask;
    }
  }

  function renderControls() {
    $('seasons').innerHTML = seasonButtonsMarkup(SEASONS, state.seasonKey);
    $('bands').innerHTML = bandButtonsMarkup(state.bands, state.bandKey);
    $('wx').innerHTML = weatherButtonsMarkup(WEATHER_FILTERS, state.weather);
    $('sections').innerHTML = sectionsMarkup(state.model);
  }

  const currentState = () => ({selection: state.selection, weather: state.weather, band: state.band});

  function renderLooks() {
    const {model} = state;
    const rows = [];
    model.looks.forEach((look, index) => {
      const mask = matchLook(model, currentState(), look);
      if (mask) {
        rows.push(lookCardMarkup(model, look, index, mask));
      }
    });
    $('lgrid').innerHTML =
      rows.join('') ||
      emptyMarkup(
        'Под текущий выбор готовых образов нет. Список сочетаний выше всё равно учитывает температуру, слои и погоду.',
      );
    $('foot').textContent = FOOTNOTE;
  }

  /** Пересчитывает доступность и подсветку карточек и перерисовывает сводку и готовые образы. */
  function update() {
    const {model, selection} = state;
    const availability = computeAvailability(model, currentState());
    state.hits = availability.hits;
    const states = cardStates(model, currentState(), availability);

    doc.querySelectorAll('.card').forEach((card) => {
      const info = states.get(`${card.dataset.slot}:${card.dataset.id}`);
      card.setAttribute('aria-pressed', info.chosen);
      card.disabled = info.disabled;
      card.classList.toggle('ideal', info.ideal);
      card.classList.toggle('fit', info.fit);
    });

    $('count').textContent = `Сочетаний: ${availability.count.toLocaleString('ru-RU')}`;
    const chips = SLOTS.filter((slot) => selection[slot]).map((slot) => chipMarkup(model.byId[selection[slot]]));
    $('chips').innerHTML = chips.join('') || '<span class="note">Ничего не выбрано. Нажми на любую карточку.</span>';
    $('reset').disabled = !SLOTS.some((slot) => selection[slot]) && state.bandKey === 'all' && state.weather === 'any';
    renderLooks();
    $('rndout').innerHTML = '';
    $('fiveout').innerHTML = '';
    $('five').disabled = !selection.s;
    $('fivehint').textContent = selection.s
      ? ''
      : 'Выбери пару обуви ниже, и я подберу пять разных образов с разбросом по температуре.';
  }

  function render() {
    renderControls();
    update();
  }

  function applySeason(key) {
    state.seasonKey = key;
    state.model = buildModel(key);
    state.selection = emptySelection();
    state.bandKey = 'all';
    state.band = state.model.scale.all;
    state.weather = 'any';
    buildBands();
    doc.body.dataset.season = key;
    doc.title = 'Гардероб';
    $('h1').textContent = state.model.season.title;
    $('heroP').textContent = state.model.season.hero;
    render();
  }

  function resetSelection() {
    state.selection = emptySelection();
  }

  /* Обработчики */
  function onCardClick(card) {
    const {slot, id} = card.dataset;
    state.selection[slot] = state.selection[slot] === id ? null : id;
    update();
  }

  function onSeasonClick(button) {
    if (button.dataset.season === state.seasonKey) {
      return;
    }
    writeStorage(STORAGE_KEYS.season, button.dataset.season);
    applySeason(button.dataset.season);
  }

  function onBandClick(button) {
    state.bandKey = button.dataset.band;
    state.band = state.bands.find((b) => b.key === state.bandKey).mask;
    if (state.bandKey === 'now') {
      state.weather = state.now.rain ? 'rain' : 'dry';
    }
    resetSelection();
    render();
  }

  function onWeatherClick(button) {
    state.weather = button.dataset.wx;
    resetSelection();
    render();
  }

  function onLookClick(button) {
    const look = state.model.looks[Number(button.dataset.look)];
    resetSelection();
    lookPairs(state.model, look).forEach(([slot, id]) => {
      state.selection[slot] = id;
    });
    update();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  doc.addEventListener('click', (event) => {
    const target = event.target;
    const card = target.closest('.card');
    if (card && !card.disabled) {
      onCardClick(card);
      return;
    }
    const season = target.closest('button[data-season]');
    if (season) {
      onSeasonClick(season);
      return;
    }
    const band = target.closest('[data-band]');
    if (band) {
      onBandClick(band);
      return;
    }
    const weather = target.closest('[data-wx]');
    if (weather) {
      onWeatherClick(weather);
      return;
    }
    const look = target.closest('.look[data-look]');
    if (look) {
      onLookClick(look);
    }
  });

  $('reset').addEventListener('click', () => {
    resetSelection();
    state.bandKey = 'all';
    state.band = state.model.scale.all;
    state.weather = 'any';
    render();
  });

  $('five').addEventListener('click', () => {
    const picks = pickFive(state.model, currentState(), state.hits);
    $('fiveout').innerHTML = picks.length
      ? picks.map((candidate) => suggestionMarkup(state.model, candidate)).join('')
      : emptyMarkup('Под текущий выбор образов нет.');
  });

  $('rnd').addEventListener('click', () => {
    if (!state.hits.length) {
      $('rndout').innerHTML = emptyMarkup('Под текущий выбор сочетаний нет.');
      return;
    }
    const result = pickRandom(state.model, currentState(), state.hits);
    $('rndout').innerHTML = result
      ? randomLookMarkup(state.model, result)
      : emptyMarkup('Под текущий выбор не нашлось сочетания, которое проходит проверку по цвету.');
  });

  const saved = readStorage(STORAGE_KEYS.season);
  applySeason(saved && SEASONS[saved] ? saved : DEFAULT_SEASON);

  return {
    /** Текущая погода: обновляет полосу «Сейчас». Если она выбрана, подстраивает и фильтр дождя. */
    setWeather(weather) {
      state.now = {
        t: Math.round(weather.t),
        rain: Boolean(weather.rain),
        soon: Boolean(weather.soon),
        place: weather.place || state.now.place,
      };
      updateNowBand();
      if (state.bandKey === 'now') {
        state.weather = state.now.rain ? 'rain' : 'dry';
        resetSelection();
      }
      render();
    },
  };
}
