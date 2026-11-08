/**
 * HTML-шаблоны страницы. Весь динамический текст проходит через esc(),
 * поэтому названия вещей с «&» или «<» не ломают разметку.
 */

const ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

export const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

/** Цветной кружок. Цвет передаётся через CSS-переменную, у вещей без цвета рисуется штриховка. */
const swatchAttr = (hex) => (hex ? ` style="--swatch:${esc(hex)}"` : '');

export const dotMarkup = (item) => `<span class="dot${item.hex ? '' : ' nc'}"${swatchAttr(item.hex)}></span>`;

export const chipMarkup = (item) =>
  `<span class="chip"><i class="cd${item.hex ? '' : ' nc'}"${swatchAttr(item.hex)}></i>${esc(item.name)}</span>`;

export function cardMarkup(item) {
  const hex = item.hex ? `<span class="hex">${esc(item.hex)}</span>` : '';
  return (
    `<button type="button" class="card${item.isNone ? ' none' : ''}" data-slot="${item.slot}" data-id="${esc(item.id)}" aria-pressed="false">` +
    `${dotMarkup(item)}<span class="nm">${esc(item.name)}</span>` +
    `<span class="meta"><span>${esc(item.colorName)}</span>${hex}</span></button>`
  );
}

/** Карточки, сгруппированные по полю group в порядке первого появления. */
export function groupsMarkup(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = item.group || '';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });
  return [...groups]
    .map(
      ([title, list]) =>
        `<div class="grp">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="cards">${list.map(cardMarkup).join('')}</div></div>`,
    )
    .join('');
}

const cardsGroup = (items, title = '') =>
  `<div class="grp">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="cards">${items.map(cardMarkup).join('')}</div></div>`;

export function sectionsMarkup(model) {
  const tees = model.layers.filter((layer) => layer.kind === 'tee');
  const others = model.layers.filter((layer) => layer.kind !== 'tee');
  return [
    `<section class="sec"><h2>Верхняя одежда</h2>${cardsGroup([model.noJacket])}${groupsMarkup(model.outer)}</section>`,
    `<section class="sec"><h2>Средний слой</h2><p class="hint hint--tight">Футболка и слой поверх неё выбираются отдельно, в каждой группе можно выбрать одну вещь.</p>${groupsMarkup(tees)}${groupsMarkup(others)}</section>`,
    `<section class="sec"><h2>Низ</h2>${cardsGroup(model.bottoms)}</section>`,
    `<section class="sec"><h2>Обувь</h2>${groupsMarkup(model.shoes)}</section>`,
    `<section class="sec"><h2>Аксессуары</h2>${groupsMarkup(model.headwear)}${cardsGroup([model.noScarf, ...model.scarves], `Шарфы (${model.season.scarfRange})`)}</section>`,
  ].join('');
}

export const seasonButtonsMarkup = (seasons, current) =>
  Object.entries(seasons)
    .map(
      ([key, season]) =>
        `<button type="button" data-season="${key}" aria-pressed="${key === current}">${esc(season.label)}</button>`,
    )
    .join('');

export const bandButtonsMarkup = (bands, currentKey) =>
  bands
    .map(
      (band) =>
        `<button type="button" data-band="${esc(band.key)}" aria-pressed="${band.key === currentKey}">${esc(band.label)}</button>`,
    )
    .join('');

export const weatherButtonsMarkup = (filters, current) =>
  filters
    .map(
      (filter) =>
        `<button type="button"${filter.key === 'rain' ? ' class="rainb"' : ''} data-wx="${filter.key}" aria-pressed="${filter.key === current}">${esc(filter.label)}</button>`,
    )
    .join('');

function lookBody(items, scale, mask, weatherPills, note) {
  const visible = items.filter((item) => item && !item.isNone);
  const dots = visible.map((item) => `<i class="${item.hex ? '' : 'nc'}"${swatchAttr(item.hex)}></i>`).join('');
  const rows = visible
    .map((item) => `<li class="rl"><b>${esc(item.type)}</b> — ${esc(`${item.name} · ${item.colorName}`)}</li>`)
    .join('');
  return (
    `<span class="dots">${dots}</span><ul>${rows}</ul>` +
    `<span class="tag">${weatherPills}<span class="pill">${esc(scale.describe(mask))} °C</span></span>${note}`
  );
}

const pill = (weather) =>
  weather === 'rain' ? '<span class="pill rain">дождь</span>' : '<span class="pill">сухо</span>';

/** Готовый образ: кнопка, которая выбирает его вещи. */
export function lookCardMarkup(model, look, index, mask) {
  const [outer, ...rest] = look.ids;
  const ids = [outer || 'none', ...(look.tee ? [look.tee] : []), ...rest];
  const items = ids.map((id) => (id ? model.byId[id] : null));
  const body = lookBody(items, model.scale, mask, pill(look.weather), `<span class="note">${esc(look.note)}</span>`);
  return `<button type="button" class="look" data-look="${index}">${body}</button>`;
}

/** Образ из подбора «5 образов». */
export function suggestionMarkup(model, candidate) {
  const pills =
    (candidate.dry ? '<span class="pill">сухо</span>' : '') +
    (candidate.rain ? '<span class="pill rain">дождь</span>' : '');
  return `<div class="look">${lookBody(candidate.parts, model.scale, candidate.mask, pills, '')}</div>`;
}

/** Случайное сочетание с пояснением оценки цвета. */
export function randomLookMarkup(model, result) {
  const note = `<span class="note">Цвет проверен: ${esc(result.evaluation.reasons.join('; '))}.</span>`;
  return `<div class="look look--static">${lookBody(result.parts, model.scale, result.mask, '', note)}</div>`;
}

export const emptyMarkup = (text) => `<p class="empty">${esc(text)}</p>`;
