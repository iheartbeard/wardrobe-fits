import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../js/weather.js';

const place = {place: 'Эрандио', lat: 43.3, lon: -2.97};

/** Прогноз на двое суток: сегодня и завтра, температуры и осадки задаются функциями от часа. */
function forecast({tomorrowTemp, tomorrowRain = () => 0, current = {}}) {
  const time = [];
  const apparent = [];
  const precipitation = [];
  for (const day of ['2026-11-30', '2026-12-01']) {
    for (let hour = 0; hour < 24; hour++) {
      time.push(`${day}T${String(hour).padStart(2, '0')}:00`);
      apparent.push(day === '2026-12-01' ? tomorrowTemp(hour) : 15);
      precipitation.push(day === '2026-12-01' ? tomorrowRain(hour) : 0);
    }
  }
  return {
    current: {time: '2026-11-30T12:00', apparent_temperature: 15, precipitation: 0, weather_code: 3, ...current},
    minutely_15: {precipitation: [0, 0, 0, 0, 0, 0, 0, 0]},
    hourly: {time, apparent_temperature: apparent, precipitation},
  };
}

test('завтра считается по дневным часам 8–22 и переходу через границу месяца', () => {
  const result = summarize(forecast({tomorrowTemp: (hour) => (hour < 8 || hour > 22 ? -5 : 8 + (hour % 4))}), place);
  assert.equal(result.tomorrow.lo, 8);
  assert.equal(result.tomorrow.hi, 11);
  assert.equal(result.tomorrow.rain, false);
});

test('завтра дождь, если за день выпадает не меньше 1 мм', () => {
  const rainy = summarize(forecast({tomorrowTemp: () => 10, tomorrowRain: (hour) => (hour === 9 ? 1.2 : 0)}), place);
  assert.equal(rainy.tomorrow.rain, true);
  const drizzle = summarize(forecast({tomorrowTemp: () => 10, tomorrowRain: (hour) => (hour === 9 ? 0.4 : 0)}), place);
  assert.equal(drizzle.tomorrow.rain, false);
});

test('сейчас: дождь по коду погоды или по осадкам в ближайшие два часа', () => {
  assert.equal(summarize(forecast({tomorrowTemp: () => 10, current: {weather_code: 61}}), place).now.rain, true);
  const soon = forecast({tomorrowTemp: () => 10});
  soon.minutely_15.precipitation = [0, 0, 0.3, 0.3, 0, 0, 0, 0];
  const result = summarize(soon, place);
  assert.equal(result.now.rain, true);
  assert.equal(result.now.soon, true);
});

test('без почасовых данных завтра нет, а текущая погода есть', () => {
  const result = summarize(
    {current: {time: '2026-11-30T12:00', apparent_temperature: 3, precipitation: 0, weather_code: 1}},
    place,
  );
  assert.equal(result.tomorrow, null);
  assert.equal(result.now.t, 3);
});

test('без текущей погоды результата нет', () => {
  assert.equal(summarize({}, place), null);
});
