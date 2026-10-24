'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FlipHorizontal2, FlipVertical2, Trash2 } from 'lucide-react';
import { useBooth } from '@/lib/booth/store';
import { framesFor } from '@/lib/booth/frames';
import { FILTER_GROUPS, FILTERS, VIDEO_FILTER_IDS, type FilterGroup } from '@/lib/booth/filters';
import { STICKERS } from '@/lib/booth/stickers';
import { DEFAULT_ADJUST, type ShotCount } from '@/lib/booth/types';
import { btnPrimary, btnSecondary, chip } from '@/lib/ui';
import { sound } from '@/lib/audio';
import { Choices, SliderRow, ToggleRow } from '../kiosk/controls';
import { FrameThumb, PhotoPreview, TimelapsePreview, VideoFramePreview } from './Previews';

const STEPS = [
  { id: 'frame', label: 'Frame' },
  { id: 'layout', label: 'Tata letak' },
  { id: 'filter', label: 'Filter' },
  { id: 'sticker', label: 'Stiker' },
  { id: 'video', label: 'Video bingkai' },
  { id: 'timelapse', label: 'Timelapse' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const BORDER_COLORS = ['#FFF6E6', '#FFFFFF', '#16301C', '#23823C', '#F28A2E', '#F6B9D2'];

export function EditorScreen() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [slot, setSlot] = useState(0);
  const [sticker, setSticker] = useState<string | null>(null);
  const go = useBooth((s) => s.go);
  const current: StepId = STEPS[step].id;

  const moveTo = (i: number) => {
    sound.playTap();
    setStep(i);
    setReached((r) => Math.max(r, i));
  };

  const next = () => (step === STEPS.length - 1 ? (sound.playTap(), go('generating')) : moveTo(step + 1));
  const back = () => (step === 0 ? (sound.playTap(), go('booth')) : moveTo(step - 1));

  return (
    <div className="flex h-dvh flex-col bg-base">
      <nav aria-label="Langkah edit" className="no-scrollbar overflow-x-auto border-b border-ink/10 px-3 py-2">
        <ol className="mx-auto flex w-max items-center gap-1">
          {STEPS.map((s, i) => {
            const done = i < step;
            const now = i === step;
            return (
              <li key={s.id} className="flex items-center gap-1">
                <button
                  onClick={() => moveTo(i)}
                  disabled={i > reached}
                  aria-current={now ? 'step' : undefined}
                  className={`flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    now ? 'bg-ink text-cream' : 'hover:bg-ink/5'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      now ? 'bg-cream text-ink' : done ? 'bg-leaf text-cream' : 'border-2 border-ink/20'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <span className="h-px w-3 bg-ink/20" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex h-[42dvh] shrink-0 items-center justify-center bg-muted p-4 lg:h-auto lg:flex-1 lg:p-8">
          {current === 'video' ? (
            <VideoFramePreview />
          ) : current === 'timelapse' ? (
            <TimelapsePreview />
          ) : (
            <PhotoPreview
              mode={current === 'layout' ? 'layout' : current === 'sticker' ? 'sticker' : undefined}
              selectedSlot={slot}
              onSelectSlot={setSlot}
              selectedSticker={sticker}
              onSelectSticker={setSticker}
            />
          )}
        </section>

        <aside className="flex min-h-0 flex-1 flex-col border-ink/10 lg:w-[460px] lg:flex-none lg:border-l">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <h1 className="mb-5 text-3xl font-extrabold">{STEPS[step].label}</h1>
            {current === 'frame' && <FramePanel />}
            {current === 'layout' && <LayoutPanel slot={slot} setSlot={setSlot} />}
            {current === 'filter' && <FilterPanel />}
            {current === 'sticker' && <StickerPanel selected={sticker} setSelected={setSticker} />}
            {current === 'video' && <VideoPanel />}
            {current === 'timelapse' && <TimelapsePanel />}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-ink/10 p-4">
            <button onClick={back} className={btnSecondary}>
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              {step === 0 ? 'Kamera' : 'Kembali'}
            </button>
            <button onClick={next} className={btnPrimary}>
              {step === STEPS.length - 1 ? 'Selesai' : 'Selanjutnya'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- panels ---------- */

function FramePanel() {
  const count = useBooth((s) => s.settings.count) as ShotCount;
  const frameId = useBooth((s) => s.frameId);
  const caption = useBooth((s) => s.caption);
  const patch = useBooth((s) => s.patch);
  const options = framesFor(count);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        {options.map((f) => {
          const on = f.id === frameId;
          return (
            <button
              key={f.id}
              aria-pressed={on}
              onClick={() => {
                sound.playTap();
                patch({ frameId: f.id });
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border-[3px] bg-surface p-3 transition-colors ${
                on ? 'border-leaf' : 'border-transparent hover:border-ink/15'
              }`}
            >
              <span className="flex h-40 items-center justify-center">
                <FrameThumb frame={f} />
              </span>
              <span className="text-sm font-semibold">{f.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <label htmlFor="caption" className="mb-2 block text-sm font-semibold">
          Tulisan di frame <span className="font-normal text-ink-soft">(boleh kosong)</span>
        </label>
        <input
          id="caption"
          value={caption}
          maxLength={24}
          onChange={(e) => patch({ caption: e.target.value })}
          placeholder="Contoh: Reuni SMA 2016"
          className="h-12 w-full rounded-lg border-2 border-ink/12 bg-surface px-3"
        />
      </div>
    </div>
  );
}

function LayoutPanel({ slot, setSlot }: { slot: number; setSlot: (n: number) => void }) {
  const shots = useBooth((s) => s.shots);
  const order = useBooth((s) => s.order);
  const adjusts = useBooth((s) => s.adjusts);
  const setAdjust = useBooth((s) => s.setAdjust);
  const patch = useBooth((s) => s.patch);
  const shotIndex = order[slot] ?? 0;
  const adj = adjusts[shotIndex] ?? DEFAULT_ADJUST;
  const set = (p: Partial<typeof adj>) => setAdjust(shotIndex, p);

  const swap = (dir: -1 | 1) => {
    const to = slot + dir;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[slot], next[to]] = [next[to], next[slot]];
    patch({ order: next });
    setSlot(to);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold">Pilih foto (atau ketuk fotonya di pratinjau)</p>
        <div className="flex flex-wrap gap-2">
          {order.map((shot, pos) => (
            <button
              key={pos}
              aria-pressed={pos === slot}
              aria-label={`Foto posisi ${pos + 1}`}
              onClick={() => setSlot(pos)}
              className={`relative h-16 w-20 overflow-hidden rounded-lg border-[3px] ${pos === slot ? 'border-sun' : 'border-transparent'}`}
            >
              {shots[shot] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shots[shot]!.photo} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 text-xs font-semibold text-cream">{pos + 1}</span>
            </button>
          ))}
        </div>
        {order.length > 1 && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => swap(-1)} disabled={slot === 0} className={`${chip(false)} disabled:opacity-40`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Pindah ke depan
            </button>
            <button onClick={() => swap(1)} disabled={slot === order.length - 1} className={`${chip(false)} disabled:opacity-40`}>
              Pindah ke belakang <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <SliderRow label="Geser horizontal" value={adj.x} min={-100} max={100} step={1} reset={0} onChange={(x) => set({ x })} />
      <SliderRow label="Geser vertikal" value={adj.y} min={-100} max={100} step={1} reset={0} onChange={(y) => set({ y })} />
      <SliderRow label="Zoom" value={adj.zoom} min={1} max={3} step={0.05} reset={1} onChange={(zoom) => set({ zoom })} format={(v) => `${v.toFixed(2)}x`} />
      <SliderRow label="Putar" value={adj.rotate} min={-180} max={180} step={1} reset={0} onChange={(rotate) => set({ rotate })} format={(v) => `${v}°`} />

      <div className="grid grid-cols-2 gap-2">
        <button aria-pressed={adj.flipH} onClick={() => set({ flipH: !adj.flipH })} className={chip(adj.flipH)}>
          <FlipHorizontal2 className="mr-2 h-4 w-4" aria-hidden="true" /> Balik horizontal
        </button>
        <button aria-pressed={adj.flipV} onClick={() => set({ flipV: !adj.flipV })} className={chip(adj.flipV)}>
          <FlipVertical2 className="mr-2 h-4 w-4" aria-hidden="true" /> Balik vertikal
        </button>
      </div>
      <button onClick={() => set({ ...DEFAULT_ADJUST })} className={`${btnSecondary} w-full`}>
        Reset foto ini
      </button>
    </div>
  );
}

function FilterPanel() {
  const [group, setGroup] = useState<FilterGroup | 'semua'>('semua');
  const filterId = useBooth((s) => s.filterId);
  const patch = useBooth((s) => s.patch);
  const sample = useBooth((s) => s.shots.find(Boolean)?.photo);
  const list = group === 'semua' ? FILTERS : FILTERS.filter((f) => f.group === group);
  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Kelompok filter">
        {FILTER_GROUPS.map((g) => (
          <button key={g.id} aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={chip(group === g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {list.map((f) => {
          const on = f.id === filterId;
          return (
            <button
              key={f.id}
              aria-pressed={on}
              onClick={() => {
                sound.playTap();
                patch({ filterId: f.id });
              }}
              className="flex flex-col items-center gap-1.5"
            >
              <span className={`aspect-[4/3] w-full overflow-hidden rounded-lg border-[3px] ${on ? 'border-leaf' : 'border-transparent'}`}>
                {sample && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sample} alt="" className="h-full w-full object-cover" style={{ filter: f.css }} />
                )}
              </span>
              <span className={`text-xs ${on ? 'font-semibold' : ''}`}>{f.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StickerPanel({ selected, setSelected }: { selected: string | null; setSelected: (uid: string | null) => void }) {
  const stickers = useBooth((s) => s.stickers);
  const patch = useBooth((s) => s.patch);
  const current = stickers.find((s) => s.uid === selected);

  const add = (stickerId: string) => {
    sound.playTap();
    const uid = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const jitter = () => (Math.random() - 0.5) * 0.2;
    patch({ stickers: [...stickers, { uid, stickerId, x: 0.5 + jitter(), y: 0.45 + jitter(), scale: 1, rotate: 0 }] });
    setSelected(uid);
  };
  const update = (p: Partial<(typeof stickers)[number]>) =>
    patch({ stickers: stickers.map((s) => (s.uid === selected ? { ...s, ...p } : s)) });

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">Ketuk stiker untuk menambah, lalu geser di pratinjau.</p>
      <div className="grid grid-cols-4 gap-2">
        {STICKERS.map((s) => (
          <button
            key={s.id}
            onClick={() => add(s.id)}
            aria-label={`Tambah stiker ${s.name}`}
            className="flex aspect-square items-center justify-center rounded-xl border-2 border-ink/10 bg-surface p-2 hover:border-ink/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt="" className="max-h-full max-w-full" />
          </button>
        ))}
      </div>

      {current ? (
        <div className="space-y-4 rounded-xl bg-surface p-4">
          <p className="text-sm font-semibold">Stiker terpilih</p>
          <SliderRow label="Ukuran" value={current.scale} min={0.3} max={2.5} step={0.05} reset={1} onChange={(scale) => update({ scale })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderRow label="Putar" value={current.rotate} min={-180} max={180} step={1} reset={0} onChange={(rotate) => update({ rotate })} format={(v) => `${v}°`} />
          <button
            onClick={() => {
              patch({ stickers: stickers.filter((s) => s.uid !== selected) });
              setSelected(null);
            }}
            className={`${btnSecondary} w-full text-destructive`}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" /> Hapus stiker ini
          </button>
        </div>
      ) : (
        stickers.length > 0 && <p className="text-sm text-ink-soft">Ketuk stiker di pratinjau untuk mengatur ukuran atau menghapusnya.</p>
      )}

      {stickers.length > 0 && (
        <button
          onClick={() => {
            patch({ stickers: [] });
            setSelected(null);
          }}
          className="h-11 text-sm font-semibold text-destructive underline underline-offset-4"
        >
          Hapus semua stiker
        </button>
      )}
    </div>
  );
}

const filterName = (id: string) => FILTERS.find((f) => f.id === id)?.name ?? id;

function VideoPanel() {
  const hasClips = useBooth((s) => s.shots.some((x) => x?.clipUrl));
  const enabled = useBooth((s) => s.videoEnabled);
  const filterId = useBooth((s) => s.videoFilterId);
  const patch = useBooth((s) => s.patch);
  if (!hasClips) {
    return <p className="text-ink-soft">Sesi ini tidak punya rekaman video, jadi video bingkai tidak bisa dibuat. Foto tetap bisa diunduh.</p>;
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">Setiap foto diganti potongan video saat kamu berpose, di dalam frame yang sama.</p>
      <ToggleRow label="Buat video bingkai" checked={enabled} onChange={(v) => patch({ videoEnabled: v })} />
      <Choices label="Filter video" value={filterId} options={VIDEO_FILTER_IDS} onChange={(v) => patch({ videoFilterId: v })} format={filterName} disabled={!enabled} />
    </div>
  );
}

function TimelapsePanel() {
  const frames = useBooth((s) => s.timelapse.length);
  const enabled = useBooth((s) => s.timelapseEnabled);
  const tl = useBooth((s) => s.tl);
  const patch = useBooth((s) => s.patch);
  const setTl = useBooth((s) => s.setTimelapse);
  if (frames < 8) {
    return <p className="text-ink-soft">Rekaman sesi terlalu pendek untuk dijadikan timelapse.</p>;
  }
  return (
    <div className="space-y-6">
      <ToggleRow label="Buat timelapse" checked={enabled} onChange={(v) => patch({ timelapseEnabled: v })} hint="Rekaman cepat seluruh sesi fotomu" />
      <Choices label="Kecepatan" value={tl.speed} options={[0.25, 0.5, 0.75, 1, 1.5, 2]} onChange={(speed) => setTl({ speed })} format={(v) => `${v}x`} disabled={!enabled} />
      <Choices label="Transisi" value={tl.fade ? 'fade' : 'none'} options={['none', 'fade']} onChange={(v) => setTl({ fade: v === 'fade' })} format={(v) => (v === 'fade' ? 'Fade' : 'Tanpa')} disabled={!enabled} />
      <Choices label="Filter" value={tl.filterId} options={VIDEO_FILTER_IDS} onChange={(filterId) => setTl({ filterId })} format={filterName} disabled={!enabled} />
      <SliderRow label="Lebar bingkai" value={tl.border} min={0} max={80} step={2} reset={0} onChange={(border) => setTl({ border })} format={(v) => `${v}px`} />
      <div>
        <p className="mb-2 text-sm font-semibold">Warna bingkai</p>
        <div className="flex flex-wrap items-center gap-2">
          {BORDER_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Warna ${c}`}
              aria-pressed={tl.borderColor === c}
              onClick={() => setTl({ borderColor: c })}
              className={`h-11 w-11 rounded-full border-2 ${tl.borderColor === c ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-ink/20'}`}
              style={{ background: c }}
            />
          ))}
          <label className="flex h-11 items-center gap-2 rounded-full border-2 border-ink/20 px-3 text-sm">
            Lainnya
            <input type="color" value={tl.borderColor} onChange={(e) => setTl({ borderColor: e.target.value })} className="h-7 w-7 cursor-pointer" />
          </label>
        </div>
      </div>
    </div>
  );
}
