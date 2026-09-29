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

  const handleApply = () => {
    onChange({
      yearStart: yearRange[0],
      yearEnd: yearRange[1],
      minRatingCount: minCount,
    });
    onApply();
  };

  const handleReset = () => {
    const defaults: [number, number] = [2000, CURRENT_YEAR];
    setYearRange(defaults);
    setMinCount(100);
    onChange({ yearStart: 2000, yearEnd: CURRENT_YEAR, minRatingCount: 100 });
  };

  // Build options for minRatingCount preset chips.
  const countPresets = [0, 50, 100, 500, 1000, 5000];

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
