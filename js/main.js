import {startLocation} from './location.js';
import {createApp} from './ui/app.js';

const app = createApp(document);
startLocation(document, app.setWeather);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
