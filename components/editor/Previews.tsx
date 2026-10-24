'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useBooth } from '@/lib/booth/store';
import { frameById, FRAME_DESIGNS, type FrameDesign } from '@/lib/booth/frames';
import { drawComposite, hitSlot, todayLabel, type CompositeInput, type Source, type StickerDraw } from '@/lib/booth/render';
import { filterCss } from '@/lib/booth/filters';
import { STICKER_BASE_WIDTH, stickerById } from '@/lib/booth/stickers';
import { drawTimelapseFrame, FrameDecoder, timelapsePlan, TIMELAPSE_FPS } from '@/lib/booth/media';
import type { ShotCount } from '@/lib/booth/types';
import { useClipVideos, useFrameAssets, useShotImages, useStickerImages } from './assets';

/** Everything the composite needs from the store, for a given frame. */
export function useCompositeBase(frameOverride?: FrameDesign) {
  const frameId = useBooth((s) => s.frameId);
  const count = useBooth((s) => s.settings.count) as ShotCount;
  const order = useBooth((s) => s.order);
  const adjusts = useBooth((s) => s.adjusts);
  const filterId = useBooth((s) => s.filterId);
  const caption = useBooth((s) => s.caption);
  const frame = frameOverride ?? frameById(frameId) ?? FRAME_DESIGNS[0];
  const { logo, fontsReady } = useFrameAssets();
  return { frame, count, order, adjusts, filter: filterCss(filterId), caption, logo, fontsReady, date: todayLabel() };
}

export function useStickerDraws(): StickerDraw[] {
  const stickers = useBooth((s) => s.stickers);
  const imgs = useStickerImages();
  return useMemo(
    () =>
      stickers.flatMap((placed) => {
        const def = stickerById(placed.stickerId);
        const img = imgs[placed.stickerId];
        return def && img ? [{ img, placed, ratio: def.ratio }] : [];
      }),
    [stickers, imgs]
  );
}

/* ---------- still preview (frame, layout, filter, sticker steps) ---------- */

interface PhotoPreviewProps {
  mode?: 'layout' | 'sticker';
  selectedSlot?: number;
  onSelectSlot?: (pos: number) => void;
  selectedSticker?: string | null;
  onSelectSticker?: (uid: string | null) => void;
}

export function PhotoPreview({ mode, selectedSlot, onSelectSlot, selectedSticker, onSelectSticker }: PhotoPreviewProps) {
  const base = useCompositeBase();
  const photos = useShotImages();
  const stickers = useBooth((s) => s.stickers);
  const patch = useBooth((s) => s.patch);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { frame } = base;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawComposite(ctx, { ...base, sources: photos, highlight: mode === 'layout' ? selectedSlot : undefined });
    // base is rebuilt each render; list its parts so redraws only happen on real changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, base.count, base.order, base.adjusts, base.filter, base.caption, base.logo, base.fontsReady, photos, mode, selectedSlot]);

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'sticker') return onSelectSticker?.(null);
    if (mode !== 'layout' || !onSelectSlot) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pos = hitSlot(frame, base.count, ((e.clientX - r.left) / r.width) * frame.width, ((e.clientY - r.top) / r.height) * frame.height);
    if (pos !== null) onSelectSlot(pos);
  };

  const dragSticker = (uid: string) => (e: React.PointerEvent<HTMLImageElement>) => {
    if (mode !== 'sticker') return;
    e.preventDefault();
    e.stopPropagation();
    onSelectSticker?.(uid);
    const box = boxRef.current!.getBoundingClientRect();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height));
      const list = useBooth.getState().stickers.map((s) => (s.uid === uid ? { ...s, x, y } : s));
      patch({ stickers: list });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div ref={boxRef} className="relative h-full max-w-full shadow-[0_10px_30px_rgba(22,48,28,0.18)]" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
      <canvas
        ref={canvasRef}
        width={frame.width}
        height={frame.height}
        onPointerDown={onCanvasPointer}
        className={`h-full w-full ${mode === 'layout' ? 'cursor-pointer' : ''}`}
        aria-label="Pratinjau foto"
        role="img"
      />
      {stickers.map((s) => {
        const def = stickerById(s.stickerId);
        if (!def) return null;
        const selected = mode === 'sticker' && selectedSticker === s.uid;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.uid}
            src={def.src}
            alt={def.name}
            draggable={false}
            onPointerDown={dragSticker(s.uid)}
            className={`absolute touch-none select-none ${mode === 'sticker' ? 'cursor-grab' : 'pointer-events-none'} ${
              selected ? 'outline-2 outline-offset-4 outline-dashed outline-sun' : ''
            }`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: `${STICKER_BASE_WIDTH * s.scale * 100}%`,
              transform: `translate(-50%, -50%) rotate(${s.rotate}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Small static render of a frame with the guest's photos, for the frame picker. */
export function FrameThumb({ frame }: { frame: FrameDesign }) {
  const base = useCompositeBase(frame);
  const photos = useShotImages();
  const ref = useRef<HTMLCanvasElement>(null);
  const k = 0.18;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawComposite(ctx, { ...base, sources: photos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, base.count, base.order, base.adjusts, base.filter, base.caption, base.logo, base.fontsReady, photos]);
  return <canvas ref={ref} width={Math.round(frame.width * k)} height={Math.round(frame.height * k)} className="h-full w-auto" aria-hidden="true" />;
}

/* ---------- video frame ---------- */

/** Builds the input for the moving version of the frame (clips in the slots). */
export function useVideoComposite(enabled: boolean): CompositeInput | null {
  const base = useCompositeBase();
  const photos = useShotImages();
  const clips = useClipVideos(enabled);
  const mirror = useBooth((s) => s.settings.mirror);
  const videoFilterId = useBooth((s) => s.videoFilterId);
  const stickers = useStickerDraws();
  if (!enabled) return null;
  const sources: (Source | null)[] = photos.map((p, i) => clips[i] ?? p);
  return {
    ...base,
    sources,
    flipSources: sources.map((_, i) => Boolean(clips[i]) && mirror),
    filter: filterCss(videoFilterId),
    stickers,
  };
}

export function VideoFramePreview() {
  const input = useVideoComposite(true);
  const ref = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const frame = input?.frame;
  const k = 0.5;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ctx = ref.current?.getContext('2d');
      const current = inputRef.current;
      if (ctx && current) {
        ctx.setTransform(k, 0, 0, k, 0, 0);
        drawComposite(ctx, current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!frame) return null;
  return (
    <div className="relative h-full max-w-full shadow-[0_10px_30px_rgba(22,48,28,0.18)]" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
      <canvas ref={ref} width={frame.width * k} height={frame.height * k} className="h-full w-full" role="img" aria-label="Pratinjau video bingkai" />
    </div>
  );
}

/* ---------- timelapse ---------- */

export function TimelapsePreview() {
  const frames = useBooth((s) => s.timelapse);
  const tl = useBooth((s) => s.tl);
  const { logo } = useFrameAssets();
  const ref = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef({ tl, logo });
  settingsRef.current = { tl, logo };

  useEffect(() => {
    if (!frames.length) return;
    const decoder = new FrameDecoder(frames);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const ctx = ref.current?.getContext('2d');
      const { tl: s, logo: l } = settingsRef.current;
      const plan = timelapsePlan(frames.length, s.speed);
      const outFrame = (((performance.now() - start) / 1000) * TIMELAPSE_FPS) % plan.outFrames;
      if (ctx) drawTimelapseFrame(ctx, 960, 540, decoder, Math.min(frames.length - 1, outFrame * plan.step), s, filterCss(s.filterId), l);
      raf = requestAnimationFrame(tick);
    };
    decoder.warm(0).then(() => (raf = requestAnimationFrame(tick)));
    return () => {
      cancelAnimationFrame(raf);
      decoder.dispose();
    };
  }, [frames]);

  return <canvas ref={ref} width={960} height={540} className="max-h-full w-full rounded-lg shadow-[0_10px_30px_rgba(22,48,28,0.18)]" role="img" aria-label="Pratinjau timelapse" />;
}
