/**
 * Погода на даты поездки. Место ищется через геокодер Open-Meteo. Если поездка укладывается
 * в ближайшие 16 дней, берётся прогноз, иначе погода тех же дат прошлого года как ориентир.
 * Для выбора слоёв берётся ощущаемая температура днём (ближе к максимуму), дождь по вероятности и осадкам.
 */

const FORECAST_DAYS = 16;
const RAIN_PROBABILITY = 50;
const RAIN_MM = 2;
const DAY_WEIGHT = 0.65;

const iso = (date) => date.toISOString().slice(0, 10);
const parseDay = (value) => new Date(`${value}T12:00:00Z`);

/** @returns {Promise<{name: string, country: string, admin: string, lat: number, lon: number}[]>} */
export async function searchPlaces(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=ru&format=json`;
  const data = await (await fetch(url)).json();
  return (data.results || []).map((r) => ({
    name: r.name,
    country: r.country || '',
    admin: r.admin1 || '',
    lat: Number(r.latitude.toFixed(2)),
    lon: Number(r.longitude.toFixed(2)),
  }));
}

/** Список дат от start до end включительно (строки YYYY-MM-DD). */
export function dateRange(start, end) {
  const result = [];
  for (let d = parseDay(start); d <= parseDay(end) && result.length < 30; d.setUTCDate(d.getUTCDate() + 1)) {
    result.push(iso(d));
  }
  return result;
}

function shiftYear(value, years) {
  const d = parseDay(value);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return iso(d);
}

/**
 * @param {{lat: number, lon: number}} place
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 * @param {Date} [today]
 * @returns {Promise<{source: 'forecast'|'climate', days: {date: string, t: number, tmin: number, tmax: number, rain: boolean}[]}>}
 */
export async function tripWeather(place, start, end, today = new Date()) {
  const dates = dateRange(start, end);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + FORECAST_DAYS - 1);
  const useForecast = parseDay(dates[0]) >= parseDay(iso(today)) && parseDay(dates[dates.length - 1]) <= horizon;

  const daily = 'apparent_temperature_max,apparent_temperature_min,precipitation_sum';
  let url;
  let shift = 0;
  if (useForecast) {
    url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=${daily},precipitation_probability_max&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}&timezone=auto`;
  } else {
    /* Год назад или раньше, чтобы даты точно были в архиве */
    shift = -1;
    while (parseDay(shiftYear(dates[dates.length - 1], shift)) > today) {
      shift -= 1;
    }
    url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=${daily}&start_date=${shiftYear(dates[0], shift)}&end_date=${shiftYear(dates[dates.length - 1], shift)}&timezone=auto`;
  }

  const data = await (await fetch(url)).json();
  if (!data.daily) {
    throw new Error(data.reason || 'Нет данных о погоде');
  }
  const d = data.daily;
  const days = d.time.map((_, i) => {
    const tmax = d.apparent_temperature_max[i];
    const tmin = d.apparent_temperature_min[i];
    const probability = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
    const mm = d.precipitation_sum[i] || 0;
    return {
      date: dates[i] || shiftYear(d.time[i], -shift),
      t: Math.round(tmax * DAY_WEIGHT + tmin * (1 - DAY_WEIGHT)),
      tmin: Math.round(tmin),
      tmax: Math.round(tmax),
      rain: mm >= RAIN_MM || (probability != null && probability >= RAIN_PROBABILITY),
    };
  });
  return {
    source: useForecast ? 'forecast' : 'climate',
    year: useForecast ? null : parseDay(dates[0]).getUTCFullYear() + shift,
    days,
  };
}
