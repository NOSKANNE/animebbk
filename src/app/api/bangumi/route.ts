import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAnimePool,
  pickRandomPair,
  pickSingle,
  type AnimeFilters,
  type AnimeListItem,
} from '@/lib/bangumi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bangumi
 * Body: AnimeFilters & { count?: 1 | 2 }
 *   - count = 1 (default 2 if omitted):
 *     Returns { anime: AnimeListItem, poolSize: number }
 *     Optionally accepts `excludeId` to avoid returning the same anime twice
 *     (used by chain mode: fetch a fresh B different from the previous B).
 *   - count = 2 (default):
 *     Returns { pair: AnimeListItem[], poolSize: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<
      AnimeFilters & { count?: number; excludeId?: number }
    >;
    const filters: AnimeFilters = {
      yearStart: body.yearStart ?? undefined,
      yearEnd: body.yearEnd ?? undefined,
      minRatingCount: body.minRatingCount ?? 0,
      minScore: body.minScore ?? 1,
      maxScore: body.maxScore ?? undefined,
    };
    const count = body.count === 1 ? 1 : 2;

    // Validate ranges.
    if (
      filters.yearStart &&
      filters.yearEnd &&
      filters.yearStart > filters.yearEnd
    ) {
      return NextResponse.json(
        { error: 'yearStart must be <= yearEnd' },
        { status: 400 },
      );
    }
    if (
      filters.minScore !== undefined &&
      filters.maxScore !== undefined &&
      filters.minScore > filters.maxScore
    ) {
      return NextResponse.json(
        { error: 'minScore must be <= maxScore' },
        { status: 400 },
      );
    }

    const pool = await fetchAnimePool(filters);
    if (count === 2) {
      if (pool.length < 2) {
        return NextResponse.json(
          {
            error:
              '当前筛选条件下没有足够的番剧数据，请放宽筛选范围（例如降低评分人数下限或扩大评分/年份范围）',
            poolSize: pool.length,
          },
          { status: 404 },
        );
      }
      const pair = pickRandomPair(pool);
      return NextResponse.json({ pair, poolSize: pool.length });
    } else {
      if (pool.length < 1) {
        return NextResponse.json(
          {
            error: '当前筛选条件下没有可用的番剧，请放宽筛选范围',
            poolSize: 0,
          },
          { status: 404 },
        );
      }
      const anime = pickSingle(pool, body.excludeId);
      return NextResponse.json({ anime, poolSize: pool.length });
    }
  } catch (err) {
    console.error('[/api/bangumi] error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Also expose the type for downstream typing convenience.
export type { AnimeListItem };
