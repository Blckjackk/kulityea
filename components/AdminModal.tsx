'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { btnPrimary, btnSecondary, chip } from '@/lib/ui';
import { SHOT_COUNTS, type ShotCount } from '@/lib/booth/types';
import { sound } from '@/lib/audio';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCountdown: number;
  defaultShots: ShotCount;
  onUpdateDefaults: (countdown: number, shots: ShotCount) => void;
}

const ADMIN_PINS = ['1234', '2026'];

export function AdminModal({ isOpen, onClose, defaultCountdown, defaultShots, onUpdateDefaults }: AdminModalProps) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [countdown, setCountdown] = useState(defaultCountdown);
  const [shots, setShots] = useState<ShotCount>(defaultShots);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMIN_PINS.includes(pin)) {
      sound.playTap();
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleSave = () => {
    sound.playTap();
    onUpdateDefaults(countdown, shots);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-surface p-6 text-ink sm:p-8"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>

        {!isAuthenticated ? (
          <form onSubmit={handlePinSubmit} className="space-y-5">
            <h2 id="admin-title" className="font-display text-3xl font-extrabold">
              Admin
            </h2>
            <div>
              <label htmlFor="admin-pin" className="mb-2 block text-sm font-semibold">
                PIN
              </label>
              <input
                id="admin-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`h-14 w-full rounded-xl border-2 bg-base px-4 text-center text-2xl font-semibold tracking-[0.4em] ${
                  pinError ? 'border-destructive' : 'border-ink/15 focus:border-leaf'
                }`}
                aria-invalid={pinError}
                aria-describedby={pinError ? 'pin-error' : undefined}
                autoFocus
              />
              {pinError && (
                <p id="pin-error" role="alert" className="mt-2 text-sm font-medium text-destructive">
                  PIN salah, coba lagi.
                </p>
              )}
            </div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Masuk
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <h2 id="admin-title" className="font-display text-3xl font-extrabold">
              Pengaturan kiosk
            </h2>

            <div>
              <p className="mb-2 text-sm font-semibold">Hitung mundur awal</p>
              <div className="flex gap-2">
                {[3, 5, 10].map((s) => (
                  <button key={s} aria-pressed={countdown === s} onClick={() => setCountdown(s)} className={chip(countdown === s)}>
                    {s} detik
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Jumlah foto awal</p>
              <div className="flex gap-2">
                {SHOT_COUNTS.map((c) => (
                  <button key={c} aria-pressed={shots === c} onClick={() => setShots(c)} className={chip(shots === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className={btnSecondary}>
                Batal
              </button>
              <button onClick={handleSave} className={btnPrimary}>
                {saved ? 'Tersimpan' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
