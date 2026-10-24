'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBooth } from '@/lib/booth/store';
import { canvasToBlobUrl, drawComposite } from '@/lib/booth/render';
import { filterCss } from '@/lib/booth/filters';
import {
  drawTimelapseFrame,
  extForMime,
  FrameDecoder,
  makeGif,
  pickVideoMime,
  recordCanvas,
  timelapsePlan,
  TIMELAPSE_FPS,
} from '@/lib/booth/media';
import { useShotImages, useFrameAssets } from './editor/assets';
import { useCompositeBase, useStickerDraws, useVideoComposite } from './editor/Previews';
import { btnSecondary } from '@/lib/ui';

const VIDEO_FRAME_MS = 6000;

type Phase = 'photo' | 'gif' | 'video' | 'timelapse' | 'done';

const LABELS: Record<Phase, string> = {
  photo: 'Menyusun foto',
  gif: 'Membuat GIF',
  video: 'Merekam video bingkai',
  timelapse: 'Merekam timelapse',
  done: 'Selesai',
};

export function GeneratingScreen() {
  const base = useCompositeBase();
  const photos = useShotImages();
  const stickers = useStickerDraws();
  const { logo } = useFrameAssets();
  const videoEnabled = useBooth((s) => s.videoEnabled && s.shots.some((x) => x?.clipUrl));
  const videoInput = useVideoComposite(videoEnabled);
  const timelapseEnabled = useBooth((s) => s.timelapseEnabled && s.timelapse.length >= 8);
  const timelapse = useBooth((s) => s.timelapse);
  const tl = useBooth((s) => s.tl);
  const setOutputs = useBooth((s) => s.setOutputs);
  const go = useBooth((s) => s.go);

  const [phase, setPhase] = useState<Phase>('photo');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const liveRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef(new AbortController());
  const startedRef = useRef(false);
  const videoInputRef = useRef(videoInput);
  videoInputRef.current = videoInput;

  // Start once assets are in; after 4s go ahead with whatever loaded.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(t);
  }, []);
  const photosLoaded = photos.length > 0 && photos.every((p, i) => p || !useBooth.getState().shots[i]);
  const extrasLoaded = Boolean(base.logo) && base.fontsReady && stickers.length === useBooth.getState().stickers.length;
  const ready = photosLoaded && (extrasLoaded || waited);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    const signal = abortRef.current.signal;

    // Weights for the overall progress bar.
    const parts: Phase[] = ['photo', 'gif', ...(videoEnabled ? (['video'] as const) : []), ...(timelapseEnabled ? (['timelapse'] as const) : [])];
    const weight: Record<Phase, number> = { photo: 1, gif: 1, video: 4, timelapse: 4, done: 0 };
    const total = parts.reduce((a, p) => a + weight[p], 0);
    const report = (p: Phase, local: number) => {
      const before = parts.slice(0, parts.indexOf(p)).reduce((a, q) => a + weight[q], 0);
      setProgress(Math.round(((before + weight[p] * local) / total) * 100));
    };

    (async () => {
      try {
        // 1. Print-resolution photo.
        setPhase('photo');
        const canvas = document.createElement('canvas');
        canvas.width = base.frame.width;
        canvas.height = base.frame.height;
        drawComposite(canvas.getContext('2d')!, { ...base, sources: photos, stickers });
        const photoUrl = await canvasToBlobUrl(canvas, 'image/png');
        setPreview(photoUrl);
        setOutputs({ photoUrl });
        report('photo', 1);

        // 2. GIF slideshow of the shots.
        setPhase('gif');
        const order = base.order.map((i) => photos[i]).filter((p): p is HTMLImageElement => Boolean(p));
        const gifUrl = await makeGif(order, base.filter);
        setOutputs({ gifUrl });
        report('gif', 1);

        const mime = pickVideoMime();
        const ext = extForMime(mime);

        // 3. Video frame: clips playing inside the frame.
        if (videoEnabled && !signal.aborted) {
          setPhase('video');
          const live = liveRef.current!;
          const k = 1280 / base.frame.height;
          live.width = Math.round((base.frame.width * k) / 2) * 2;
          live.height = 1280;
          const ctx = live.getContext('2d')!;
          const blob = await recordCanvas(
            live,
            VIDEO_FRAME_MS,
            () => {
              const input = videoInputRef.current;
              if (!input) return;
              ctx.setTransform(k, 0, 0, k, 0, 0);
              drawComposite(ctx, input);
            },
            (p) => report('video', p),
            signal
          );
          if (blob) setOutputs({ videoUrl: URL.createObjectURL(blob), videoExt: ext });
        }

        // 4. Timelapse of the whole session.
        if (timelapseEnabled && !signal.aborted) {
          setPhase('timelapse');
          const live = liveRef.current!;
          live.width = 1280;
          live.height = 720;
          const ctx = live.getContext('2d')!;
          const decoder = new FrameDecoder(timelapse);
          await decoder.warm(0);
          const plan = timelapsePlan(timelapse.length, tl.speed);
          const filter = filterCss(tl.filterId);
          const blob = await recordCanvas(
            live,
            plan.durationMs,
            (t) => {
              const outFrame = (t / 1000) * TIMELAPSE_FPS;
              drawTimelapseFrame(ctx, 1280, 720, decoder, Math.min(timelapse.length - 1, outFrame * plan.step), tl, filter, logo);
            },
            (p) => report('timelapse', p),
            signal,
            TIMELAPSE_FPS
          );
          decoder.dispose();
          if (blob) setOutputs({ timelapseUrl: URL.createObjectURL(blob), videoExt: ext });
        }

        setPhase('done');
        setProgress(100);
        go('result');
      } catch (err) {
        console.error(err);
        setError('Ada yang gagal saat memproses. Foto yang sudah jadi tetap bisa dilihat.');
      }
    })();
    // Runs once when every asset is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const busyWithVideo = phase === 'video' || phase === 'timelapse';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-base px-4 py-10">
      <div className="flex h-[46dvh] items-center justify-center">
        {/* One canvas for the whole run: the recorder keeps a handle to it. */}
        <canvas
          ref={liveRef}
          className={busyWithVideo ? 'h-full w-auto max-w-[90vw] rounded-lg shadow-[0_10px_30px_rgba(22,48,28,0.18)]' : 'hidden'}
          aria-hidden="true"
        />
        {!busyWithVideo && preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto jadi" className="h-full w-auto rounded-sm shadow-[0_10px_30px_rgba(22,48,28,0.18)]" />
        )}
      </div>

      <div className="w-full max-w-md text-center" aria-live="polite">
        <p className="font-display text-3xl font-extrabold">{error ? 'Proses berhenti' : `${LABELS[phase]}...`}</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-leaf transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">{progress}%</p>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}

        <div className="mt-6 flex justify-center gap-3">
          {busyWithVideo && !error && (
            <button onClick={() => abortRef.current.abort()} className={btnSecondary}>
              Lewati video
            </button>
          )}
          {error && (
            <button onClick={() => go('result')} className={btnSecondary}>
              Lihat hasil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
