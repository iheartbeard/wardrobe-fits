import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScale, formatTemp} from '../js/lib/temperature.js';

test('formatTemp ставит знак у положительных', () => {
  assert.equal(formatTemp(5), '+5');
  assert.equal(formatTemp(0), '0');
  assert.equal(formatTemp(-3), '-3');
});

test('mask обрезает диапазон по границам сезона', () => {
  const scale = createScale(5, 22);
  assert.deepEqual(scale.temps(scale.mask(0, 8)), [5, 6, 7, 8]);
  assert.deepEqual(scale.temps(scale.mask(20, 30)), [20, 21, 22]);
  assert.equal(scale.mask(30, 40), 0);
  assert.equal(scale.all, scale.mask(-100, 100));
});

test('describe подписывает диапазон', () => {
  const scale = createScale(0, 15);
  assert.equal(scale.describe(scale.mask(5, 10)), '+5…+10');
  assert.equal(scale.describe(scale.mask(0, 5)), '0…+5');
  assert.equal(scale.describe(scale.mask(7, 7)), 'только +7');
  assert.equal(scale.describe(0), '—');
});
