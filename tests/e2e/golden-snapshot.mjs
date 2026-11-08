/*
 * Снимок поведения страницы через интерфейс: клики по карточкам, полосам температур, погоде и готовым образам.
 * Сравнивается с golden.json, чтобы рефакторинг не менял поведение. Погода подменяется (ощущаемые +17 °C, без дождя).
 */
import {chromium} from 'playwright';

export async function takeSnapshot(url) {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 1200, height: 900}});
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        current: {apparent_temperature: 17, precipitation: 0, weather_code: 3},
        minutely_15: {precipitation: [0, 0, 0, 0, 0, 0, 0, 0]},
      },
    }),
  );
  await p.route('**/api.bigdatacloud.net/**', (r) => r.abort());
  await p.route('**/fonts.*/**', (r) => r.abort());
  await p.goto(url);
  await p.waitForTimeout(600);
  const snap = () =>
    p.evaluate(() => {
      const q = (s) => [...document.querySelectorAll(s)].map((c) => c.dataset.slot + ':' + c.dataset.id).sort();
      return {
        count: document.getElementById('count').textContent,
        chips: document.getElementById('chips').innerText,
        off: q('.card:disabled'),
        ideal: q('.card.ideal'),
        fit: q('.card.fit'),
        looks: [...document.querySelectorAll('#lgrid .look')].map((l) => l.innerText.replace(/\s+/g, ' ')),
        lgridEmpty: !!document.querySelector('#lgrid .empty'),
        reset: document.getElementById('reset').disabled,
        five: document.getElementById('five').disabled,
        hint: document.getElementById('fivehint').textContent,
        bands: [...document.querySelectorAll('#bands button')]
          .map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : ''))
          .join('|'),
        h1: document.getElementById('h1').textContent,
      };
    });
  const rs = async () => {
    if (!(await p.$eval('#reset', (e) => e.disabled))) await p.click('#reset');
  };
  const res = {};
  for (const season of ['autumn', 'winter']) {
    await p.click(`[data-season=${season}]`);
    res[season] = {};
    res[season].init = await snap();
    res[season].static = await p.evaluate(() =>
      [...document.querySelectorAll('.card')]
        .map((c) => c.dataset.slot + ':' + c.dataset.id + '|' + c.innerText.replace(/\s+/g, ' '))
        .join('\n'),
    );
    const bands = await p.$$eval('#bands button', (els) => els.map((e) => e.dataset.band));
    for (const bd of bands) {
      await p.click(`[data-band="${bd}"]`);
      res[season]['band_' + bd] = await snap();
      await rs();
    }
    for (const w of ['dry', 'rain', 'any']) {
      await p.click(`[data-wx=${w}]`);
      res[season]['wx_' + w] = await snap();
      await rs();
    }
    const ids = await p.$$eval('.card', (els) => els.map((e) => e.dataset.slot + ':' + e.dataset.id));
    for (const id of ids) {
      const [s, i] = id.split(':');
      const el = await p.$(`.card[data-slot=${s}][data-id="${i}"]`);
      if (await el.isDisabled()) continue;
      await el.click();
      res[season]['sel_' + id] = await snap();
      await rs();
    }
    // пары: куртка + обувь, свитер + обувь, футболка + свитшот, none + tee
    const combos =
      season === 'autumn'
        ? [
            ['o:none', 't:tw'],
            ['o:none', 'm:ssm'],
            ['o:ma1', 's:n990t'],
            ['o:rok', 'b:ue', 's:gnyc'],
            ['s:bl5', 'b:be'],
            ['m:hc', 's:pal'],
            ['o:tu', 'm:swf'],
            ['o:eis', 'm:tuv'],
          ]
        : [
            ['o:rxt', 'm:swf'],
            ['o:rx', 'm:tuv'],
            ['o:tai', 's:jor'],
            ['o:chd', 'm:tuv'],
            ['o:none', 't:tg'],
            ['s:swc', 'b:bn1'],
            ['o:det2', 'm:ha2', 's:miz'],
          ];
    for (const cb of combos) {
      let ok = true;
      for (const c of cb) {
        const [s, i] = c.split(':');
        const el = await p.$(`.card[data-slot=${s}][data-id="${i}"]`);
        if (!el || (await el.isDisabled())) {
          ok = false;
          break;
        }
        await el.click();
      }
      res[season]['combo_' + cb.join('+')] = ok ? await snap() : 'unavailable';
      await rs();
    }
    // клик по готовому образу
    const n = await p.$$eval('#lgrid .look', (e) => e.length);
    for (let i = 0; i < n; i++) {
      await (await p.$$('#lgrid .look'))[i].click();
      res[season]['look_' + i] = await snap();
      await rs();
    }
  }
  res.errors = errs;
  await b.close();
  return res;
}
