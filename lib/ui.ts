// Shared kiosk control styles. Heights stay at 48px+ so every target is easy to hit on a touchscreen.

export const btnPrimary =
  'inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-leaf px-7 text-base font-semibold text-cream transition-colors hover:bg-leaf-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink-soft';

export const btnSecondary =
  'inline-flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-ink/15 bg-surface px-5 text-base font-medium text-ink transition-colors hover:border-ink/30 active:scale-[0.98]';

/** Small option buttons (filters, counts, stickers). Pass `on` for the selected state. */
export function chip(on: boolean) {
  return `inline-flex h-12 min-w-12 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${
    on ? 'bg-ink text-cream' : 'border-2 border-ink/12 bg-surface text-ink hover:border-ink/30'
  }`;
}
