import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swatchBackground} from '../js/ui/templates.js';

test('один цвет — сплошной фон, несколько — основной 60% (два цвета) или 52% (три и больше), детали делят остаток', () => {
  assert.equal(swatchBackground({hex: '#111111', colors: ['#111111']}), '#111111');
  assert.equal(swatchBackground({hex: null, colors: []}), null);
  assert.equal(
    swatchBackground({hex: '#111111', colors: ['#111111', '#222222']}),
    'linear-gradient(180deg, #111111 0% 60%, #222222 60% 100%)',
  );
  assert.equal(
    swatchBackground({hex: '#111111', colors: ['#111111', '#222222', '#333333']}),
    'linear-gradient(180deg, #111111 0% 52%, #222222 52% 76%, #333333 76% 100%)',
  );
});
