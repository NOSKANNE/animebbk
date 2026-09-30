'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, RotateCcw } from 'lucide-react';
import type { AnimeFilters } from '@/lib/game-store';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1960;

// All valid Bangumi anime platforms. Order matters for UI display.
const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'TV', label: 'TV' },
  { value: 'OVA', label: 'OVA' },
  { value: '剧场版', label: '剧场版' },
  { value: 'WEB', label: 'WEB' },
  { value: '其他', label: '其他' },
];

interface FilterBarProps {
  filters: AnimeFilters;
  onChange: (f: AnimeFilters) => void;
  onApply: () => void;
  disabled?: boolean;
}

export default function FilterBar({
  filters,
  onChange,
  onApply,
  disabled,
}: FilterBarProps) {
  // Local state initialized once from props. The parent uses the `key` prop
  // to force a remount (and thus re-init) whenever it wants to override the
  // internal state from outside.
  const [yearRange, setYearRange] = useState<[number, number]>([
    filters.yearStart ?? 2000,
    filters.yearEnd ?? CURRENT_YEAR,
  ]);
  const [minCount, setMinCount] = useState<number>(
    filters.minRatingCount ?? 100,
  );
  const [scoreRange, setScoreRange] = useState<[number, number]>([
    filters.minScore ?? 1,
    filters.maxScore ?? 10,
  ]);
  const [platforms, setPlatforms] = useState<string[]>(
    filters.platforms ?? [],
  );

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleApply = () => {
    onChange({
      yearStart: yearRange[0],
      yearEnd: yearRange[1],
      minRatingCount: minCount,
      minScore: scoreRange[0],
      maxScore: scoreRange[1],
      platforms,
    });
    onApply();
  };

  const handleReset = () => {
    const defaultYears: [number, number] = [2000, CURRENT_YEAR];
    const defaultScores: [number, number] = [1, 10];
    setYearRange(defaultYears);
    setMinCount(100);
    setScoreRange(defaultScores);
    setPlatforms([]);
    onChange({
      yearStart: 2000,
      yearEnd: CURRENT_YEAR,
      minRatingCount: 100,
      minScore: 1,
      maxScore: 10,
      platforms: [],
    });
  };

  // Build options for minRatingCount preset chips.
  const countPresets = [0, 50, 100, 500, 1000, 5000];

  // Score preset chips for quick selection
  const scorePresets: { label: string; range: [number, number] }[] = [
    { label: '全部', range: [1, 10] },
    { label: '低分', range: [1, 5] },
    { label: '中分', range: [5, 7] },
    { label: '高分', range: [7, 9] },
    { label: '神作', range: [9, 10] },
  ];

  const isPresetActive = (preset: [number, number]) =>
    scoreRange[0] === preset[0] && scoreRange[1] === preset[1];

  return (
    <Card className="border-rose-200/60 bg-rose-50/40 dark:bg-rose-950/10 dark:border-rose-900/40">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">
            筛选条件
          </h3>
          <span className="text-xs text-rose-700/70 dark:text-rose-300/70">
            调整后将重新加载番剧池
          </span>
        </div>

        {/* Year range slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">播出年份</Label>
            <span className="text-xs font-medium tabular-nums text-rose-700 dark:text-rose-200">
              {yearRange[0]} — {yearRange[1]}
            </span>
          </div>
          <Slider
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            step={1}
            value={yearRange}
            onValueChange={(v) =>
              Array.isArray(v) &&
              v.length === 2 &&
              setYearRange([v[0], v[1]])
            }
            disabled={disabled}
            minStepsBetweenThumbs={1}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{MIN_YEAR}</span>
            <span>{CURRENT_YEAR}</span>
          </div>
        </div>

        {/* Score range slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Bangumi 评分区间
            </Label>
            <span className="text-xs font-medium tabular-nums text-amber-700 dark:text-amber-200">
              {scoreRange[0].toFixed(1)} — {scoreRange[1].toFixed(1)}
            </span>
          </div>
          <Slider
            min={1}
            max={10}
            step={1}
            value={scoreRange}
            onValueChange={(v) =>
              Array.isArray(v) &&
              v.length === 2 &&
              setScoreRange([v[0], v[1]])
            }
            disabled={disabled}
            minStepsBetweenThumbs={1}
            className="py-1"
          />
          <div className="flex flex-wrap gap-1.5">
            {scorePresets.map((p) => {
              const active = isPresetActive(p.range);
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => setScoreRange(p.range)}
                  className={
                    'px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50 ' +
                    (active
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white dark:bg-transparent text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30')
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            选择「低分」区间可挑战评分较低的冷门作品；区间越窄，番剧池越小，重题概率上升。
          </p>
        </div>

        {/* Anime platforms (multi-select chips) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">番剧类型</Label>
            <span className="text-xs font-medium text-purple-700 dark:text-purple-200">
              {platforms.length === 0
                ? '全部'
                : `已选 ${platforms.length} 种`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map((p) => {
              const active = platforms.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePlatform(p.value)}
                  className={
                    'px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50 ' +
                    (active
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-transparent text-purple-700 dark:text-purple-200 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30')
                  }
                >
                  {active ? '✓ ' : ''}
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            可多选。不选 = 不限；选「剧场版」可挑战新海诚系列，选「OVA」会看到不少独立作品。
          </p>
        </div>

        {/* Minimum rating count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              最低评分人数
            </Label>
            <span className="text-xs font-medium tabular-nums text-rose-700 dark:text-rose-200">
              ≥ {minCount.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {countPresets.map((p) => {
              const active = minCount === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMinCount(p)}
                  className={
                    'px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50 ' +
                    (active
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white dark:bg-transparent text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30')
                  }
                >
                  {p === 0 ? '不限' : `≥ ${p}`}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            数值越高，番剧越主流、评分越稳定；数值为 0 表示不限，可能包含冷门作品。
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApply}
            disabled={disabled}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            应用筛选
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={disabled}
            className="text-rose-700 dark:text-rose-200"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            重置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
