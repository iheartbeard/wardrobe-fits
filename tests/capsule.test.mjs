import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  LUGGAGE,
  buildCapsule,
  buildPool,
  capsuleSlot,
  manualDays,
  planDays,
  uniqueConditions,
} from '../js/trip/capsule.js';
import {evaluateColors} from '../js/lib/color.js';
import {dateRange} from '../js/trip/forecast.js';

const pool = buildPool();

const trips = {
  осень: {days: 7, tmin: 10, tmax: 18, rain: true},
  зима: {days: 5, tmin: 2, tmax: 10, rain: true},
  лето: {days: 10, tmin: 24, tmax: 30, rain: false},
  разброс: {days: 14, tmin: 8, tmax: 26, rain: true},
};

test('ручные дни включают обе границы и не выходят за них', () => {
  const days = manualDays({days: 5, tmin: 10, tmax: 20, rain: true});
  assert.equal(days.length, 5);
  const temps = days.map((d) => d.t);
  assert.ok(temps.includes(10) && temps.includes(20));
  assert.ok(temps.every((t) => t >= 10 && t <= 20));
  assert.ok(days.some((d) => d.rain));
  assert.deepEqual(manualDays({days: 1, tmin: 15, tmax: 15}), [{t: 15, rain: false}]);
});

test('условия поездки без повторов и в пределах гардероба', () => {
  const conds = uniqueConditions([{t: 40}, {t: 40}, {t: -10, rain: true}, {t: 12.4}]);
  assert.deepEqual(conds, [
    {t: 0, rain: true},
    {t: 12, rain: false},
    {t: 32, rain: false},
  ]);
});

test('даты поездки', () => {
  assert.deepEqual(dateRange('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});

for (const [name, trip] of Object.entries(trips)) {
  for (const luggage of Object.keys(LUGGAGE)) {
    test(`${name}, ${luggage}: капсула в лимитах, покрывает погоду, образы без цветовых конфликтов`, () => {
      const days = manualDays(trip);
      const capsule = buildCapsule(pool, days, {luggage});
      const counts = {};
      capsule.ids.forEach((id) => {
        const slot = capsuleSlot(pool.items[id]);
        counts[slot] = (counts[slot] || 0) + 1;
      });
      for (const slot of ['o', 'm', 'b', 's', 'h']) {
        assert.ok((counts[slot] || 0) <= capsule.limits[slot], `${slot}: ${counts[slot]} > ${capsule.limits[slot]}`);
      }
      assert.ok((counts.t || 0) >= 2, 'хотя бы две футболки');
      assert.deepEqual(capsule.gaps, [], 'все дни закрыты');
      capsule.outfits.forEach((outfit) => {
        assert.ok(outfit.ids.every((id) => capsule.ids.includes(id)));
        assert.ok(evaluateColors(outfit.ids.map((id) => pool.items[id])));
      });

      const plan = planDays(pool, capsule, days);
      assert.equal(plan.length, days.length);
      plan.forEach((entry) => assert.ok(entry.outfit, `образ на ${entry.day.t}`));
    });
  }
}

test('закреплённая вещь остаётся, убранная не попадает', () => {
  const days = manualDays(trips.осень);
  const base = buildCapsule(pool, days);
  const drop = base.ids.find((id) => capsuleSlot(pool.items[id]) === 's');
  const capsule = buildCapsule(pool, days, {pinned: ['bd'], excluded: [drop]});
  assert.ok(capsule.ids.includes('bd'));
  assert.ok(!capsule.ids.includes(drop));
});
