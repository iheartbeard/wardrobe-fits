/** Слоты образа. Ключи короткие, потому что используются в data-атрибутах карточек. */
export const SLOTS = ['o', 't', 'm', 'b', 's', 'h', 'sc'];

/** Фильтр погоды: ключ и подпись. */
export const WEATHER_FILTERS = [
  {key: 'any', label: 'Любая'},
  {key: 'dry', label: 'Сухо'},
  {key: 'rain', label: 'Дождь'},
];

/** Подписи типов вещей в карточках образов. */
export const LAYER_LABELS = {
  tee: 'Футболка',
  sw: 'Свитер',
  ss: 'Свитшот',
  hd: 'Худи',
  rg: 'Регби',
  os: 'Овершот',
  vs: 'Жилетка',
};

export const STORAGE_KEYS = {
  season: 'garderob-season',
  weather: 'garderob-weather',
};

export const DEFAULT_LOCATION = {lat: 43.3036, lon: -2.9742, place: 'Эрандио'};

/** Количество образов в подборе под выбранную обувь. */
export const SUGGESTION_COUNT = 5;
