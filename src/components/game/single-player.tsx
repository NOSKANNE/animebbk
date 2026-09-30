'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Flame,
  Heart,
  HeartCrack,
  Loader2,
  RefreshCw,
  Star,
  Skull,
  Plus,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import FilterBar from './filter-bar';
import AnimeCard from './anime-card';
import { useGameStore } from '@/lib/game-store';
import { toast } from 'sonner';

interface SinglePlayerProps {
  onExit: () => void;
}

const HEAL_THRESHOLD = 10;

export default function SinglePlayer({ onExit }: SinglePlayerProps) {
  const {
    filters,
    setFilters,
    round,
    score,
    streak,
    bestStreak,
    hp,
    maxHp,
    correctCount,
    wrongCount,
    correctSinceLastHeal,
    currentPair,
    aIsCarryOver,
    loadingPair,
    showResult,
    lastResult,
    gameOver,
    startGame,
    loadNextPair,
    pick,
    resetGame,
  } = useGameStore();

  const handleStart = useCallback(() => {
    startGame();
    void loadNextPair().catch((err) => {
      toast.error(err.message || '加载番剧失败，请调整筛选条件');
    });
  }, [startGame, loadNextPair]);

  // Auto-start when component mounts.
  useEffect(() => {
    if (
      round === 0 &&
      !currentPair &&
      !loadingPair &&
      !showResult &&
      !gameOver
    ) {
      handleStart();
    }
  }, [handleStart]);

  const handleNext = () => {
    void loadNextPair().catch((err) => {
      toast.error(err.message || '加载下一题失败');
    });
  };

  const handlePick = (id: number) => {
    pick(id);
  };

  const handleRestart = () => {
    resetGame();
    handleStart();
  };

  const handleApplyFilters = () => {
    resetGame();
    handleStart();
  };

  // ---- Game over view ---------------------------------------------
  if (gameOver && !currentPair) {
    const accuracy =
      correctCount + wrongCount > 0
        ? (correctCount / (correctCount + wrongCount)) * 100
        : 0;
    let verdict = '初出茅庐';
    let verdictColor = 'text-rose-300';
    if (round >= 30) {
      verdict = '番剧鉴赏大师！';
      verdictColor = 'text-amber-300';
    } else if (round >= 20) {
      verdict = '资深老饕';
      verdictColor = 'text-amber-200';
    } else if (round >= 10) {
      verdict = '不错的眼力';
      verdictColor = 'text-rose-200';
    } else if (round >= 5) {
      verdict = '渐入佳境';
      verdictColor = 'text-rose-200';
    }

    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <Card className="overflow-hidden border-rose-300 dark:border-rose-900/60">
          <div className="bg-gradient-to-br from-rose-700 via-red-700 to-rose-900 p-8 text-center text-white">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <Skull className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
              <p className="text-sm uppercase tracking-wider opacity-90">
                血量耗尽
              </p>
              <h2 className="mt-1 text-3xl font-extrabold drop-shadow">
                本局结束
              </h2>
              <p className={`mt-3 text-xl font-bold ${verdictColor}`}>
                {verdict}
              </p>
            </motion.div>
          </div>
          <CardContent className="p-6 space-y-4">
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 p-4">
                <div className="text-xs text-muted-foreground">存活题数</div>
                <div className="mt-1 text-3xl font-extrabold tabular-nums text-rose-600 dark:text-rose-300">
                  {round}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="text-xs text-muted-foreground">总得分</div>
                <div className="mt-1 text-3xl font-extrabold tabular-nums text-amber-600 dark:text-amber-300 flex items-center justify-center gap-1">
                  <Star className="w-5 h-5 fill-current" />
                  {score}
                </div>
              </div>
            </div>

            {/* Detailed stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-2">
                <div className="text-muted-foreground">答对</div>
                <div className="text-base font-bold text-green-700 dark:text-green-300 tabular-nums">
                  {correctCount}
                </div>
              </div>
              <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-2">
                <div className="text-muted-foreground">答错</div>
                <div className="text-base font-bold text-red-700 dark:text-red-300 tabular-nums">
                  {wrongCount}
                </div>
              </div>
              <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 p-2">
                <div className="text-muted-foreground">最高连击</div>
                <div className="text-base font-bold text-orange-700 dark:text-orange-300 tabular-nums flex items-center justify-center gap-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  {bestStreak}
                </div>
              </div>
            </div>

            {/* Accuracy */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>答题准确率</span>
                <span className="tabular-nums">{accuracy.toFixed(0)}%</span>
              </div>
              <Progress value={accuracy} className="h-2" />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRestart}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                再来一局
              </Button>
              <Button variant="outline" onClick={onExit} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回主菜单
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Playing view -----------------------------------------------
  // HP bar fill: 0..maxHp
  const hpPercent = (hp / maxHp) * 100;
  const healProgress = (correctSinceLastHeal / HEAL_THRESHOLD) * 100;
  const hpLow = hp <= 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          退出
        </Button>
        <div className="flex items-center gap-2 text-sm">
          {/* Score chip */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="font-bold tabular-nums">{score}</span>
          </div>
          {/* Streak chip */}
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200">
              <Flame className="w-3.5 h-3.5" />
              <span className="font-bold tabular-nums">x{streak}</span>
            </div>
          )}
          {/* Round counter (no total) */}
          <div className="text-muted-foreground text-xs">
            第 <span className="font-bold text-foreground">{round}</span> 题
          </div>
        </div>
      </div>

      {/* HP bar with hearts */}
      <div
        className={
          'rounded-xl p-3 border transition-colors ' +
          (hpLow
            ? 'border-red-300 bg-red-50/80 dark:bg-red-950/30 dark:border-red-800/60'
            : 'border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 dark:border-rose-800/40')
        }
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-200">
            <Activity className="w-3.5 h-3.5" />
            血量
          </div>
          {/* Heart icons row */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: maxHp }).map((_, i) => {
              const filled = i < hp;
              return filled ? (
                <motion.span
                  key={i}
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  className="inline-flex"
                >
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500 drop-shadow" />
                </motion.span>
              ) : (
                <HeartCrack
                  key={i}
                  className="w-5 h-5 text-rose-300 dark:text-rose-700/60"
                />
              );
            })}
          </div>
        </div>
        <Progress
          value={hpPercent}
          className={
            'h-1.5 ' +
            (hpLow
              ? '[&_[data-slot=progress-indicator]]:bg-red-500'
              : '[&_[data-slot=progress-indicator]]:bg-rose-500')
          }
        />
        {/* Heal progress sub-bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>连对回血进度</span>
              <span className="tabular-nums">
                {correctSinceLastHeal} / {HEAL_THRESHOLD}
              </span>
            </div>
            <Progress value={healProgress} className="h-1" />
          </div>
          {correctSinceLastHeal >= HEAL_THRESHOLD - 1 && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
              即将回血！
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        key={`${filters.yearStart}-${filters.yearEnd}-${filters.minRatingCount}-${filters.minScore}-${filters.maxScore}-${(filters.platforms ?? []).join(',')}`}
        filters={filters}
        onChange={setFilters}
        onApply={handleApplyFilters}
        disabled={loadingPair}
      />

      {/* Game arena */}
      <div className="relative">
        {loadingPair ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-3" />
            <p className="text-sm">正在抽取番剧……</p>
          </div>
        ) : currentPair && currentPair.length === 2 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 max-w-3xl mx-auto">
            <AnimeCard
              anime={currentPair[0]}
              side="A"
              onPick={handlePick}
              revealed={showResult}
              isWinner={lastResult?.correctId === currentPair[0].id}
              isPicked={lastResult?.pickedId === currentPair[0].id}
              isCarryOver={aIsCarryOver}
            />
            <AnimeCard
              anime={currentPair[1]}
              side="B"
              onPick={handlePick}
              revealed={showResult}
              isWinner={lastResult?.correctId === currentPair[1].id}
              isPicked={lastResult?.pickedId === currentPair[1].id}
            />

            {/* VS divider */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-card border-2 border-rose-500 dark:border-rose-400 shadow-lg flex items-center justify-center">
                <span className="text-rose-600 dark:text-rose-300 font-extrabold text-sm sm:text-base">
                  VS
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-muted-foreground">
            <p>暂无可用番剧，请调整筛选条件</p>
          </div>
        )}

        {/* Result overlay banner */}
        <AnimatePresence>
          {showResult && lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 max-w-3xl mx-auto"
            >
              <Card
                className={
                  lastResult.correct
                    ? lastResult.healed
                      ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20 dark:border-emerald-800/40'
                      : 'border-green-300 bg-green-50/60 dark:bg-green-950/20 dark:border-green-800/40'
                    : 'border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40'
                }
              >
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    {/* Headline */}
                    <div className="flex items-center gap-2">
                      <p
                        className={
                          'text-sm font-bold ' +
                          (lastResult.correct
                            ? lastResult.healed
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-green-700 dark:text-green-300'
                            : 'text-red-700 dark:text-red-300')
                        }
                      >
                        {lastResult.correct
                          ? lastResult.healed
                            ? '答对 + 回血！'
                            : '答对了！'
                          : '答错了，扣 1 滴血'}
                      </p>
                      {/* HP delta chip */}
                      <span
                        className={
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold rounded-full tabular-nums ' +
                          (lastResult.hpDelta > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : lastResult.hpDelta < 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
                              : 'bg-muted text-muted-foreground')
                        }
                      >
                        {lastResult.hpDelta > 0 ? (
                          <>
                            <Plus className="w-3 h-3" />
                            <Heart className="w-3 h-3 fill-current" />
                            1
                          </>
                        ) : lastResult.hpDelta < 0 ? (
                          <>
                            <HeartCrack className="w-3 h-3" />
                            1
                          </>
                        ) : null}
                      </span>
                      {/* Score chip (only on correct) */}
                      {lastResult.scoreDelta > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 tabular-nums">
                          <Star className="w-3 h-3 fill-current" />
                          +{lastResult.scoreDelta}
                        </span>
                      )}
                    </div>
                    {/* Sub-line: correct answer + remaining HP */}
                    <p className="text-xs text-muted-foreground">
                      正确答案：
                      <span className="font-medium">
                        {lastResult.correctId === lastResult.animeA.id
                          ? lastResult.animeA.name_cn ||
                            lastResult.animeA.name
                          : lastResult.animeB.name_cn ||
                            lastResult.animeB.name}
                      </span>
                      {'  '}评分{' '}
                      {(lastResult.correctId === lastResult.animeA.id
                        ? lastResult.animeA.score
                        : lastResult.animeB.score
                      ).toFixed(1)}
                      {lastResult.healed && (
                        <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          · 连对 {HEAL_THRESHOLD} 题，恢复 1 滴血！
                        </span>
                      )}
                      {!lastResult.correct && hp > 0 && (
                        <span className="ml-1 text-red-600 dark:text-red-400 font-medium">
                          · 剩余 {hp} 滴血
                        </span>
                      )}
                      {!lastResult.correct && hp <= 0 && (
                        <span className="ml-1 text-red-700 dark:text-red-300 font-bold">
                          · 血量耗尽，本局结束
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleNext}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    size="sm"
                  >
                    {hp <= 0 ? '查看战绩' : '下一题'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
