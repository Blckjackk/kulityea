import type { FrameDesign, FrameEnv } from './frames';
import type { Adjust, PlacedSticker, Rect, ShotCount } from './types';
import { STICKER_BASE_WIDTH } from './stickers';

export type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

export function sourceSize(s: Source): { w: number; h: number } {
  if (s instanceof HTMLVideoElement) return { w: s.videoWidth, h: s.videoHeight };
  if (s instanceof HTMLImageElement) return { w: s.naturalWidth, h: s.naturalHeight };
  return { w: s.width, h: s.height };
}

/* ---------- asset loading ---------- */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        imageCache.delete(src);
        reject(new Error(`Gagal memuat ${src}`));
      };
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

export const LOGO_SRC = '/brand/logo-kulittea.png';

/** Canvas text only uses web fonts that are already loaded. */
export async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load("800 50px Fraunces"),
    document.fonts.load("italic 800 50px Fraunces"),
    document.fonts.load("600 26px 'DM Sans'"),
  ]).catch(() => undefined);
}

export function todayLabel() {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- composite ---------- */

export interface StickerDraw {
  img: HTMLImageElement;
  placed: PlacedSticker;
  ratio: number;
}

export interface CompositeInput {
  frame: FrameDesign;
  count: ShotCount;
  /** Indexed by shot index. */
  sources: (Source | null | undefined)[];
  /** order[position] = shot index shown at that position. */
  order: number[];
  /** Indexed by shot index. */
  adjusts: Adjust[];
  /** Extra horizontal flip per shot index (camera clips are recorded unmirrored). */
  flipSources?: boolean[];
  filter: string;
  stickers?: StickerDraw[];
  caption: string;
  date: string;
  logo: HTMLImageElement | null;
  /** Outline this photo position (layout step). */
  highlight?: number;
}

function drawSlotPhoto(
  ctx: CanvasRenderingContext2D,
  slot: Rect,
  src: Source | null | undefined,
  adj: Adjust,
  filter: string,
  extraFlip: boolean,
  label: number
) {
  ctx.save();
  ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
  if (slot.rot) ctx.rotate((slot.rot * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h, slot.r ?? 0);
  ctx.clip();

  const size = src ? sourceSize(src) : { w: 0, h: 0 };
  if (!src || !size.w || !size.h) {
    ctx.fillStyle = 'rgba(22,48,28,0.12)';
    ctx.fillRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
    ctx.fillStyle = 'rgba(22,48,28,0.45)';
    ctx.font = `800 ${Math.round(Math.min(slot.w, slot.h) * 0.22)}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), 0, 0);
    ctx.restore();
    return;
  }

  ctx.translate((adj.x / 100) * (slot.w / 2), (adj.y / 100) * (slot.h / 2));
  ctx.rotate((adj.rotate * Math.PI) / 180);
  const flipH = adj.flipH !== extraFlip;
  ctx.scale(flipH ? -1 : 1, adj.flipV ? -1 : 1);
  const k = Math.max(slot.w / size.w, slot.h / size.h) * adj.zoom;
  const dw = size.w * k;
  const dh = size.h * k;
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

export function frameEnv(input: Pick<CompositeInput, 'frame' | 'count' | 'caption' | 'date' | 'logo'>): FrameEnv {
  const { frame } = input;
  return {
    W: frame.width,
    H: frame.height,
    slots: frame.slots(input.count),
    count: input.count,
    caption: input.caption,
    date: input.date,
    logo: input.logo,
  };
}

/** Draws the full frame at its native size onto ctx (caller sets any scale). */
export function drawComposite(ctx: CanvasRenderingContext2D, input: CompositeInput) {
  const env = frameEnv(input);
  ctx.save();
  input.frame.back(ctx, env);

  env.slots.forEach((slot, i) => {
    const pos = i % input.count;
    const shot = input.order[pos] ?? pos;
    drawSlotPhoto(
      ctx,
      slot,
      input.sources[shot],
      input.adjusts[shot],
      input.filter,
      input.flipSources?.[shot] ?? false,
      pos + 1
    );
  });

  input.frame.front(ctx, env);

  input.stickers?.forEach(({ img, placed, ratio }) => {
    const w = env.W * STICKER_BASE_WIDTH * placed.scale;
    const h = w / ratio;
    ctx.save();
    ctx.translate(placed.x * env.W, placed.y * env.H);
    ctx.rotate((placed.rotate * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  });

  if (input.highlight !== undefined) {
    env.slots.forEach((slot, i) => {
      if (i % input.count !== input.highlight) return;
      ctx.save();
      ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
      if (slot.rot) ctx.rotate((slot.rot * Math.PI) / 180);
      ctx.strokeStyle = '#F28A2E';
      ctx.lineWidth = Math.max(8, env.W * 0.008);
      ctx.setLineDash([24, 14]);
      ctx.beginPath();
      ctx.roundRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h, slot.r ?? 0);
      ctx.stroke();
      ctx.restore();
    });
  }
  ctx.restore();
}

/** Which photo position sits under a point (frame pixels), if any. */
export function hitSlot(frame: FrameDesign, count: ShotCount, px: number, py: number): number | null {
  const slots = frame.slots(count);
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return i % count;
  }
  return null;
}

export function canvasToBlobUrl(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Gagal membuat gambar'))),
      type,
      quality
    );
  });
}
