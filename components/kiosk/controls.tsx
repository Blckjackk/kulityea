'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { chip } from '@/lib/ui';
import { sound } from '@/lib/audio';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        sound.playTap();
        onChange(!checked);
      }}
      className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${checked ? 'bg-leaf' : 'bg-ink/20'}`}
    >
      <span className={`absolute top-1 h-7 w-7 rounded-full bg-surface shadow transition-all ${checked ? 'left-8' : 'left-1'}`} />
    </button>
  );
}

export function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format = (v) => String(v),
  disabled,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o)}
            aria-pressed={value === o}
            disabled={disabled}
            onClick={() => {
              sound.playTap();
              onChange(o);
            }}
            className={`${chip(value === o)} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Range input with step buttons on both ends and a reset link. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  reset,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  reset?: number;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const id = React.useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}: <span className="font-normal text-ink-soft">{format(value)}</span>
        </label>
        {reset !== undefined && value !== reset && (
          <button onClick={() => onChange(reset)} className="h-9 rounded-md px-2 text-sm font-semibold text-leaf">
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(clamp(value - step * 5))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink/12 bg-surface"
          aria-label={`Kurangi ${label}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 w-full accent-[#1E7536]"
        />
        <button
          onClick={() => onChange(clamp(value + step * 5))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink/12 bg-surface"
          aria-label={`Tambah ${label}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
