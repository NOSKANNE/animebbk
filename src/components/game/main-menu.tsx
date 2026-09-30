'use client';

import { motion } from 'framer-motion';
import { User, Users, Sparkles, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameMode } from '@/lib/game-store';

interface MainMenuProps {
  onModeSelect: (mode: GameMode) => void;
}

export default function MainMenu({ onModeSelect }: MainMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center text-center py-6 px-4"
    >
      {/* Logo / title */}
      <motion.div
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.05 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 text-xs font-medium mb-4"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Powered by Bangumi
      </motion.div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 bg-clip-text text-transparent">
        番剧评分对战
      </h1>
      <p className="mt-3 max-w-xl text-sm sm:text-base text-muted-foreground">
        随机抽取两部番剧的封面，挑战你的眼力——选出 Bangumi 评分更高的一部！单人血量制生存赛 + 好友联机对战，支持年份 / 评分区间 / 评分人数筛选。
      </p>

      {/* Mode cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        <motion.button
          type="button"
          onClick={() => onModeSelect('single')}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          className="group relative overflow-hidden rounded-2xl p-6 text-left bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200/60 dark:shadow-rose-900/30"
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform" />
          <User className="w-8 h-8 mb-3" />
          <h3 className="text-xl font-bold">单人挑战</h3>
          <p className="mt-1 text-sm text-rose-50/90">
            3 滴血生存赛，连对 10 题回 1 血，看你能撑多少关。
          </p>
          <div className="mt-4 text-xs font-medium opacity-90 flex items-center gap-1">
            开始游戏 →
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onModeSelect('multiplayer')}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          className="group relative overflow-hidden rounded-2xl p-6 text-left bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-200/60 dark:shadow-amber-900/30"
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform" />
          <Users className="w-8 h-8 mb-3" />
          <h3 className="text-xl font-bold">多人联机</h3>
          <p className="mt-1 text-sm text-amber-50/90">
            与好友进入同一房间，比拼谁能更快选出评分更高的番剧。
          </p>
          <div className="mt-4 text-xs font-medium opacity-90 flex items-center gap-1">
            进入大厅 →
          </div>
        </motion.button>
      </div>

      {/* How to play */}
      <div className="mt-8 w-full max-w-2xl rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10 p-4">
        <div className="flex items-center gap-2 mb-2 text-rose-700 dark:text-rose-200">
          <BarChart3 className="w-4 h-4" />
          <h4 className="text-sm font-semibold">玩法说明</h4>
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>第 1 题随机抽取两部番剧的封面与基本信息（评分在揭晓前完全隐藏）。</li>
          <li>第 2 题起进入链式模式：上题的 B 变为新的 A，再抽一个新 B；A 角落会显示「上题B」标识。</li>
          <li>单人模式为血量制：初始 3 滴血，答错扣 1 滴，血量耗尽即结束。</li>
          <li>每连对 10 题可回复 1 滴血（不超出上限）；正确还额外得 +10 分（连击加成）。</li>
          <li>可调整筛选：年份范围 / Bangumi 评分区间 / 最低评分人数。</li>
          <li>多人模式仍为 10 题，双方实时对战，先得高分者胜。</li>
        </ol>
      </div>
    </motion.div>
  );
}
