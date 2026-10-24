'use client';

import { useEffect, useState } from 'react';
import { useBooth } from '@/lib/booth/store';
import { ensureFonts, loadImage, LOGO_SRC } from '@/lib/booth/render';
import { STICKERS } from '@/lib/booth/stickers';

/** Decoded shot photos, indexed by shot. */
export function useShotImages() {
  const shots = useBooth((s) => s.shots);
  const [imgs, setImgs] = useState<(HTMLImageElement | null)[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(shots.map((s) => (s ? loadImage(s.photo).catch(() => null) : Promise.resolve(null)))).then(
      (r) => !cancelled && setImgs(r)
    );
    return () => {
      cancelled = true;
    };
  }, [shots]);
  return imgs;
}

/** Logo image plus a flag for when frame fonts are ready to draw. */
export function useFrameAssets() {
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadImage(LOGO_SRC)
      .then((img) => !cancelled && setLogo(img))
      .catch(() => undefined);
    ensureFonts().then(() => !cancelled && setFontsReady(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { logo, fontsReady };
}

export function useStickerImages() {
  const [map, setMap] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(STICKERS.map((s) => loadImage(s.src).then((img) => [s.id, img] as const).catch(() => null))).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, HTMLImageElement> = {};
      pairs.forEach((p) => p && (next[p[0]] = p[1]));
      setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return map;
}

/** Looping, muted <video> elements for each shot's clip (null when a shot has none). */
export function useClipVideos(enabled: boolean) {
  const shots = useBooth((s) => s.shots);
  const [videos, setVideos] = useState<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    if (!enabled) {
      setVideos([]);
      return;
    }
    const els = shots.map((s) => {
      if (!s?.clipUrl) return null;
      const v = document.createElement('video');
      v.src = s.clipUrl;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.play().catch(() => undefined);
      return v;
    });
    setVideos(els);
    return () => {
      els.forEach((v) => {
        if (!v) return;
        v.pause();
        v.removeAttribute('src');
        v.load();
      });
    };
  }, [shots, enabled]);
  return videos;
}
