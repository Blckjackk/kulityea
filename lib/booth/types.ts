export type ShotCount = 1 | 2 | 3 | 4 | 6;

export const SHOT_COUNTS: ShotCount[] = [1, 2, 3, 4, 6];

/** A rectangle in frame pixels. `r` is corner radius, `rot` is a tilt in degrees. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  rot?: number;
}

export interface Shot {
  /** JPEG data URL, already mirrored if mirror mode was on. */
  photo: string;
  /** Short camera clip recorded around the shutter (never mirrored). */
  clipUrl?: string;
}

/** Per-photo placement inside its slot. x/y are -100..100 (% of half the slot). */
export interface Adjust {
  x: number;
  y: number;
  zoom: number;
  rotate: number;
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_ADJUST: Adjust = { x: 0, y: 0, zoom: 1, rotate: 0, flipH: false, flipV: false };

/** A sticker placed on the frame. x/y are the centre, 0..1 of the frame size. */
export interface PlacedSticker {
  uid: string;
  stickerId: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export interface CameraSettings {
  deviceId: string;
  mirror: boolean;
  flash: boolean;
  ringLight: boolean;
  timer: number;
  count: ShotCount;
}

export interface TimelapseSettings {
  speed: number;
  fade: boolean;
  filterId: string;
  border: number;
  borderColor: string;
}

export interface Outputs {
  photoUrl?: string;
  gifUrl?: string;
  videoUrl?: string;
  timelapseUrl?: string;
  videoExt?: string;
  /** Link to this session's download page on the kiosk's Wi-Fi. */
  shareUrl?: string;
}
