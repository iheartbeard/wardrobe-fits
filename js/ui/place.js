/**
 * Строка «Место»: название текущего места, поле поиска города и кнопка «Определить».
 * Скрыта, пока не подключена погода (в версии для артефакта сети нет).
 */

/**
 * @param {Document} doc
 */
export function createPlaceForm(doc) {
  const form = doc.getElementById('place');
  const current = doc.getElementById('place-cur');
  const input = doc.getElementById('place-q');
  const locate = doc.getElementById('place-geo');
  const list = doc.getElementById('place-res');
  const status = doc.getElementById('place-msg');
  const handlers = {search: () => {}, pick: () => {}, locate: () => {}};

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query) {
      handlers.search(query);
    }
  });
  locate.addEventListener('click', () => handlers.locate());
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-index]');
    if (button) {
      handlers.pick(Number(button.dataset.index));
    }
  });

  return {
    show() {
      form.hidden = false;
    },
    onSearch: (fn) => (handlers.search = fn),
    onPick: (fn) => (handlers.pick = fn),
    onLocate: (fn) => (handlers.locate = fn),
    setCurrent(place, mode) {
      current.textContent = mode === 'auto' ? `${place} (по геолокации)` : place;
    },
    setStatus(text) {
      status.textContent = text;
    },
    setBusy(busy) {
      locate.disabled = busy;
    },
    /** Результаты поиска: кнопки «Город, регион, страна». */
    setResults(places) {
      list.replaceChildren(
        ...places.map((place, index) => {
          const item = doc.createElement('li');
          const button = doc.createElement('button');
          button.type = 'button';
          button.className = 'btn';
          button.dataset.index = String(index);
          button.textContent = place.details ? `${place.place}, ${place.details}` : place.place;
          item.append(button);
          return item;
        }),
      );
    },
    clearInput() {
      input.value = '';
    },
  };
}
