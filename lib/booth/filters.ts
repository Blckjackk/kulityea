// Photo filters as CSS filter strings. The same string drives the <img> thumbnails
// and canvas `ctx.filter`, so what guests see is what gets printed.

export interface FilterDef {
  id: string;
  name: string;
  group: FilterGroup;
  css: string;
}

export type FilterGroup = 'dasar' | 'film' | 'retro' | 'bw' | 'seru';

export const FILTER_GROUPS: { id: FilterGroup | 'semua'; name: string }[] = [
  { id: 'semua', name: 'Semua' },
  { id: 'dasar', name: 'Dasar' },
  { id: 'film', name: 'Film' },
  { id: 'retro', name: 'Retro' },
  { id: 'bw', name: 'Hitam putih' },
  { id: 'seru', name: 'Seru' },
];

export const FILTERS: FilterDef[] = [
  { id: 'asli', name: 'Asli', group: 'dasar', css: 'none' },
  { id: 'cerah', name: 'Cerah', group: 'dasar', css: 'brightness(1.15) contrast(1.03)' },
  { id: 'gelap', name: 'Gelap', group: 'dasar', css: 'brightness(0.85) contrast(1.05)' },
  { id: 'hangat', name: 'Hangat', group: 'dasar', css: 'sepia(0.22) saturate(1.2) hue-rotate(-8deg) brightness(1.03)' },
  { id: 'sejuk', name: 'Sejuk', group: 'dasar', css: 'saturate(1.05) hue-rotate(12deg) brightness(1.03)' },
  { id: 'kontras-plus', name: 'Kontras +', group: 'dasar', css: 'contrast(1.3)' },
  { id: 'kontras-min', name: 'Kontras -', group: 'dasar', css: 'contrast(0.82) brightness(1.05)' },
  { id: 'saturasi-plus', name: 'Saturasi +', group: 'dasar', css: 'saturate(1.55)' },
  { id: 'saturasi-min', name: 'Saturasi -', group: 'dasar', css: 'saturate(0.6)' },

  { id: 'portra', name: 'Portra', group: 'film', css: 'sepia(0.15) saturate(1.1) contrast(0.95) brightness(1.06)' },
  { id: 'gold', name: 'Gold', group: 'film', css: 'sepia(0.3) saturate(1.35) contrast(1.05) brightness(1.04)' },
  { id: 'superia', name: 'Superia', group: 'film', css: 'saturate(1.2) hue-rotate(-6deg) contrast(1.1)' },
  { id: 'cinestill', name: 'Cinestill', group: 'film', css: 'contrast(1.15) saturate(0.9) hue-rotate(10deg) brightness(0.98)' },

  { id: 'sepia', name: 'Sepia', group: 'retro', css: 'sepia(0.85) contrast(1.05)' },
  { id: 'pudar', name: 'Pudar', group: 'retro', css: 'contrast(0.85) brightness(1.1) saturate(0.7)' },
  { id: 'vintage', name: 'Vintage', group: 'retro', css: 'sepia(0.45) contrast(0.9) brightness(1.05) saturate(0.8)' },

  { id: 'bw', name: 'Hitam putih', group: 'bw', css: 'grayscale(1) contrast(1.1)' },
  { id: 'bw-kontras', name: 'Kontras tinggi', group: 'bw', css: 'grayscale(1) contrast(1.45)' },
  { id: 'noir', name: 'Noir', group: 'bw', css: 'grayscale(1) contrast(1.6) brightness(0.88)' },

  { id: 'pop', name: 'Pop', group: 'seru', css: 'saturate(2) contrast(1.2)' },
  { id: 'negatif', name: 'Negatif', group: 'seru', css: 'invert(1)' },
  { id: 'mimpi', name: 'Mimpi', group: 'seru', css: 'brightness(1.12) saturate(1.3) blur(1px)' },
];

export const VIDEO_FILTER_IDS = ['asli', 'bw', 'sepia', 'negatif', 'mimpi', 'hangat'];

export function filterCss(id: string) {
  return FILTERS.find((f) => f.id === id)?.css ?? 'none';
}
