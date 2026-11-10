/**
 * Связывает форму «Место» с погодой: ручной ввод города, определение текущего места,
 * загрузка прогноза и передача его странице. Запросы устаревших ответов отбрасываются.
 */
import {
  defaultLocation,
  fetchWeather,
  getPosition,
  lookupPlace,
  readLocation,
  readWeatherCache,
  searchPlaces,
  writeLocation,
  writeWeatherCache,
} from './weather.js';
import {createPlaceForm} from './ui/place.js';

const UNKNOWN_PLACE = 'вы здесь';

/**
 * @param {Document} doc
 * @param {(weather: object) => void} onWeather Вызывается с кэшем, а потом со свежим прогнозом
 */
export async function startLocation(doc, onWeather) {
  const form = createPlaceForm(doc);
  let found = [];
  let loadId = 0;

  async function load(location) {
    const id = ++loadId;
    form.setCurrent(location.place, location.mode);
    try {
      const weather = await fetchWeather(location);
      if (id === loadId) {
        writeWeatherCache(weather);
        onWeather(weather);
        form.setStatus('');
      }
    } catch {
      if (id === loadId) {
        form.setStatus('Не удалось получить прогноз. Показан последний сохранённый.');
      }
    }
  }

  /** Определяет место по геолокации. Возвращает null, если браузер не дал координаты. */
  async function detect() {
    const position = await getPosition();
    if (!position) {
      return null;
    }
    const place = (await lookupPlace(position.lat, position.lon)) || UNKNOWN_PLACE;
    return {...position, place, mode: 'auto'};
  }

  form.onSearch(async (query) => {
    form.setStatus('Ищу…');
    try {
      found = await searchPlaces(query);
      form.setResults(found);
      form.setStatus(found.length ? 'Выбери место из списка.' : 'Ничего не нашлось. Попробуй другое название.');
    } catch {
      form.setStatus('Поиск не сработал. Проверь соединение.');
    }
  });

  form.onPick((index) => {
    const {place, lat, lon} = found[index];
    const location = {place, lat, lon, mode: 'manual'};
    writeLocation(location);
    form.setResults([]);
    form.clearInput();
    load(location);
  });

  form.onLocate(async () => {
    form.setBusy(true);
    form.setStatus('Определяю местоположение…');
    const location = await detect();
    form.setBusy(false);
    if (!location) {
      form.setStatus('Не удалось определить местоположение. Разреши доступ в браузере или введи город вручную.');
      return;
    }
    writeLocation(location);
    form.setResults([]);
    load(location);
  });

  form.show();
  const cached = readWeatherCache();
  if (cached) {
    onWeather(cached);
    form.setCurrent(cached.place, (readLocation() || {}).mode);
  }

  /* Вручную выбранное место сохраняется. Иначе при каждом запуске определяем место заново, а без разрешения
     берём последнее известное или Эрандио. */
  const saved = readLocation();
  if (saved && saved.mode === 'manual') {
    load(saved);
    return;
  }
  const detected = await detect();
  load(detected || saved || defaultLocation());
  if (detected) {
    writeLocation(detected);
  }
}
