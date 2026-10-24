import type { Rect, ShotCount } from './types';

/**
 * Frame designs, drawn in code so they stay sharp at print size.
 * Strip = 2x6 inch (600x1800 px), 4R = 4x6 inch (1200x1800 px), both at 300 dpi.
 * Text on a frame is limited to the logo, the date and an optional caption.
 */

export interface FrameEnv {
  W: number;
  H: number;
  slots: Rect[];
  count: number;
  caption: string;
  date: string;
  logo: HTMLImageElement | null;
}

export interface FrameDesign {
  id: string;
  name: string;
  width: number;
  height: number;
  counts: ShotCount[];
  /** Slot rectangles. Double strips return 2x count; photo for slot i is i % count. */
  slots: (count: ShotCount) => Rect[];
  back: (ctx: CanvasRenderingContext2D, env: FrameEnv) => void;
  front: (ctx: CanvasRenderingContext2D, env: FrameEnv) => void;
}

const INK = '#16301C';
const CREAM = '#FFF6E6';
const LEAF = '#23823C';
const SUN = '#F28A2E';
const DISPLAY = "800 {s}px Fraunces, Georgia, serif";
const BODY = "600 {s}px 'DM Sans', system-ui, sans-serif";

const font = (tpl: string, size: number) => tpl.replace('{s}', String(size));

/* ---------- layout helpers ---------- */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function stack(b: Box, n: number, gap: number, r: number): Rect[] {
  const h = (b.h - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: b.x, y: b.y + i * (h + gap), w: b.w, h, r }));
}

function grid(b: Box, cols: number, rows: number, gap: number, r: number): Rect[] {
  const w = (b.w - gap * (cols - 1)) / cols;
  const h = (b.h - gap * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) out.push({ x: b.x + col * (w + gap), y: b.y + row * (h + gap), w, h, r });
  }
  return out;
}

/** One wide photo on top, two below. */
function hero3(b: Box, gap: number, r: number): Rect[] {
  const topH = (b.h - gap) * 0.56;
  const botH = b.h - gap - topH;
  const w = (b.w - gap) / 2;
  return [
    { x: b.x, y: b.y, w: b.w, h: topH, r },
    { x: b.x, y: b.y + topH + gap, w, h: botH, r },
    { x: b.x + w + gap, y: b.y + topH + gap, w, h: botH, r },
  ];
}

function layout4r(b: Box, count: ShotCount, gap: number, r: number): Rect[] {
  switch (count) {
    case 1:
      return [{ ...b, r }];
    case 2:
      return stack(b, 2, gap, r);
    case 3:
      return hero3(b, gap, r);
    case 4:
      return grid(b, 2, 2, gap, r);
    case 6:
    default:
      return grid(b, 2, 3, gap, r);
  }
}

/* ---------- drawing helpers ---------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Logo centred at (cx, top), optionally on a cream chip. Returns the bottom y. */
function drawLogo(ctx: CanvasRenderingContext2D, env: FrameEnv, cx: number, top: number, h: number, chip = false) {
  if (!env.logo) {
    ctx.font = font(DISPLAY, h * 0.7);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('KulitYea', cx, top);
    return top + h;
  }
  const w = (env.logo.naturalWidth / env.logo.naturalHeight) * h;
  if (chip) {
    ctx.fillStyle = CREAM;
    rr(ctx, cx - w / 2 - h * 0.3, top - h * 0.14, w + h * 0.6, h * 1.28, h * 0.64);
    ctx.fill();
  }
  ctx.drawImage(env.logo, cx - w / 2, top, w, h);
  return top + h;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  style: string,
  color: string,
  align: CanvasTextAlign = 'center',
  spacing = 0
) {
  if (!value) return;
  ctx.font = style;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = '0px';
}

/** Footer block shared by most designs: caption, logo, date. */
function footer(ctx: CanvasRenderingContext2D, env: FrameEnv, top: number, cx: number, color: string, opts: { chip?: boolean; logoH?: number } = {}) {
  const logoH = opts.logoH ?? 92;
  let y = top;
  if (env.caption) {
    text(ctx, env.caption, cx, y + 52, font(DISPLAY, 50), color);
    y += 78;
  }
  const bottom = drawLogo(ctx, env, cx, y, logoH, opts.chip);
  text(ctx, env.date, cx, bottom + 48, font(BODY, 26), color);
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -len * 0.32, len * 0.75, -len * 0.32, len, 0);
  ctx.bezierCurveTo(len * 0.75, len * 0.32, len * 0.25, len * 0.32, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.strokeStyle = 'rgba(255,246,230,0.55)';
  ctx.lineWidth = Math.max(2, len * 0.03);
  ctx.stroke();
  ctx.restore();
}

/** A sprig: a curved stem with leaves on alternating sides. */
function sprig(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, rng: () => number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.strokeStyle = '#1E6C33';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.12, len, 0);
  ctx.stroke();
  const greens = ['#23823C', '#33A04C', '#1E6C33', '#5FB86A'];
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const px = len * t;
    const py = -len * 0.12 * 4 * t * (1 - t);
    const side = i % 2 ? -1 : 1;
    leaf(ctx, px, py, len * (0.32 - t * 0.12), side * (40 + rng() * 20), greens[i % greens.length]);
  }
  leaf(ctx, len, 0, len * 0.22, -6, '#33A04C');
  ctx.restore();
}

/* ---------- designs ---------- */

const STRIP_W = 600;
const R4_W = 1200;
const H = 1800;

export const FRAME_DESIGNS: FrameDesign[] = [
  {
    id: 'klasik',
    name: 'Klasik',
    width: STRIP_W,
    height: H,
    counts: [2, 3, 4],
    slots: (count) => stack({ x: 48, y: 48, w: 504, h: H - 48 - 330 }, count, 26, 6),
    back: (ctx, { W, H }) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
    },
    front: (ctx, env) => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(22, 22, env.W - 44, env.H - 44);
      footer(ctx, env, env.H - 282 + (env.caption ? 0 : 30), env.W / 2, INK);
    },
  },
  {
    id: 'film',
    name: 'Film',
    width: STRIP_W,
    height: H,
    counts: [3, 4],
    slots: (count) => stack({ x: 92, y: 72, w: 416, h: H - 72 - 300 }, count, 44, 4),
    back: (ctx, { W, H }) => {
      ctx.fillStyle = '#17150F';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CREAM;
      for (let y = 30; y < H - 20; y += 72) {
        rr(ctx, 22, y, 30, 42, 7);
        ctx.fill();
        rr(ctx, W - 52, y, 30, 42, 7);
        ctx.fill();
      }
    },
    front: (ctx, env) => {
      // Edge print, like the text burned along real film stock.
      ctx.save();
      ctx.translate(76, env.H / 2);
      ctx.rotate(-Math.PI / 2);
      text(ctx, 'KULITYEA 400  ·  KULITYEA 400  ·  KULITYEA 400', 0, 6, font(BODY, 17), SUN, 'center', 4);
      ctx.restore();
      env.slots.forEach((s, i) => {
        text(ctx, `${i + 1}`, s.x + s.w + 22, s.y + 26, font(BODY, 20), SUN, 'center');
        text(ctx, `${i + 1}A`, s.x + s.w + 22, s.y + s.h - 6, font(BODY, 16), SUN, 'center');
      });
      footer(ctx, env, env.H - 250 + (env.caption ? 0 : 30), env.W / 2, CREAM, { chip: true, logoH: 78 });
    },
  },
  {
    id: 'jeruk',
    name: 'Kulit Jeruk',
    width: R4_W,
    height: H,
    counts: [1, 2, 4, 6],
    slots: (count) => layout4r({ x: 84, y: 84, w: R4_W - 168, h: H - 84 - 330 }, count, 44, 30),
    back: (ctx, env) => {
      ctx.fillStyle = SUN;
      ctx.fillRect(0, 0, env.W, env.H);
      // Peel pores: a seeded scatter so every print looks the same.
      const rng = mulberry(7);
      for (let i = 0; i < 1400; i++) {
        const x = rng() * env.W;
        const y = rng() * env.H;
        const r = 2 + rng() * 5;
        ctx.fillStyle = rng() > 0.35 ? 'rgba(196,92,18,0.35)' : 'rgba(255,214,150,0.45)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cream mats under each photo.
      ctx.fillStyle = CREAM;
      env.slots.forEach((s) => {
        rr(ctx, s.x - 16, s.y - 16, s.w + 32, s.h + 32, (s.r ?? 0) + 14);
        ctx.fill();
      });
    },
    front: (ctx, env) => {
      footer(ctx, env, env.H - 268 + (env.caption ? 0 : 30), env.W / 2, INK, { chip: true, logoH: 96 });
    },
  },
  {
    id: 'daun',
    name: 'Daun',
    width: R4_W,
    height: H,
    counts: [1, 2, 3, 4, 6],
    slots: (count) => layout4r({ x: 110, y: 130, w: R4_W - 220, h: H - 130 - 340 }, count, 36, 22),
    back: (ctx, env) => {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, env.W, env.H);
      const rng = mulberry(3);
      sprig(ctx, -20, 210, 380, -32, rng);
      sprig(ctx, env.W + 20, 120, 360, 200, rng);
      sprig(ctx, -10, env.H - 330, 320, 18, rng);
      sprig(ctx, env.W + 10, env.H - 250, 340, 165, rng);
    },
    front: (ctx, env) => {
      ctx.strokeStyle = LEAF;
      ctx.lineWidth = 8;
      env.slots.forEach((s) => {
        rr(ctx, s.x, s.y, s.w, s.h, s.r ?? 0);
        ctx.stroke();
      });
      // Two leaves tucked over the first photo's corner, so the sprigs feel attached.
      const first = env.slots[0];
      leaf(ctx, first.x + 10, first.y + 20, 90, -60, '#33A04C');
      leaf(ctx, first.x + 24, first.y + 8, 70, -20, '#23823C');
      footer(ctx, env, env.H - 286 + (env.caption ? 0 : 30), env.W / 2, INK);
    },
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    width: R4_W,
    height: H,
    counts: [1, 2, 3, 4],
    slots: (count) => {
      const sets: Record<number, Rect[]> = {
        1: [{ x: 150, y: 170, w: 900, h: 900, rot: -2 }],
        2: [
          { x: 170, y: 110, w: 760, h: 560, rot: -3 },
          { x: 270, y: 780, w: 760, h: 560, rot: 2.5 },
        ],
        3: [
          { x: 110, y: 100, w: 600, h: 440, rot: -4 },
          { x: 500, y: 520, w: 600, h: 440, rot: 3 },
          { x: 130, y: 950, w: 600, h: 440, rot: -2 },
        ],
        4: [
          { x: 90, y: 120, w: 470, h: 470, rot: -3 },
          { x: 640, y: 170, w: 470, h: 470, rot: 2.5 },
          { x: 110, y: 760, w: 470, h: 470, rot: 2 },
          { x: 630, y: 800, w: 470, h: 470, rot: -3.5 },
        ],
      };
      return (sets[count] ?? sets[4]).map((s) => ({ ...s, r: 2 }));
    },
    back: (ctx, env) => {
      ctx.fillStyle = '#E7D2AE';
      ctx.fillRect(0, 0, env.W, env.H);
      const rng = mulberry(21);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(120,84,40,0.10)' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(rng() * env.W, rng() * env.H, 2 + rng() * 6, 1.5);
      }
      env.slots.forEach((s) => {
        ctx.save();
        ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
        ctx.rotate(((s.rot ?? 0) * Math.PI) / 180);
        ctx.shadowColor = 'rgba(60,40,10,0.28)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-s.w / 2 - 26, -s.h / 2 - 26, s.w + 52, s.h + 26 + 96);
        ctx.restore();
      });
    },
    front: (ctx, env) => {
      env.slots.forEach((s, i) => {
        ctx.save();
        ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
        ctx.rotate(((s.rot ?? 0) * Math.PI) / 180);
        // Washi tape
        ctx.fillStyle = i % 2 ? 'rgba(242,138,46,0.72)' : 'rgba(51,160,76,0.68)';
        ctx.rotate((i % 2 ? 4 : -5) * (Math.PI / 180));
        ctx.fillRect(-90, -s.h / 2 - 50, 180, 50);
        ctx.restore();
      });
      if (env.caption) {
        text(ctx, env.caption, env.W / 2, env.H - 150, `italic ${font(DISPLAY, 60)}`, INK);
      }
      drawLogo(ctx, env, env.W / 2, env.H - (env.caption ? 120 : 190), 84, true);
      text(ctx, env.date, env.W / 2, env.H - (env.caption ? 0 : 60) - 10, font(BODY, 26), INK);
    },
  },
  {
    id: 'tiket',
    name: 'Tiket RiseUp',
    width: R4_W,
    height: H,
    counts: [2, 3, 4],
    slots: (count) => layout4r({ x: 90, y: 300, w: R4_W - 180, h: H - 300 - 380 }, count, 30, 14),
    back: (ctx, env) => {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, env.W, env.H);
      ctx.fillStyle = LEAF;
      ctx.fillRect(0, 0, env.W, 240);
      // Stub with a tear line and notches.
      const stubY = env.H - 310;
      ctx.fillStyle = '#F6E3C2';
      ctx.fillRect(0, stubY, env.W, 310);
      ctx.strokeStyle = 'rgba(22,48,28,0.45)';
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(50, stubY);
      ctx.lineTo(env.W - 50, stubY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFFFFF';
      [0, env.W].forEach((x) => {
        ctx.beginPath();
        ctx.arc(x, stubY, 34, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    front: (ctx, env) => {
      drawLogo(ctx, env, env.W / 2, 64, 108, true);
      const stubY = env.H - 310;
      text(ctx, env.caption || 'RiseUp Fest 2026', env.W / 2, stubY + 120, font(DISPLAY, 64), INK);
      text(ctx, env.date, env.W / 2, stubY + 196, font(BODY, 30), INK, 'center', 2);
    },
  },
  {
    id: 'ganda',
    name: 'Strip Ganda',
    width: R4_W,
    height: H,
    counts: [3, 4],
    slots: (count) => [
      ...stack({ x: 44, y: 44, w: 512, h: H - 44 - 320 }, count, 24, 6),
      ...stack({ x: 644, y: 44, w: 512, h: H - 44 - 320 }, count, 24, 6),
    ],
    back: (ctx, env) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, env.W, env.H);
      ctx.fillStyle = LEAF;
      ctx.fillRect(0, env.H - 300, env.W, 300);
    },
    front: (ctx, env) => {
      [env.W / 4, (env.W * 3) / 4].forEach((cx) => {
        footer(ctx, env, env.H - 268 + (env.caption ? 0 : 30), cx, CREAM, { chip: true, logoH: 76 });
      });
      // Cut guide between the two strips.
      ctx.strokeStyle = 'rgba(22,48,28,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(env.W / 2, 0);
      ctx.lineTo(env.W / 2, env.H);
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: 'pitaya',
    name: 'Pitaya',
    width: STRIP_W,
    height: H,
    counts: [2, 3, 4],
    slots: (count) => stack({ x: 60, y: 60, w: 480, h: H - 60 - 330 }, count, 34, 16),
    back: (ctx, env) => {
      ctx.fillStyle = '#F6B9D2';
      ctx.fillRect(0, 0, env.W, env.H);
      const rng = mulberry(5);
      ctx.fillStyle = '#2A1420';
      for (let i = 0; i < 260; i++) {
        ctx.save();
        ctx.translate(rng() * env.W, rng() * env.H);
        ctx.rotate(rng() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFFFFF';
      env.slots.forEach((s) => {
        rr(ctx, s.x - 12, s.y - 12, s.w + 24, s.h + 24, (s.r ?? 0) + 10);
        ctx.fill();
      });
    },
    front: (ctx, env) => {
      footer(ctx, env, env.H - 282 + (env.caption ? 0 : 30), env.W / 2, '#3A1424', { chip: true });
    },
  },
];

export function framesFor(count: ShotCount) {
  return FRAME_DESIGNS.filter((f) => f.counts.includes(count));
}

export function frameById(id: string) {
  return FRAME_DESIGNS.find((f) => f.id === id);
}
