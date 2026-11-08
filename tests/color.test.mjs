import {test} from 'node:test';
import assert from 'node:assert/strict';
import {colorFamily, evaluateColors, loudHue} from '../js/lib/color.js';

const part = (hex, slot = 'm') => ({hex, slot});

test('colorFamily узнаёт базовые семейства', () => {
  assert.equal(colorFamily('#1E1E1E'), 'black');
  assert.equal(colorFamily('#F3F3F0'), 'white');
  assert.equal(colorFamily('#20304F'), 'navy');
  assert.equal(colorFamily('#A8392E'), 'red');
  assert.equal(colorFamily('#5F6B4B'), 'olive');
});

test('loudHue есть только у ярких насыщенных цветов', () => {
  assert.equal(loudHue('#8B8E92'), null);
  assert.notEqual(loudHue('#E2B83B'), null);
});

test('красный и насыщенный зелёный не сочетаются', () => {
  assert.equal(evaluateColors([part('#A8392E'), part('#2E9E3E')]), null);
});

test('три предмета одного яркого цвета — перебор', () => {
  const red = '#A8392E';
  assert.equal(evaluateColors([part(red), part(red), part(red)]), null);
});

test('спокойные цвета сочетаются и получают пояснения', () => {
  const result = evaluateColors([part('#1E1E1E'), part('#8B8E92'), part('#F3F3F0', 's')]);
  assert.ok(result);
  assert.ok(result.reasons.length > 0);
});

test('сочетание из подборки Васо даёт бонус', () => {
  const parts = [part('#A8392E'), part('#20304F'), part('#F3F3F0')];
  const palettes = [{name: 'тест', colors: ['#A8392E', '#20304F', '#FFFFFF']}];
  const plain = evaluateColors(parts, []);
  const boosted = evaluateColors(parts, palettes);
  assert.equal(boosted.score, plain.score + 2);
});
