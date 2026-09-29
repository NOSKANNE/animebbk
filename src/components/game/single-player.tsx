'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Flame, Trophy, Loader2, RefreshCw, Star } from 'lucide-react';
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

export default function SinglePlayer({ onExit }: SinglePlayerProps) {
  const {
    filters,
    setFilters,
    round,
    totalRounds,
    score,
    streak,
    bestStreak,
    currentPair,
    aIsCarryOver,
    loadingPair,
    showResult,
    lastResult,
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
    if (round === 0 && !currentPair && !loadingPair && !showResult) {
      handleStart();
    }
  }, [handleStart]);

  const handleNext = () => {
    if (round >= totalRounds) return;
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

  // ---- Finished view ----------------------------------------------
  if (round >= totalRounds && !currentPair) {
    const maxScore = 10 * totalRounds + 9 * 2; // approx
    const percent = Math.min(100, (score / maxScore) * 100);
    let verdict = '还需努力！';
    let verdictColor = 'text-rose-600';
    if (score >= 100) {
      verdict = '神级判断力！';
      verdictColor = 'text-amber-500';
    } else if (score >= 70) {
      verdict = '老练的番剧迷';
      verdictColor = 'text-rose-500';
    } else if (score >= 40) {
      verdict = '不错的眼力';
      verdictColor = 'text-pink-500';
    }

    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <Card className="overflow-hidden border-amber-200 dark:border-amber-900/40">
          <div className="bg-gradient-to-br from-amber-500 via-rose-500 to-pink-600 p-8 text-center text-white">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <Trophy className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
              <p className="text-sm uppercase tracking-wider opacity-90">
                本局结果
              </p>
              <h2 className="mt-1 text-5xl font-extrabold tabular-nums drop-shadow">
                {score}
              </h2>
              <p className="mt-1 text-sm opacity-90">/ 满分约 {maxScore}</p>
              <p className={`mt-3 text-lg font-bold ${verdictColor}`}>
                {verdict}
              </p>
            </motion.div>
          </div>
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>得分进度</span>
                <span>{percent.toFixed(0)}%</span>
              </div>
              <Progress value={percent} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">最高连击</div>
                <div className="text-2xl font-bold tabular-nums flex items-center justify-center gap-1">
                  <Flame className="w-5 h-5 text-orange-500" />
                  {bestStreak}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">完成题数</div>
                <div className="text-2xl font-bold tabular-nums">
                  {totalRounds}
                </div>
              </div>
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
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="font-bold tabular-nums">{score}</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200">
              <Flame className="w-3.5 h-3.5" />
              <span className="font-bold tabular-nums">x{streak}</span>
            </div>
          )}
          <div className="text-muted-foreground text-xs">
            第 <span className="font-bold text-foreground">{round}</span> /{' '}
            {totalRounds} 题
          </div>
        </div>
      </div>

      {/* Progress */}
      <Progress value={(round / totalRounds) * 100} className="h-1" />

      {/* Filter bar */}
      <FilterBar
        key={`${filters.yearStart}-${filters.yearEnd}-${filters.minRatingCount}`}
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
                    ? 'border-green-300 bg-green-50/60 dark:bg-green-950/20 dark:border-green-800/40'
                    : 'border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40'
                }
              >
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p
                      className={
                        'text-sm font-bold ' +
                        (lastResult.correct
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300')
                      }
                    >
                      {lastResult.correct
                        ? '🎉 答对了！'
                        : '差一点，再接再厉'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      正确答案：
                      <span className="font-medium">
                        {lastResult.correctId === lastResult.animeA.id
                          ? lastResult.animeA.name_cn ||
                            lastResult.animeA.name
                          : lastResult.animeB.name_cn ||
                            lastResult.animeB.name}
                      </span>
                      {'  '}
                      评分{' '}
                      {(lastResult.correctId === lastResult.animeA.id
                        ? lastResult.animeA.score
                        : lastResult.animeB.score
                      ).toFixed(1)}
                    </p>
                  </div>
                  <Button
                    onClick={handleNext}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    size="sm"
                  >
                    {round >= totalRounds ? '查看战绩' : '下一题'}
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
