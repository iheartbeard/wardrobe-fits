/**
 * Температурная шкала сезона. Набор температур хранится как битовая маска:
 * бит i соответствует температуре min + i, поэтому пересечение диапазонов это обычное «&».
 */

/** Целая температура со знаком: «+5», «0», «-3». */
export function formatTemp(t) {
  return t > 0 ? `+${t}` : String(t);
}

/**
 * @param {number} min Нижняя граница сезона
 * @param {number} max Верхняя граница сезона
 */
export function createScale(min, max) {
  const count = max - min + 1;

  /** Маска температур от lo до hi включительно, обрезанная по границам сезона. */
  function mask(lo, hi) {
    let result = 0;
    for (let t = Math.max(lo, min); t <= Math.min(hi, max); t++) {
      result |= 1 << (t - min);
    }
    return result;
  }

  /** Температуры, входящие в маску, по возрастанию. */
  function temps(m) {
    const result = [];
    for (let i = 0; i < count; i++) {
      if (m & (1 << i)) {
        result.push(i + min);
      }
    }
    return result;
  }

  /** Подпись диапазона: «+5…+10», «только +7» или «—». */
  function describe(m) {
    const list = temps(m);
    if (!list.length) {
      return '—';
    }
    if (list.length === 1) {
      return `только ${formatTemp(list[0])}`;
    }
    return `${formatTemp(list[0])}…${formatTemp(list[list.length - 1])}`;
  }

  return {min, max, count, all: mask(min, max), mask, temps, describe};
}
