import type { TimelapseSettings } from './types';
import { sourceSize } from './render';

/* ---------- camera ---------- */

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}

export async function openCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser ini tidak mendukung kamera');
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
}

/**
 * A moving test picture used when no camera is available, so the whole flow
 * (photos, clips, timelapse) can still be tried. It is clearly labelled on screen.
 */
export function openSampleCamera(): { stream: MediaStream; stop: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const start = performance.now();
  const timer = window.setInterval(() => {
    const t = (performance.now() - start) / 1000;
    ctx.fillStyle = '#FFF6E6';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#F28A2E';
    ctx.beginPath();
    ctx.arc(640 + Math.sin(t * 1.3) * 360, 360 + Math.cos(t * 0.9) * 160, 120, 0, Math.PI * 2);
    ctx.fill();
    // No text here: the picture gets mirrored, so the label lives in the UI instead.
    ctx.fillStyle = '#23823C';
    ctx.fillRect(0, 610, 1280, 40);
    ctx.fillStyle = '#16301C';
    ctx.beginPath();
    ctx.arc(640, 300, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF6E6';
    ctx.beginPath();
    ctx.arc(590, 270, 18, 0, Math.PI * 2);
    ctx.arc(690, 270, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFF6E6';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(640, 310, 70, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }, 1000 / 30);
  const stream = canvas.captureStream(30);
  return {
    stream,
    stop: () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/* ---------- recording ---------- */

export function pickVideoMime(): string {
  const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export function extForMime(mime: string) {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/** Records the camera stream until stop() is called; resolves to a blob URL. */
export function startClip(stream: MediaStream): { stop: () => Promise<string | undefined> } {
  const mime = pickVideoMime();
  if (!mime) return { stop: async () => undefined };
  const chunks: Blob[] = [];
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  } catch {
    return { stop: async () => undefined };
  }
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        if (rec.state === 'inactive') return resolve(undefined);
        rec.onstop = () => resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: mime })) : undefined);
        rec.stop();
      }),
  };
}

/**
 * Draws `draw(t)` onto the canvas at `fps` for `durationMs` while recording it.
 * Resolves null when aborted or when recording is not supported.
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  durationMs: number,
  draw: (tMs: number) => void,
  onProgress: (p: number) => void,
  signal: AbortSignal,
  fps = 30
): Promise<Blob | null> {
  const mime = pickVideoMime();
  if (!mime) return Promise.resolve(null);
  return new Promise((resolve) => {
    const stream = canvas.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    let aborted = false;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(aborted || !chunks.length ? null : new Blob(chunks, { type: mime }));
    };
    draw(0);
    rec.start(250);
    const start = performance.now();
    const timer = window.setInterval(() => {
      const t = performance.now() - start;
      if (signal.aborted) {
        aborted = true;
        window.clearInterval(timer);
        rec.stop();
        return;
      }
      if (t >= durationMs) {
        window.clearInterval(timer);
        onProgress(1);
        rec.stop();
        return;
      }
      draw(t);
      onProgress(t / durationMs);
    }, 1000 / fps);
  });
}

/* ---------- timelapse ---------- */

export const TIMELAPSE_FPS = 24;
const TIMELAPSE_MAX_SECONDS = 40;

export function timelapsePlan(frameCount: number, speed: number) {
  // At 1x every captured frame (taken 4x a second) becomes one video frame.
  let step = speed;
  let outFrames = Math.ceil(frameCount / step);
  if (outFrames > TIMELAPSE_FPS * TIMELAPSE_MAX_SECONDS) {
    outFrames = TIMELAPSE_FPS * TIMELAPSE_MAX_SECONDS;
    step = frameCount / outFrames;
  }
  return { step, outFrames, durationMs: (outFrames / TIMELAPSE_FPS) * 1000 };
}

/**
 * Decodes timelapse frames just ahead of the playhead. It prefetches the exact
 * indices playback will hit at the current step, and falls back to the last
 * decoded frame so the picture never blanks while decoding catches up.
 */
export class FrameDecoder {
  private cache = new Map<number, ImageBitmap>();
  private pending = new Set<number>();
  private lastIndex = -1;
  constructor(private blobs: Blob[]) {}

  get(i: number, step = 1): ImageBitmap | undefined {
    const idx = Math.max(0, Math.min(this.blobs.length - 1, Math.floor(i)));
    this.prefetch(idx, step);
    const hit = this.cache.get(idx);
    if (hit) {
      this.lastIndex = idx;
      return hit;
    }
    return this.cache.get(this.lastIndex);
  }

  prefetch(i: number, step = 1) {
    const n = this.blobs.length;
    for (let ahead = 0; ahead < 16 && this.pending.size < 12; ahead++) {
      const k = Math.min(n - 1, Math.floor(i + ahead * Math.max(step, 1)));
      if (this.cache.has(k) || this.pending.has(k)) continue;
      this.pending.add(k);
      createImageBitmap(this.blobs[k])
        .then((bmp) => this.cache.set(k, bmp))
        .catch(() => undefined)
        .finally(() => this.pending.delete(k));
    }
    // Drop frames already played, but keep the fallback frame.
    const keepFrom = i - Math.max(step, 1) * 2 - 2;
    for (const key of [...this.cache.keys()]) {
      if (key < keepFrom && key !== this.lastIndex) {
        this.cache.get(key)?.close();
        this.cache.delete(key);
      }
    }
    // Looping back to the start: forget the old fallback position.
    if (i < this.lastIndex - 1 && !this.cache.has(this.lastIndex)) this.lastIndex = -1;
  }

  async warm(i = 0) {
    const bmp = await createImageBitmap(this.blobs[i]).catch(() => undefined);
    if (bmp) {
      this.cache.set(i, bmp);
      this.lastIndex = i;
    }
    this.prefetch(i);
  }

  dispose() {
    this.cache.forEach((b) => b.close());
    this.cache.clear();
  }
}

export function drawTimelapseFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  decoder: FrameDecoder,
  index: number,
  settings: TimelapseSettings,
  filter: string,
  logo: HTMLImageElement | null
) {
  ctx.save();
  ctx.fillStyle = settings.borderColor;
  ctx.fillRect(0, 0, W, H);
  const b = settings.border;
  const i = Math.floor(index);
  const frac = index - i;
  const step = Math.max(settings.speed, 1);
  const a = decoder.get(i, step);
  // Fade blends each snapshot into the next instead of cutting.
  const next = settings.fade && frac > 0 ? decoder.get(i + 1, step) : undefined;
  ctx.beginPath();
  ctx.rect(b, b, W - b * 2, H - b * 2);
  ctx.clip();
  if (filter !== 'none') ctx.filter = filter;
  const paint = (bmp: ImageBitmap) => {
    const s = sourceSize(bmp);
    const k = Math.max((W - b * 2) / s.w, (H - b * 2) / s.h);
    ctx.drawImage(bmp, W / 2 - (s.w * k) / 2, H / 2 - (s.h * k) / 2, s.w * k, s.h * k);
  };
  if (a) paint(a);
  if (next) {
    ctx.globalAlpha = frac;
    paint(next);
    ctx.globalAlpha = 1;
  }
  ctx.filter = 'none';
  ctx.restore();
  if (logo) {
    const lh = H * 0.07;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    const x = W - b - lw - lh * 0.6;
    const y = H - b - lh * 1.5;
    ctx.fillStyle = '#FFF6E6';
    ctx.beginPath();
    ctx.roundRect(x - lh * 0.3, y - lh * 0.14, lw + lh * 0.6, lh * 1.28, lh * 0.64);
    ctx.fill();
    ctx.drawImage(logo, x, y, lw, lh);
  }
}

/* ---------- GIF ---------- */

/** Slideshow GIF of the photos, with the chosen filter. */
export async function makeGif(images: HTMLImageElement[], filter: string, width = 480, height = 360, delay = 650): Promise<string> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  for (const img of images) {
    ctx.save();
    ctx.fillStyle = '#FFF6E6';
    ctx.fillRect(0, 0, width, height);
    if (filter !== 'none') ctx.filter = filter;
    const s = sourceSize(img);
    const k = Math.max(width / s.w, height / s.h);
    ctx.drawImage(img, width / 2 - (s.w * k) / 2, height / 2 - (s.h * k) / 2, s.w * k, s.h * k);
    ctx.restore();
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return URL.createObjectURL(new Blob([gif.bytes()], { type: 'image/gif' }));
}
