/**
 * Оценка сочетания цветов. Отсекаются только настоящие конфликты (пары ярких насыщенных цветов,
 * которые не соседние и не дополнительные), остальное даёт баллы за гармонию.
 */
import {WADA_PALETTES} from '../data/wada.js';

const CHROMATIC_FAMILIES = ['olive', 'green', 'red', 'pink', 'yellow', 'rust', 'blue', 'bright blue'];
const ACCENT_FAMILIES = ['yellow', 'bright blue', 'green', 'rust'];
const NEUTRAL_FAMILIES = ['black', 'grey', 'white', 'cream'];

/** Порог близости цветов для сочетаний из книги Васо (евклидово расстояние в RGB). */
const WADA_DISTANCE = 70;

export function toHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) {
      h = ((g - b) / d + 6) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return {h, s, l};
}

/** Грубое семейство цвета: black, grey, white, cream, navy, blue, bright blue, green, olive, red, pink, rust, yellow, beige, brown. */
export function colorFamily(hex) {
  const {h, s, l} = toHsl(hex);
  if (l < 0.17) {
    return 'black';
  }
  if (s < 0.12) {
    return l > 0.8 ? 'white' : 'grey';
  }
  if (l > 0.86 && s < 0.3) {
    return 'white';
  }
  if (h >= 190 && h <= 255) {
    if (s >= 0.5 && l >= 0.3) {
      return 'bright blue';
    }
    return l < 0.3 ? 'navy' : 'blue';
  }
  if (h >= 270 && h < 340) {
    return 'pink';
  }
  if (l >= 0.8 && h >= 30 && h < 60) {
    return 'cream';
  }
  if (h >= 45 && h < 170) {
    if (l > 0.7 && h >= 60) {
      return 'green';
    }
    if (h >= 100) {
      return 'green';
    }
    return s >= 0.4 ? 'green' : 'olive';
  }
  if (h >= 340 || h <= 12) {
    if (l >= 0.7) {
      return 'pink';
    }
    return s >= 0.35 ? 'red' : 'brown';
  }
  if (h > 12 && h < 45) {
    if (l >= 0.8) {
      return 'cream';
    }
    if (h >= 38 && s >= 0.6 && l >= 0.45) {
      return 'yellow';
    }
    if (s >= 0.5 && l >= 0.38 && h <= 28) {
      return 'rust';
    }
    return l >= 0.5 ? 'beige' : 'brown';
  }
  return 'grey';
}

/** Тон яркого насыщенного цвета или null, если цвет спокойный. */
export function loudHue(hex) {
  const {h, s, l} = toHsl(hex);
  return s >= 0.5 && l >= 0.3 && l <= 0.75 ? h : null;
}

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function colorDistance(a, b) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Название личного сочетания из книги, под которое подходит образ, или null. */
function matchWada(colors, palettes) {
  for (const palette of palettes) {
    const hits = palette.colors.filter((c) => colors.some((x) => colorDistance(c, x) < WADA_DISTANCE)).length;
    if (hits >= Math.min(3, palette.colors.length) && hits >= 2) {
      return palette.name;
    }
  }
  return null;
}

/** Угловое расстояние между двумя тонами, 0…180. */
function hueGap(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

function accentGroup(family) {
  if (family === 'red' || family === 'pink') {
    return 'красный';
  }
  return ACCENT_FAMILIES.includes(family) ? family : null;
}

/**
 * @param {{hex: string|null, slot?: string}[]} parts Вещи образа
 * @param {{name: string, colors: string[]}[]} [palettes] Личные сочетания из книги
 * @returns {{score: number, reasons: string[]} | null} null, если в образе настоящий цветовой конфликт
 */
export function evaluateColors(parts, palettes = WADA_PALETTES) {
  const coloured = parts.filter((p) => p.hex);
  const families = coloured.map((p) => colorFamily(p.hex));
  const hues = coloured.map((p) => loudHue(p.hex)).filter((h) => h !== null);

  /* Отсекаем только пары ярких насыщенных цветов, которые не соседние (до 50°) и не дополнительные (от 150°) */
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const gap = hueGap(hues[i], hues[j]);
      if (gap > 50 && gap < 150) {
        return null;
      }
    }
  }

  /* Бюджет акцента: два предмета одного яркого цвета допустимы (например, свитер и обувь), третий нет */
  const accentCounts = {};
  families.forEach((f) => {
    const group = accentGroup(f);
    if (group) {
      accentCounts[group] = (accentCounts[group] || 0) + 1;
    }
  });
  if (Object.values(accentCounts).some((n) => n >= 3)) {
    return null;
  }
  const hasAccent = Object.keys(accentCounts).length > 0;

  let score = 0;
  const reasons = [];
  const familySet = new Set(families);

  const cool = familySet.has('navy') || familySet.has('blue');
  const warm = ['brown', 'beige', 'rust', 'cream', 'red', 'pink'].some((f) => familySet.has(f));
  if (cool && warm) {
    score += 2;
    reasons.push('синий и тёплый тон, дополнительные цвета');
  }

  const shoe = parts.find((p) => p.slot === 's');
  const shoeFamily = shoe && shoe.hex ? colorFamily(shoe.hex) : null;
  const otherFamilies = parts.filter((p) => p !== shoe && p.hex).map((p) => colorFamily(p.hex));
  if (shoeFamily && shoeFamily !== 'black' && shoeFamily !== 'grey' && otherFamilies.includes(shoeFamily)) {
    score += 1;
    reasons.push('цвет обуви повторяется в образе');
  }

  if (hues.length === 1) {
    score += 1;
    reasons.push('один яркий акцент на спокойной базе');
  } else if (hues.length > 1) {
    score += 1;
    reasons.push('яркие цвета соседние или дополнительные');
  } else {
    reasons.push('без ярких акцентов');
  }

  if (hasAccent) {
    const neutrals = Math.min(2, families.filter((f) => NEUTRAL_FAMILIES.includes(f)).length);
    if (neutrals) {
      score += neutrals;
      reasons.push('нейтральная база к акценту');
    }
  }

  /* Принципы из традиции Васо Санцо: палитра из 2–3 цветов, родственные оттенки хорошо ложатся друг к другу */
  const chromaticCount = new Set(families.filter((f) => CHROMATIC_FAMILIES.includes(f))).size;
  if (chromaticCount >= 1 && chromaticCount <= 3 && familySet.size <= 5) {
    score += 1;
    reasons.push('собранная палитра из нескольких цветов');
  }

  const tones = coloured
    .map((p) => toHsl(p.hex))
    .filter((x) => x.s >= 0.25 && x.l > 0.17 && x.l < 0.86)
    .map((x) => x.h);
  if (tones.length >= 2) {
    let widest = 0;
    for (let i = 0; i < tones.length; i++) {
      for (let j = i + 1; j < tones.length; j++) {
        widest = Math.max(widest, hueGap(tones[i], tones[j]));
      }
    }
    if (widest <= 40) {
      score += 1;
      reasons.push('родственные оттенки');
    }
  }

  const wadaName = matchWada(
    coloured.map((p) => p.hex),
    palettes,
  );
  if (wadaName) {
    score += 2;
    reasons.push(`похоже на сочетание «${wadaName}» из твоей подборки по книге Васо`);
  }

  const dull = families.filter((f) => f === 'black' || f === 'grey').length;
  if (dull >= 4) {
    score -= 1;
  }

  return {score, reasons};
}
