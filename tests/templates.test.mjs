import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swatchBackground} from '../js/ui/templates.js';

test('один цвет — сплошной фон, несколько — диагональные доли', () => {
  assert.equal(swatchBackground({hex: '#111111', colors: ['#111111']}), '#111111');
  assert.equal(swatchBackground({hex: null, colors: []}), null);
  assert.equal(
    swatchBackground({hex: '#111111', colors: ['#111111', '#222222']}),
    'linear-gradient(135deg, #111111 0% 50%, #222222 50% 100%)',
  );
  assert.equal(
    swatchBackground({hex: '#111111', colors: ['#111111', '#222222', '#333333']}),
    'linear-gradient(135deg, #111111 0% 33.33%, #222222 33.33% 66.67%, #333333 66.67% 100%)',
  );
});
