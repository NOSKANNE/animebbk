'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/game-store';
import MainMenu from '@/components/game/main-menu';
import SinglePlayer from '@/components/game/single-player';
import Multiplayer from '@/components/game/multiplayer';

export default function Home() {
  const { mode, setMode } = useGameStore();

  // Scroll to top on mode change for better UX.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [mode]);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-rose-50 via-pink-50 to-amber-50 dark:from-rose-950/30 dark:via-pink-950/20 dark:to-amber-950/20">
      {/* Top brand strip (only on menu) */}
      <AnimatePresence mode="wait">
        {mode === 'menu' ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-4 py-8"
          >
            <MainMenu onModeSelect={setMode} />
            <Footer />
          </motion.div>
        ) : mode === 'single' ? (
          <motion.div
            key="single"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex-1 flex flex-col"
          >
            <SinglePlayer onExit={() => setMode('menu')} />
            <Footer />
          </motion.div>
        ) : (
          <motion.div
            key="multiplayer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex-1 flex flex-col"
          >
            <Multiplayer onExit={() => setMode('menu')} />
            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Footer() {
  return (
    <footer className="mt-auto py-4 text-center text-[11px] text-muted-foreground">
      数据来源：Bangumi 番组计划 · 仅用于娱乐，请勿用于商业用途
    </footer>
  );
}
