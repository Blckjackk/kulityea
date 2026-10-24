// Sticker library. To add your own, drop a transparent PNG or SVG into
// public/stickers/ and add a line here.

export interface StickerDef {
  id: string;
  name: string;
  src: string;
  /** Width / height, used to size the sticker box before the image loads. */
  ratio: number;
}

export const STICKERS: StickerDef[] = [
  { id: 'daun', name: 'Daun', src: '/stickers/daun.svg', ratio: 1 },
  { id: 'teh', name: 'Teh', src: '/stickers/teh.svg', ratio: 260 / 240 },
  { id: 'jeruk', name: 'Jeruk', src: '/stickers/jeruk.svg', ratio: 1 },
  { id: 'buah-naga', name: 'Buah naga', src: '/stickers/buah-naga.svg', ratio: 220 / 260 },
  { id: 'hati', name: 'Hati', src: '/stickers/hati.svg', ratio: 240 / 220 },
  { id: 'kacamata', name: 'Kacamata', src: '/stickers/kacamata.svg', ratio: 320 / 130 },
  { id: 'mahkota', name: 'Mahkota', src: '/stickers/mahkota.svg', ratio: 280 / 200 },
  { id: 'lakudong', name: 'LakuDong!', src: '/stickers/lakudong.svg', ratio: 320 / 200 },
  { id: 'cekrek', name: 'Cekrek!', src: '/stickers/cekrek.svg', ratio: 300 / 260 },
  { id: 'bestie', name: 'Bestie!', src: '/stickers/bestie.svg', ratio: 280 / 200 },
  { id: 'hore', name: 'Hore!', src: '/stickers/hore.svg', ratio: 300 / 150 },
  { id: 'riseup', name: 'RiseUp Fest', src: '/stickers/riseup.svg', ratio: 320 / 150 },
];

/** Sticker width as a share of the frame width, at scale 1. */
export const STICKER_BASE_WIDTH = 0.26;

export function stickerById(id: string) {
  return STICKERS.find((s) => s.id === id);
}
