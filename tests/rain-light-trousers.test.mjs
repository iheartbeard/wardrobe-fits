import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SEASONS} from '../js/data/seasons.js';
import {buildModel, lookMask} from '../js/model.js';

const LIGHT = ['g3', 'bd'];

for (const key of Object.keys(SEASONS)) {
  test(`${key}: светлые штаны (greige G-Pants, Double Knee) не предлагаются в дождь`, () => {
    const model = buildModel(key);
    const light = model.outfits.filter((outfit) => LIGHT.includes(outfit.b));
    assert.ok(light.every((outfit) => outfit.rain === 0));
    assert.ok(
      light.some((outfit) => outfit.dry),
      'в сухую погоду они остаются',
    );
    for (const look of SEASONS[key].looks.filter((l) => l.weather === 'rain' && LIGHT.includes(l.bottom))) {
      assert.equal(lookMask(model, look), 0, look.name || look.id);
    }
  });
}
