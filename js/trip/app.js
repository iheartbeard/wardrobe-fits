/**
 * Страница «Капсула в поездку»: форма поездки, капсула с закреплением и исключением вещей,
 * план по дням и чек-лист сборов. Состояние хранится в localStorage, поэтому собранная капсула
 * открывается и без сети.
 */
import {esc} from '../ui/templates.js';
import {formatTemp} from '../lib/temperature.js';
import {LUGGAGE, SLOT_TITLES, buildCapsule, buildPool, capsuleSlot, manualDays, planDays} from './capsule.js';
import {searchPlaces, tripWeather} from './forecast.js';

const STORAGE_KEY = 'garderob-trip';
const SLOT_ORDER = ['o', 'm', 't', 'b', 's', 'h', 'sc'];
const doc = document;
const $ = (id) => doc.getElementById(id);

const defaults = () => {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    mode: 'place',
    query: '',
    place: null,
    start: iso(start),
    end: iso(end),
    manual: {days: 7, tmin: 12, tmax: 20, rain: false},
    luggage: 'cabin',
    built: false,
    pinned: [],
    excluded: [],
    packed: [],
    weather: null,
  };
};

function load() {
  try {
    return {...defaults(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')};
  } catch {
    return defaults();
  }
}

let state = load();
let pool = null;
let lastCapsule = null;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* без хранилища капсула просто не запоминается */
  }
}

const status = (text) => {
  $('status').textContent = text;
};

const dot = (item) =>
  `<span class="dot${item.hex ? '' : ' nc'}"${item.hex ? ` style="--swatch:${esc(item.hex)}"` : ''}></span>`;
const miniDot = (item) =>
  `<i class="cd${item.hex ? '' : ' nc'}"${item.hex ? ` style="--swatch:${esc(item.hex)}"` : ''}></i>`;

const PIN_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4v2h-5v6l-1 1-1-1v-6H6v-2l4-4z" fill="currentColor"/></svg>';
const X_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function weekday(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {weekday: 'short', day: 'numeric', month: 'short'});
}

/* ---------- форма ---------- */

function renderForm() {
  doc
    .querySelectorAll('#mode button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  $('place-fields').hidden = state.mode !== 'place';
  $('manual-fields').hidden = state.mode !== 'manual';
  $('q').value = state.place ? state.place.name : state.query;
  $('start').value = state.start;
  $('end').value = state.end;
  $('days').value = state.manual.days;
  $('tmin').value = state.manual.tmin;
  $('tmax').value = state.manual.tmax;
  $('rain').checked = state.manual.rain;
  $('luggage').innerHTML = Object.entries(LUGGAGE)
    .map(
      ([key, lug]) =>
        `<button type="button" data-lug="${key}" aria-pressed="${key === state.luggage}">${esc(lug.label)}</button>`,
    )
    .join('');
}

function readForm() {
  state.start = $('start').value;
  state.end = $('end').value;
  state.manual = {
    days: Number($('days').value) || 1,
    tmin: Number($('tmin').value),
    tmax: Number($('tmax').value),
    rain: $('rain').checked,
  };
}

function renderPlaces(list) {
  const box = $('places');
  if (!list.length) {
    box.hidden = false;
    box.innerHTML = '<p class="note">Ничего не нашлось. Попробуй по-другому или по-английски.</p>';
    return;
  }
  box.hidden = false;
  box.innerHTML = list
    .map(
      (p, i) =>
        `<button type="button" class="btn place" data-i="${i}">${esc(p.name)}<span>${esc([p.admin, p.country].filter(Boolean).join(', '))}</span></button>`,
    )
    .join('');
  box.onclick = (event) => {
    const button = event.target.closest('[data-i]');
    if (!button) {
      return;
    }
    state.place = list[Number(button.dataset.i)];
    state.query = state.place.name;
    box.hidden = true;
    $('q').value = `${state.place.name}${state.place.country ? `, ${state.place.country}` : ''}`;
    save();
  };
}

async function findPlace() {
  const query = $('q').value.trim();
  if (!query) {
    return;
  }
  state.query = query;
  state.place = null;
  status('Ищу место…');
  try {
    const list = await searchPlaces(query);
    renderPlaces(list);
    if (list.length === 1) {
      $('places').querySelector('[data-i]').click();
    }
    status('');
  } catch {
    status('Без сети место не найти. Можно задать погоду вручную.');
  }
}

/* ---------- сборка ---------- */

function tripDays() {
  if (state.mode === 'manual') {
    return manualDays(state.manual);
  }
  return state.weather ? state.weather.days : [];
}

async function submit() {
  readForm();
  if (state.mode === 'place') {
    if (!state.place) {
      await findPlace();
      if (!state.place) {
        status('Выбери место из списка.');
        return;
      }
    }
    if (!state.start || !state.end || state.end < state.start) {
      status('Проверь даты поездки.');
      return;
    }
    status('Смотрю погоду…');
    try {
      state.weather = {
        ...(await tripWeather(state.place, state.start, state.end)),
        place: state.place.name,
        start: state.start,
        end: state.end,
      };
    } catch {
      if (!state.weather) {
        status('Погоду получить не удалось. Можно задать её вручную.');
        return;
      }
      status('Погоду обновить не удалось, беру сохранённую.');
    }
  }
  save();
  rebuild();
}

function rebuild() {
  const days = tripDays();
  if (!days.length) {
    return;
  }
  status('Собираю капсулу…');
  setTimeout(() => {
    pool = pool || buildPool();
    const capsule = buildCapsule(pool, days, {
      luggage: state.luggage,
      pinned: state.pinned,
      excluded: state.excluded,
    });
    const plan = planDays(pool, capsule, days);
    state.packed = state.packed.filter((id) => capsule.ids.includes(id));
    state.built = true;
    save();
    renderResult(capsule, plan, days);
    status('');
  }, 30);
}

/* ---------- результат ---------- */

/** В дорогу надевается самое тёплое: куртка и обувь с самой низкой нижней границей. */
function travelWear(capsule) {
  const lowest = (slot, low) =>
    capsule.ids.filter((id) => pool.items[id].slot === slot).sort((a, b) => low(pool.items[a]) - low(pool.items[b]))[0];
  const shoeLow = (s) => Math.min(...[s.dry, s.rain].filter(Boolean).map((r) => r[0]));
  return [lowest('o', (o) => o.minTemp), lowest('s', shoeLow)].filter(Boolean);
}

function renderStats(capsule, days) {
  const clothes = capsule.ids.filter((id) => !['h', 'sc'].includes(pool.items[id].slot)).length;
  const temps = days.map((d) => d.t);
  const rainy = days.filter((d) => d.rain).length;
  $('stats').innerHTML = [
    [capsule.ids.length, 'вещей', `из них ${clothes} одежда и обувь`],
    [capsule.outfits.length, 'сочетаний', 'без цветовых конфликтов'],
    [
      days.length,
      days.length === 1 ? 'день' : 'дней',
      `${formatTemp(Math.min(...temps))}…${formatTemp(Math.max(...temps))} °C${rainy ? `, дождь ${rainy}` : ''}`,
    ],
  ]
    .map(([n, label, sub]) => `<div class="stat"><b>${n}</b><span>${label}</span><small>${esc(sub)}</small></div>`)
    .join('');

  const w = state.mode === 'place' && state.weather;
  $('wx').innerHTML = w
    ? `<p class="note">${esc(w.place)}, ${esc(weekday(w.start))} — ${esc(weekday(w.end))}${weekday(w.end).endsWith('.') ? '' : '.'} ${
        w.source === 'forecast'
          ? 'Прогноз Open-Meteo, ощущаемая температура днём.'
          : `Прогноза на эти даты ещё нет, взята погода тех же дат ${w.year} года как ориентир. Ближе к поездке пересобери.`
      }</p>`
    : '<p class="note">Погода задана вручную: температуры разложены по дням от тёплых к прохладным.</p>';

  const lines = [];
  const name = (c) => `${formatTemp(c.t)}${c.rain ? ' в дождь' : ''}`;
  if (capsule.impossible.length) {
    lines.push(`Для ${capsule.impossible.map(name).join(', ')} в гардеробе нет подходящего образа.`);
  }
  const tight = capsule.gaps.filter((g) => !capsule.impossible.includes(g));
  if (tight.length) {
    lines.push(`Для ${tight.map(name).join(', ')} образ не уместился в лимит багажа, попробуй «Чемодан».`);
  }
  $('gaps').hidden = !lines.length;
  $('gaps').textContent = lines.join(' ');
}

function renderCapsule(capsule) {
  const usage = {};
  capsule.outfits.forEach((outfit) =>
    outfit.ids.forEach((id) => {
      usage[id] = (usage[id] || 0) + 1;
    }),
  );
  const wear = travelWear(capsule);
  const bySlot = {};
  capsule.ids.forEach((id) => {
    const slot = capsuleSlot(pool.items[id]);
    (bySlot[slot] = bySlot[slot] || []).push(pool.items[id]);
  });
  $('capsule').innerHTML = SLOT_ORDER.filter((slot) => bySlot[slot])
    .map((slot) => {
      const cards = bySlot[slot]
        .map((item) => {
          const pinned = state.pinned.includes(item.id);
          const tags = [
            usage[item.id] ? `в ${usage[item.id]} сочет.` : '',
            wear.includes(item.id) ? 'надеть в дорогу' : '',
          ].filter(Boolean);
          return (
            `<div class="card tcard${pinned ? ' pinned' : ''}">${dot(item)}<span class="nm">${esc(item.name)}</span>` +
            `<span class="meta"><span>${esc(item.colorName)}</span>${tags.map((t) => `<span class="tg">${esc(t)}</span>`).join('')}</span>` +
            `<span class="acts"><button type="button" class="ib" data-pin="${esc(item.id)}" aria-pressed="${pinned}" aria-label="${pinned ? 'Открепить' : 'Закрепить'}: ${esc(item.name)}" title="${pinned ? 'Открепить' : 'Беру точно'}">${PIN_ICON}</button>` +
            `<button type="button" class="ib" data-ex="${esc(item.id)}" aria-label="Не брать: ${esc(item.name)}" title="Не брать">${X_ICON}</button></span></div>`
          );
        })
        .join('');
      const limit = capsule.limits[slot];
      const counter = limit ? ` <span class="cnt">${bySlot[slot].length} из ${limit}</span>` : '';
      return `<div class="grp"><h3>${SLOT_TITLES[slot]}${counter}</h3><div class="cards">${cards}</div></div>`;
    })
    .join('');

  const excluded = state.excluded.filter((id) => pool.items[id]);
  $('excluded-wrap').hidden = !excluded.length;
  $('excluded').innerHTML = excluded
    .map(
      (id) =>
        `<button type="button" class="chip chip--btn" data-back="${esc(id)}" title="Вернуть">${miniDot(pool.items[id])}${esc(pool.items[id].name)} ↺</button>`,
    )
    .join('');
}

function renderPlan(plan) {
  $('plan').innerHTML = plan
    .map(({day, outfit, tee, head, scarf}, index) => {
      const title = day.date ? weekday(day.date) : `День ${index + 1}`;
      const range = day.tmin != null ? `<small>${formatTemp(day.tmin)}…${formatTemp(day.tmax)}</small>` : '';
      const badge = day.rain ? '<span class="rainy">дождь</span>' : '';
      if (!outfit) {
        return `<article class="day"><header><b>${esc(title)}</b><span class="t">${formatTemp(day.t)}°${range}</span>${badge}</header><p class="note">Нет образа из капсулы на эту погоду.</p></article>`;
      }
      const ids = [outfit.o !== 'none' ? outfit.o : null, tee, outfit.m, outfit.b, outfit.s, head, scarf].filter(
        Boolean,
      );
      const unique = [...new Set(ids)];
      const items = unique
        .map(
          (id) =>
            `<li>${miniDot(pool.items[id])}<span>${esc(pool.items[id].name)} <em>${esc(pool.items[id].colorName)}</em></span></li>`,
        )
        .join('');
      const swatches = unique.map((id) => miniDot(pool.items[id])).join('');
      return (
        `<article class="day"><header><b>${esc(title)}</b><span class="t">${formatTemp(day.t)}°${range}</span>${badge}</header>` +
        `<div class="dots">${swatches}</div><ul>${items}</ul></article>`
      );
    })
    .join('');
}

function renderPack(capsule) {
  const wear = travelWear(capsule);
  const items = SLOT_ORDER.flatMap((slot) => capsule.ids.filter((id) => capsuleSlot(pool.items[id]) === slot));
  $('pack').innerHTML = items
    .map((id) => {
      const item = pool.items[id];
      const done = state.packed.includes(id);
      return (
        `<li><label class="${done ? 'done' : ''}"><input type="checkbox" data-pack="${esc(id)}"${done ? ' checked' : ''} />` +
        `${miniDot(item)}<span>${esc(item.name)} <em>${esc(item.colorName)}</em>${wear.includes(id) ? ' <span class="tg">в дорогу</span>' : ''}</span></label></li>`
      );
    })
    .join('');
  const left = items.length - state.packed.length;
  $('pack-hint').textContent = left ? `Осталось уложить: ${left}. Отметки сохраняются на телефоне.` : 'Всё уложено.';
}

function renderResult(capsule, plan, days) {
  $('out').hidden = false;
  renderStats(capsule, days);
  renderCapsule(capsule);
  renderPlan(plan);
  renderPack(capsule);
  lastCapsule = capsule;
}

/* ---------- события ---------- */

function toggle(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function bind() {
  $('mode').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) {
      readForm();
      state.mode = button.dataset.mode;
      save();
      renderForm();
    }
  });
  $('luggage').addEventListener('click', (event) => {
    const button = event.target.closest('[data-lug]');
    if (button) {
      state.luggage = button.dataset.lug;
      save();
      renderForm();
      if (lastCapsule) {
        rebuild();
      }
    }
  });
  $('find').addEventListener('click', findPlace);
  $('q').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      findPlace();
    }
  });
  $('q').addEventListener('input', () => {
    state.place = null;
  });
  $('form').addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  $('capsule').addEventListener('click', (event) => {
    const pin = event.target.closest('[data-pin]');
    const ex = event.target.closest('[data-ex]');
    if (pin) {
      state.pinned = toggle(state.pinned, pin.dataset.pin);
    } else if (ex) {
      state.excluded = [...state.excluded, ex.dataset.ex];
      state.pinned = state.pinned.filter((id) => id !== ex.dataset.ex);
    } else {
      return;
    }
    save();
    rebuild();
  });
  $('excluded').addEventListener('click', (event) => {
    const back = event.target.closest('[data-back]');
    if (back) {
      state.excluded = state.excluded.filter((id) => id !== back.dataset.back);
      save();
      rebuild();
    }
  });
  $('pack').addEventListener('change', (event) => {
    const box = event.target.closest('[data-pack]');
    if (box) {
      state.packed = toggle(state.packed, box.dataset.pack);
      save();
      renderPack(lastCapsule);
    }
  });
  $('unpack').addEventListener('click', () => {
    state.packed = [];
    save();
    renderPack(lastCapsule);
  });
}

renderForm();
bind();
if (state.built) {
  rebuild();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
