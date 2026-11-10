/**
 * Погода и местоположение. Координаты берутся у браузера (с разрешения) или находятся по названию города.
 * Погода: Open-Meteo (ощущаемая температура, осадки), поиск городов: геокодер Open-Meteo,
 * название места по координатам: BigDataCloud.
 */
import {DEFAULT_LOCATION, STORAGE_KEYS} from './config.js';

/** Коды погоды WMO, при которых идёт дождь, морось или гроза. */
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const RAIN_NOW_MM = 0.1;
const RAIN_SOON_MM = 0.5;
/** Завтрашний день считается дождливым, если с 8 до 22 часов выпадает не меньше этого, мм. */
const RAIN_TOMORROW_MM = 1;
const DAY_HOURS = [8, 22];
const GEOLOCATION_TIMEOUT_MS = 8000;
const GEOLOCATION_MAX_AGE_MS = 600000;
const SEARCH_RESULTS = 5;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* без хранилища выбор места и кэш погоды просто не сохраняются */
  }
}

/** Последняя полученная погода; старый формат кэша (без now) игнорируется. */
export function readWeatherCache() {
  const cached = readJson(STORAGE_KEYS.weather);
  return cached && cached.now ? cached : null;
}

export const writeWeatherCache = (weather) => writeJson(STORAGE_KEYS.weather, weather);

/** Выбранное место: {lat, lon, place, mode}, где mode — 'auto' (определено) или 'manual' (введено вручную). */
export const readLocation = () => readJson(STORAGE_KEYS.location);
export const writeLocation = (location) => writeJson(STORAGE_KEYS.location, location);
export const defaultLocation = () => ({...DEFAULT_LOCATION, mode: 'default'});

/** Координаты округляются до двух знаков (около километра): точнее для погоды не нужно. */
export function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: Number(position.coords.latitude.toFixed(2)),
          lon: Number(position.coords.longitude.toFixed(2)),
        }),
      () => resolve(null),
      {timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS},
    );
  });
}

/** Название места по координатам или null, если сервис недоступен. */
export async function lookupPlace(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ru`;
    const data = await (await fetch(url)).json();
    return data.city || data.locality || null;
  } catch {
    return null;
  }
}

/**
 * Поиск города по названию.
 * @returns {Promise<{place: string, details: string, lat: number, lon: number}[]>}
 */
export async function searchPlaces(query) {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(query)}&count=${SEARCH_RESULTS}&language=ru&format=json`;
  const data = await (await fetch(url)).json();
  return (data.results || []).map((r) => ({
    place: r.name,
    details: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: Number(r.latitude.toFixed(2)),
    lon: Number(r.longitude.toFixed(2)),
  }));
}

const nextDate = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** Диапазон ощущаемой температуры и дождь завтра в дневные часы (8–22) или null, если почасовых данных нет. */
function summarizeTomorrow(forecast) {
  const hourly = forecast.hourly;
  if (!hourly || !forecast.current || !forecast.current.time) {
    return null;
  }
  const date = nextDate(forecast.current.time.slice(0, 10));
  const temps = [];
  let rainMm = 0;
  hourly.time.forEach((time, i) => {
    const hour = Number(time.slice(11, 13));
    if (time.startsWith(date) && hour >= DAY_HOURS[0] && hour <= DAY_HOURS[1]) {
      if (Number.isFinite(hourly.apparent_temperature[i])) {
        temps.push(hourly.apparent_temperature[i]);
      }
      rainMm += hourly.precipitation[i] || 0;
    }
  });
  if (!temps.length) {
    return null;
  }
  return {lo: Math.min(...temps), hi: Math.max(...temps), rain: rainMm >= RAIN_TOMORROW_MM};
}

/** Для выбора слоёв берётся ощущаемая температура, а дождь считается и сейчас, и в ближайшие 2 часа. */
export function summarize(forecast, location) {
  const current = forecast.current;
  if (!current) {
    return null;
  }
  const rainingNow = current.precipitation > RAIN_NOW_MM || RAIN_CODES.includes(current.weather_code);
  const upcoming = (forecast.minutely_15 && forecast.minutely_15.precipitation) || [];
  const soon = !rainingNow && upcoming.reduce((sum, mm) => sum + (mm || 0), 0) >= RAIN_SOON_MM;
  return {
    place: location.place,
    lat: location.lat,
    lon: location.lon,
    now: {t: current.apparent_temperature, rain: rainingNow || soon, soon},
    tomorrow: summarizeTomorrow(forecast),
  };
}

/** Прогноз для места: сейчас и завтра. */
export async function fetchWeather(location) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}` +
    '&current=apparent_temperature,precipitation,weather_code' +
    '&hourly=apparent_temperature,precipitation&forecast_days=2' +
    '&minutely_15=precipitation&forecast_minutely_15=8&timezone=auto';
  const weather = summarize(await (await fetch(url)).json(), location);
  if (!weather) {
    throw new Error('В ответе нет текущей погоды');
  }
  return weather;
}
