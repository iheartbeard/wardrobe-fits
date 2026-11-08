import {createApp} from './ui/app.js';
import {startWeather} from './weather.js';

const app = createApp(document);
startWeather(app.setWeather);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
