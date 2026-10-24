'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { Logo } from './Logo';
import { sound } from '@/lib/audio';

// Paper colours of the real frame designs (Klasik, Film, Kulit Jeruk, Pitaya, Daun).
const PAPERS = [
  { paper: '#FFFFFF', ink: '#16301C' },
  { paper: '#17150F', ink: '#FFF6E6' },
  { paper: '#F28A2E', ink: '#16301C' },
  { paper: '#F6B9D2', ink: '#3A1424' },
  { paper: '#FFF6E6', ink: '#23823C' },
];

interface WelcomeScreenProps {
  onStart: () => void;
  onAdminClick: () => void;
}

// Blank strips in the real frame colours, scattered at the edges like prints on a table.
const STRIPS = [
  { frame: 1, cls: 'left-[-28px] top-[14%] -rotate-12', from: -80, hideOnMobile: false },
  { frame: 2, cls: 'left-[7%] bottom-[-70px] rotate-[9deg]', from: -80, hideOnMobile: true },
  { frame: 4, cls: 'right-[-24px] top-[10%] rotate-[11deg]', from: 80, hideOnMobile: false },
  { frame: 3, cls: 'right-[9%] bottom-[-90px] -rotate-6', from: 80, hideOnMobile: true },
  { frame: 0, cls: 'left-[22%] top-[-120px] rotate-[4deg]', from: -60, hideOnMobile: true },
];

function BlankStrip({ paper, ink }: { paper: string; ink: string }) {
  return (
    <div
      className="w-24 rounded-[4px] p-2 shadow-[0_6px_14px_rgba(22,48,28,0.18)] sm:w-28"
      style={{ background: paper }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-1.5 aspect-[4/3] rounded-[2px]" style={{ background: ink, opacity: 0.14 }} />
      ))}
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full" style={{ background: ink, opacity: 0.35 }} />
    </div>
  );
}

export function WelcomeScreen({ onStart, onAdminClick }: WelcomeScreenProps) {
  const [flashing, setFlashing] = useState(false);

  const handleStart = () => {
    if (flashing) return;
    sound.playShutter();
    setFlashing(true);
    window.setTimeout(onStart, 320);
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-base text-ink">
      {/* Prints on the table */}
      {STRIPS.map((s, i) => {
        const f = PAPERS[s.frame];
        return (
          <motion.div
            key={i}
            aria-hidden="true"
            initial={{ opacity: 0, x: s.from }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute ${s.cls} ${s.hideOnMobile ? 'hidden md:block' : ''}`}
          >
            <BlankStrip paper={f.paper} ink={f.ink} />
          </motion.div>
        );
      })}

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-8">
        <Logo size="md" />
        <span className="text-sm font-semibold text-ink-soft">RiseUp Fest 2026</span>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-14 pt-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-[6%] aspect-[10/7] w-[min(86vw,560px)]"
        >
          {/* Viewfinder hump and shutter release on top of the body */}
          <div aria-hidden="true" className="absolute bottom-full left-[12%] h-[9%] w-[28%] rounded-t-2xl bg-sun" />
          <div aria-hidden="true" className="absolute bottom-full right-[14%] h-[5%] w-[13%] rounded-t-lg bg-ink" />

          {/* Camera body */}
          <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-sun shadow-[0_16px_0_rgba(22,48,28,0.14)]">
            {/* Instant-camera stripes, in logo cream and leaf green */}
            <div aria-hidden="true" className="absolute inset-x-0 top-[47%] h-[7%] bg-cream" />
            <div aria-hidden="true" className="absolute inset-x-0 top-[54%] h-[7%] bg-leaf" />

            {/* Name plate */}
            <div className="absolute left-[5%] top-[7%] flex h-[16%] items-center rounded-xl bg-cream px-[3%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-kulittea.png" alt="" aria-hidden="true" className="h-[78%] w-auto" />
            </div>

            {/* Flash window */}
            <div aria-hidden="true" className="absolute right-[5%] top-[7%] h-[16%] w-[19%] rounded-lg border-[5px] border-ink bg-cream" />
          </div>

          {/* Lens = start button */}
          <button
            onClick={handleStart}
            aria-label="Mulai foto"
            className="group absolute left-1/2 top-[56%] aspect-square h-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink p-[7%] ring-[10px] ring-cream transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            <svg aria-hidden="true" viewBox="0 0 100 100" className="animate-lens absolute inset-[4%] h-[92%] w-[92%]">
              <circle cx="50" cy="50" r="47" fill="none" stroke="#F7F1E1" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 5" />
            </svg>
            {/* Glass: the radial highlight gives the lens its depth */}
            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#2F6B3B_0%,#0F2414_68%)]">
              <span className="font-display text-[clamp(1.75rem,7vw,3.25rem)] font-extrabold text-cream">Mulai</span>
            </span>
          </button>
        </motion.div>

        <p className="mt-12 text-center text-base font-medium text-ink-soft sm:text-lg">
          Sentuh lensa untuk mulai foto
        </p>
      </section>

      {/* Flash on tap */}
      {flashing && <div className="animate-shutter-flash pointer-events-none fixed inset-0 z-50 bg-white" />}

      <button
        onClick={onAdminClick}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
        aria-label="Buka pengaturan admin"
      >
        <Settings className="h-5 w-5" />
      </button>
    </main>
  );
}
