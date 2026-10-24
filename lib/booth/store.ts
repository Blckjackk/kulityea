'use client';

import { create } from 'zustand';
import type { Adjust, CameraSettings, Outputs, PlacedSticker, Shot, ShotCount, TimelapseSettings } from './types';
import { DEFAULT_ADJUST } from './types';
import { framesFor } from './frames';

export type Screen = 'welcome' | 'booth' | 'edit' | 'generating' | 'result';

/** Snapshot rate while a session runs. */
export const TIMELAPSE_CAPTURE_MS = 250;
const TIMELAPSE_MAX_FRAMES = 720;

interface BoothState {
  screen: Screen;
  settings: CameraSettings;
  shots: (Shot | null)[];
  timelapse: Blob[];

  frameId: string;
  caption: string;
  order: number[];
  adjusts: Adjust[];
  filterId: string;
  stickers: PlacedSticker[];
  videoEnabled: boolean;
  videoFilterId: string;
  timelapseEnabled: boolean;
  tl: TimelapseSettings;

  outputs: Outputs;

  go: (screen: Screen) => void;
  setSettings: (patch: Partial<CameraSettings>) => void;
  setShot: (index: number, shot: Shot) => void;
  addTimelapseFrame: (blob: Blob) => void;
  startEditing: () => void;
  patch: (patch: Partial<Pick<BoothState, 'frameId' | 'caption' | 'order' | 'filterId' | 'stickers' | 'videoEnabled' | 'videoFilterId' | 'timelapseEnabled'>>) => void;
  setAdjust: (shot: number, patch: Partial<Adjust>) => void;
  setTimelapse: (patch: Partial<TimelapseSettings>) => void;
  setOutputs: (patch: Partial<Outputs>) => void;
  resetSession: () => void;
}

const DEFAULT_TL: TimelapseSettings = { speed: 1, fade: true, filterId: 'asli', border: 0, borderColor: '#FFF6E6' };

function revoke(url?: string) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

function emptyShots(count: number) {
  return Array.from({ length: count }, () => null);
}

export const useBooth = create<BoothState>((set, get) => ({
  screen: 'welcome',
  settings: { deviceId: '', mirror: true, flash: true, ringLight: false, timer: 3, count: 4 },
  shots: emptyShots(4),
  timelapse: [],

  frameId: 'klasik',
  caption: '',
  order: [0, 1, 2, 3],
  adjusts: Array.from({ length: 4 }, () => ({ ...DEFAULT_ADJUST })),
  filterId: 'asli',
  stickers: [],
  videoEnabled: true,
  videoFilterId: 'asli',
  timelapseEnabled: true,
  tl: DEFAULT_TL,

  outputs: {},

  go: (screen) => set({ screen }),

  setSettings: (patch) => {
    const prev = get().settings;
    const settings = { ...prev, ...patch };
    if (patch.count && patch.count !== prev.count) {
      get().shots.forEach((s) => revoke(s?.clipUrl));
      set({ settings, shots: emptyShots(patch.count) });
    } else {
      set({ settings });
    }
  },

  setShot: (index, shot) => {
    const shots = [...get().shots];
    revoke(shots[index]?.clipUrl);
    shots[index] = shot;
    set({ shots });
  },

  addTimelapseFrame: (blob) => {
    const timelapse = get().timelapse;
    if (timelapse.length >= TIMELAPSE_MAX_FRAMES) return;
    set({ timelapse: [...timelapse, blob] });
  },

  startEditing: () => {
    const { settings, frameId, shots } = get();
    const count = settings.count as ShotCount;
    const options = framesFor(count);
    set({
      screen: 'edit',
      frameId: options.some((f) => f.id === frameId) ? frameId : options[0]?.id ?? 'daun',
      order: Array.from({ length: count }, (_, i) => i),
      adjusts: Array.from({ length: count }, () => ({ ...DEFAULT_ADJUST })),
      videoEnabled: shots.some((s) => s?.clipUrl),
      timelapseEnabled: get().timelapse.length > 8,
    });
  },

  patch: (patch) => set(patch),

  setAdjust: (shot, patch) => {
    const adjusts = [...get().adjusts];
    adjusts[shot] = { ...adjusts[shot], ...patch };
    set({ adjusts });
  },

  setTimelapse: (patch) => set({ tl: { ...get().tl, ...patch } }),

  setOutputs: (patch) => set({ outputs: { ...get().outputs, ...patch } }),

  resetSession: () => {
    const { shots, outputs, settings } = get();
    shots.forEach((s) => revoke(s?.clipUrl));
    Object.values(outputs).forEach((u) => typeof u === 'string' && revoke(u));
    set({
      screen: 'welcome',
      shots: emptyShots(settings.count),
      timelapse: [],
      caption: '',
      filterId: 'asli',
      stickers: [],
      videoFilterId: 'asli',
      tl: DEFAULT_TL,
      outputs: {},
    });
  },
}));
