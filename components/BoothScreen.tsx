'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { TIMELAPSE_CAPTURE_MS, useBooth } from '@/lib/booth/store';
import { SHOT_COUNTS } from '@/lib/booth/types';
import { listCameras, openCamera, openSampleCamera, startClip } from '@/lib/booth/media';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { Choices, ToggleRow } from './kiosk/controls';
import { sound } from '@/lib/audio';

type CamState = 'loading' | 'live' | 'sample';

export function BoothScreen() {
  const settings = useBooth((s) => s.settings);
  const shots = useBooth((s) => s.shots);
  const setSettings = useBooth((s) => s.setSettings);
  const setShot = useBooth((s) => s.setShot);
  const addTimelapseFrame = useBooth((s) => s.addTimelapseFrame);
  const startEditing = useBooth((s) => s.startEditing);
  const resetSession = useBooth((s) => s.resetSession);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopSampleRef = useRef<(() => void) | null>(null);
  const clipRef = useRef<{ stop: () => Promise<string | undefined> } | null>(null);
  const modeRef = useRef<'sequence' | 'single'>('sequence');
  const mountedRef = useRef(true);

  const [cam, setCam] = useState<CamState>('loading');
  const [camError, setCamError] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [flashOn, setFlashOn] = useState(false);

  const taken = shots.filter(Boolean).length;
  const allDone = taken === shots.length;

  const stopStream = useCallback(() => {
    stopSampleRef.current?.();
    stopSampleRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Open the chosen camera, or fall back to the labelled sample picture.
  useEffect(() => {
    let cancelled = false;
    const attach = (stream: MediaStream) => {
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.play().catch(() => undefined);
      }
    };
    (async () => {
      setCam('loading');
      stopStream();
      try {
        const stream = await openCamera(settings.deviceId || undefined);
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        attach(stream);
        setCam('live');
        setCamError('');
        setCameras(await listCameras());
      } catch (err) {
        if (cancelled) return;
        const sample = openSampleCamera();
        stopSampleRef.current = sample.stop;
        attach(sample.stream);
        setCam('sample');
        const denied = err instanceof Error && err.name === 'NotAllowedError';
        setCamError(denied ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser.' : 'Kamera tidak ditemukan.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.deviceId, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  const begin = useCallback(
    (index: number) => {
      if (!mountedRef.current) return;
      setActive(index);
      setCount(settings.timer);
    },
    [settings.timer]
  );

  const shoot = useCallback(
    (index: number) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const scale = Math.min(1, 1920 / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d')!;
      if (settings.mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', 0.92);

      sound.playShutter();
      if (settings.flash) {
        setFlashOn(true);
        window.setTimeout(() => setFlashOn(false), 350);
      }
      setActive(null);
      setShot(index, { photo });

      // Keep recording a beat past the shutter so the clip includes the moment.
      const clip = clipRef.current;
      clipRef.current = null;
      window.setTimeout(async () => {
        const clipUrl = await clip?.stop();
        if (clipUrl && mountedRef.current) setShot(index, { photo, clipUrl });
      }, 450);

      const next = useBooth.getState().shots.findIndex((s, i) => !s && i !== index);
      if (modeRef.current === 'sequence' && next !== -1) {
        window.setTimeout(() => begin(next), 1400);
      } else {
        window.setTimeout(() => mountedRef.current && setRunning(false), 600);
      }
    },
    [settings.mirror, settings.flash, setShot, begin]
  );

  // Countdown. The clip starts in the last three seconds so it stays short.
  useEffect(() => {
    if (active === null) return;
    if (count <= 0) {
      shoot(active);
      return;
    }
    sound.playBeep(count === 1);
    if (count === Math.min(3, settings.timer) && !clipRef.current && streamRef.current) {
      clipRef.current = startClip(streamRef.current);
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [active, count, settings.timer, shoot]);

  // Timelapse snapshots while a session is running.
  useEffect(() => {
    if (!running) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      ctx.save();
      if (settings.mirror) {
        ctx.translate(640, 0);
        ctx.scale(-1, 1);
      }
      const k = Math.max(640 / v.videoWidth, 360 / v.videoHeight);
      ctx.drawImage(v, 320 - (v.videoWidth * k) / 2, 180 - (v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
      ctx.restore();
      canvas.toBlob((b) => b && addTimelapseFrame(b), 'image/jpeg', 0.7);
    }, TIMELAPSE_CAPTURE_MS);
    return () => window.clearInterval(id);
  }, [running, settings.mirror, addTimelapseFrame]);

  const startSession = () => {
    const first = shots.findIndex((s) => !s);
    if (first === -1 || running) return;
    setPanelOpen(false);
    modeRef.current = 'sequence';
    setRunning(true);
    begin(first);
  };

  const retake = (index: number) => {
    if (running) return;
    sound.playTap();
    setPanelOpen(false);
    modeRef.current = 'single';
    setRunning(true);
    begin(index);
  };

  const exit = () => {
    sound.playTap();
    stopStream();
    resetSession();
  };

  const ring = settings.ringLight;

  return (
    <div className={`relative flex min-h-dvh flex-col transition-colors ${ring ? 'bg-white' : 'bg-base'}`}>
      {flashOn && <div className="animate-shutter-flash pointer-events-none fixed inset-0 z-50 bg-white" />}

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button onClick={exit} className={btnSecondary}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Keluar
        </button>
        <p className="font-display text-2xl font-extrabold sm:text-3xl" aria-live="polite">
          Foto {taken}
          <span className="text-ink-soft"> / {shots.length}</span>
        </p>
        <button
          onClick={() => setPanelOpen((o) => !o)}
          disabled={running}
          aria-expanded={panelOpen}
          className={`${btnSecondary} disabled:opacity-40`}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Pengaturan</span>
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 sm:px-6 lg:flex-row">
        {/* Viewfinder inside the orange camera body */}
        <section className="relative flex flex-1 items-center justify-center">
          <div
            className={`relative aspect-[3/4] max-h-[60dvh] w-full rounded-[28px] bg-sun p-2.5 transition-shadow sm:aspect-[4/3] sm:max-h-none sm:p-4 lg:aspect-auto lg:h-[calc(100dvh-200px)] ${
              ring ? 'shadow-[0_0_0_12px_#fff,0_0_120px_50px_rgba(255,255,255,0.95)]' : ''
            }`}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-ink">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${settings.mirror ? 'scale-x-[-1]' : ''}`}
              />

              {cam === 'loading' && (
                <p className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold text-cream">
                  Menyalakan kamera...
                </p>
              )}
              {cam === 'sample' && (
                <p className="absolute left-3 top-3 max-w-[80%] rounded-lg bg-ink/85 px-3 py-2 text-sm text-cream">
                  {camError} Memakai kamera contoh.
                </p>
              )}

              {active !== null && count > 0 && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/35">
                  <div className="relative flex items-center justify-center">
                    <svg className="h-44 w-44 -rotate-90 sm:h-56 sm:w-56" viewBox="0 0 100 100" aria-hidden="true">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="#F7F1E1" strokeOpacity="0.25" strokeWidth="6" />
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        stroke="#F28A2E"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="276"
                        strokeDashoffset={((settings.timer - count) / settings.timer) * 276}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute font-display text-8xl font-extrabold text-cream sm:text-9xl" aria-live="assertive">
                      {count}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-cream">Foto {active + 1}, siap pose!</p>
                </div>
              )}

              {panelOpen && !running && (
                <div className="absolute inset-x-3 bottom-3 z-30 max-h-[calc(100%-24px)] overflow-y-auto rounded-2xl bg-surface/95 p-4 text-ink shadow-lg sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xl font-extrabold">Pengaturan kamera</h2>
                    <button
                      onClick={() => setPanelOpen(false)}
                      className="flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink-soft hover:bg-ink/5"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Tutup
                    </button>
                  </div>
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label htmlFor="cam-source" className="mb-2 block text-sm font-semibold">
                        Sumber kamera
                      </label>
                      {cameras.length > 0 ? (
                        <select
                          id="cam-source"
                          value={settings.deviceId}
                          onChange={(e) => setSettings({ deviceId: e.target.value })}
                          className="h-12 w-full rounded-lg border-2 border-ink/12 bg-surface px-3 text-sm"
                        >
                          <option value="">Kamera bawaan</option>
                          {cameras.map((c, i) => (
                            <option key={c.deviceId} value={c.deviceId}>
                              {c.label || `Kamera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p id="cam-source" className="text-sm text-ink-soft">
                          {cam === 'sample' ? 'Kamera contoh' : 'Mencari kamera...'}
                        </p>
                      )}
                    </div>
                    <ToggleRow label="Cermin" checked={settings.mirror} onChange={(mirror) => setSettings({ mirror })} hint="Tampil seperti bercermin" />
                    <ToggleRow label="Lampu kilat" checked={settings.flash} onChange={(flash) => setSettings({ flash })} hint="Layar berkedip putih saat jepret" />
                    <ToggleRow label="Ring light" checked={settings.ringLight} onChange={(ringLight) => setSettings({ ringLight })} hint="Layar terang untuk menerangi wajah" />
                    <Choices label="Timer" value={settings.timer} options={[3, 5, 10]} onChange={(timer) => setSettings({ timer })} format={(v) => `${v} detik`} />
                    <div>
                      <Choices
                        label="Jumlah foto"
                        value={settings.count}
                        options={SHOT_COUNTS}
                        onChange={(c) => setSettings({ count: c })}
                        disabled={taken > 0}
                      />
                      {taken > 0 && <p className="mt-1 text-xs text-ink-soft">Keluar dulu untuk mengganti jumlah foto.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Shots taken so far */}
        <aside
          className="no-scrollbar flex gap-3 overflow-x-auto pb-1 lg:max-h-[calc(100dvh-200px)] lg:w-44 lg:flex-col lg:overflow-y-auto lg:pb-0"
          aria-label="Hasil jepretan"
        >
          {shots.map((shot, i) => (
            <div
              key={i}
              className={`relative aspect-[4/3] w-36 shrink-0 overflow-hidden rounded-xl border-4 lg:w-full ${
                active === i ? 'border-sun' : shot ? 'border-surface' : 'border-dashed border-ink/20'
              }`}
            >
              {shot ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.photo} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => retake(i)}
                    disabled={running}
                    aria-label={`Ulangi foto ${i + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow disabled:opacity-40"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <span className="flex h-full items-center justify-center font-display text-3xl font-extrabold text-ink/30">{i + 1}</span>
              )}
            </div>
          ))}
        </aside>
      </main>

      <footer className="flex items-center justify-center gap-3 px-4 py-3">
        {allDone && !running ? (
          <button
            onClick={() => {
              sound.playTap();
              stopStream();
              startEditing();
            }}
            className={`${btnPrimary} h-16 px-10 text-lg`}
          >
            Lanjut edit foto
          </button>
        ) : (
          <button
            onClick={startSession}
            disabled={running || cam === 'loading'}
            className="inline-flex h-20 items-center gap-3 rounded-full bg-sun pl-2 pr-8 text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink bg-surface">
              <Camera className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl font-extrabold">
              {running ? 'Memotret...' : taken === 0 ? 'Mulai jepret' : 'Lanjut jepret'}
            </span>
          </button>
        )}
      </footer>
    </div>
  );
}
