/**
 * Текущая погода по местоположению. Координаты берутся у браузера (с разрешения),
 * погода из Open-Meteo, название места из BigDataCloud. Без разрешения или без сети
 * берётся последнее сохранённое место, а если его нет, Эрандио.
 */
import {DEFAULT_LOCATION, STORAGE_KEYS} from './config.js';

/** Коды погоды WMO, при которых идёт дождь, морось или гроза. */
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const RAIN_NOW_MM = 0.1;
const RAIN_SOON_MM = 0.5;
const GEOLOCATION_TIMEOUT_MS = 8000;
const GEOLOCATION_MAX_AGE_MS = 600000;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.weather) || 'null');
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.weather, JSON.stringify(value));
  } catch {
    /* без хранилища погода просто не кэшируется */
  }
}

/** Координаты округляются до двух знаков (около километра): точнее для погоды не нужно. */
function getPosition() {
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

async function lookupPlace(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ru`;
    const data = await (await fetch(url)).json();
    return data.city || data.locality || null;
  } catch {
    return null;
  }
}

async function fetchForecast({lat, lon}) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=apparent_temperature,precipitation,weather_code&minutely_15=precipitation&forecast_minutely_15=8&timezone=auto';
  return (await fetch(url)).json();
}

/** Для выбора слоёв берётся ощущаемая температура, а дождь считается и сейчас, и в ближайшие 2 часа. */
function summarize(forecast, location) {
  const current = forecast.current;
  if (!current) {
    return null;
  }
  const rainingNow = current.precipitation > RAIN_NOW_MM || RAIN_CODES.includes(current.weather_code);
  const upcoming = (forecast.minutely_15 && forecast.minutely_15.precipitation) || [];
  const soon = !rainingNow && upcoming.reduce((sum, mm) => sum + (mm || 0), 0) >= RAIN_SOON_MM;
  return {
    t: current.apparent_temperature,
    rain: rainingNow || soon,
    soon,
    lat: location.lat,
    lon: location.lon,
    place: location.place,
  };
}

/**
 * @param {(weather: object) => void} onWeather Вызывается сначала с кэшем, потом со свежими данными
 */
export async function startWeather(onWeather) {
  const cached = readCache();
  if (cached && cached.t != null) {
    onWeather(cached);
  }

  const position = await getPosition();
  let location = DEFAULT_LOCATION;
  if (position) {
    location = {...position, place: (await lookupPlace(position.lat, position.lon)) || 'вы здесь'};
  } else if (cached && cached.lat != null) {
    location = {lat: cached.lat, lon: cached.lon, place: cached.place || DEFAULT_LOCATION.place};
  }

  try {
    const weather = summarize(await fetchForecast(location), location);
    if (weather) {
      writeCache(weather);
      onWeather(weather);
    }
  } catch {
    /* нет сети: остаётся кэш или значение по умолчанию */
  }
}
