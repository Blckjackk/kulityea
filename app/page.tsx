'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { BoothScreen } from '@/components/BoothScreen';
import { EditorScreen } from '@/components/editor/EditorScreen';
import { GeneratingScreen } from '@/components/GeneratingScreen';
import { ResultScreen } from '@/components/ResultScreen';
import { AdminModal } from '@/components/AdminModal';
import { useBooth } from '@/lib/booth/store';

export default function PhotoboothPage() {
  const screen = useBooth((s) => s.screen);
  const go = useBooth((s) => s.go);
  const settings = useBooth((s) => s.settings);
  const setSettings = useBooth((s) => s.setSettings);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-base text-ink">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {screen === 'welcome' && <WelcomeScreen onStart={() => go('booth')} onAdminClick={() => setIsAdminOpen(true)} />}
          {screen === 'booth' && <BoothScreen />}
          {screen === 'edit' && <EditorScreen />}
          {screen === 'generating' && <GeneratingScreen />}
          {screen === 'result' && <ResultScreen />}
        </motion.div>
      </AnimatePresence>

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        defaultCountdown={settings.timer}
        defaultShots={settings.count}
        onUpdateDefaults={(timer, count) => setSettings({ timer, count })}
      />
    </div>
  );
}
