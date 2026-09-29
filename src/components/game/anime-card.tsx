'use client';

import { motion } from 'framer-motion';
import { Star, Users, Trophy, X, Check } from 'lucide-react';
import type { AnimeListItem } from '@/lib/bangumi';

interface AnimeCardProps {
  anime: AnimeListItem;
  side: 'A' | 'B';
  onPick: (id: number) => void;
  revealed?: boolean;
  isWinner?: boolean;
  isPicked?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export default function AnimeCard({
  anime,
  side,
  onPick,
  revealed = false,
  isWinner = false,
  isPicked = false,
  disabled = false,
  loading = false,
}: AnimeCardProps) {
  const displayName = anime.name_cn || anime.name || '未知番剧';
  const shortDate = anime.date ? anime.date.slice(0, 7) : '—';
  const scoreDisplay = anime.score ? anime.score.toFixed(1) : '—';

  return (
    <motion.button
      type="button"
      onClick={() => !disabled && !revealed && onPick(anime.id)}
      disabled={disabled || revealed}
      whileHover={
        disabled || revealed ? undefined : { y: -4, scale: 1.02 }
      }
      whileTap={disabled || revealed ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="group relative text-left w-full rounded-2xl overflow-hidden bg-card border border-rose-200/70 dark:border-rose-900/40 shadow-sm hover:shadow-xl hover:shadow-rose-200/40 dark:hover:shadow-rose-900/30 transition-shadow"
      aria-label={`选择 ${displayName}`}
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {loading ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-rose-100 to-pink-200 dark:from-rose-950 dark:to-rose-900" />
        ) : (
          <img
            src={anime.cover}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Side label */}
        <div className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded-full bg-black/60 text-white backdrop-blur-sm">
          {side}
        </div>

        {/* Rating count badge — shown only after reveal (otherwise it's a popularity hint) */}
        {revealed && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-black/60 text-white shadow backdrop-blur-sm">
            <Users className="w-3 h-3" />
            <span className="tabular-nums">{anime.rating_count.toLocaleString()}</span>
          </div>
        )}

        {/* Reveal overlay */}
        {revealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                isWinner && isPicked
                  ? 'rgba(16,185,129,0.45)'
                  : !isWinner && isPicked
                    ? 'rgba(239,68,68,0.55)'
                    : isWinner
                      ? 'rgba(16,185,129,0.25)'
                      : 'rgba(0,0,0,0.55)',
            }}
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.05 }}
              className="flex flex-col items-center gap-1 text-white"
            >
              {isPicked && isWinner && (
                <>
                  <Check className="w-12 h-12" strokeWidth={3} />
                  <span className="text-sm font-bold">答对！</span>
                </>
              )}
              {isPicked && !isWinner && (
                <>
                  <X className="w-12 h-12" strokeWidth={3} />
                  <span className="text-sm font-bold">答错</span>
                </>
              )}
              {!isPicked && isWinner && (
                <>
                  <Trophy className="w-10 h-10" strokeWidth={2.5} />
                  <span className="text-xs font-bold">正确答案</span>
                </>
              )}
              {!isPicked && !isWinner && (
                <X className="w-10 h-10 opacity-70" strokeWidth={2.5} />
              )}
              {/* Big score display after reveal */}
              <div className="mt-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white">
                <Star className="w-3 h-3 fill-current" />
                <span className="tabular-nums text-base font-extrabold">
                  {scoreDisplay}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Meta */}
      <div className="p-3 space-y-1">
        <h4 className="text-sm font-semibold line-clamp-2 leading-tight">
          {displayName}
        </h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{shortDate}</span>
          {revealed ? (
            <span className="flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              <span className="tabular-nums">
                {anime.rating_count.toLocaleString()}
              </span>
            </span>
          ) : (
            <span className="italic text-muted-foreground/70">猜猜看？</span>
          )}
        </div>
        {revealed && (
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 pt-0.5">
            评分 {scoreDisplay} · 排名 #{anime.rank || '—'}
          </div>
        )}
      </div>
    </motion.button>
  );
}
