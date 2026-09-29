import { NextRequest, NextResponse } from 'next/server';
import { fetchAnimePool, pickRandomPair, type AnimeFilters } from '@/lib/bangumi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bangumi
 * Body: AnimeFilters (yearStart, yearEnd, minRatingCount, minScore)
 * Returns: { pair: AnimeListItem[], poolSize: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AnimeFilters>;
    const filters: AnimeFilters = {
      yearStart: body.yearStart ?? undefined,
      yearEnd: body.yearEnd ?? undefined,
      minRatingCount: body.minRatingCount ?? 0,
      minScore: body.minScore ?? 1,
    };

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

    const pool = await fetchAnimePool(filters);
    if (pool.length < 2) {
      return NextResponse.json(
        {
          error:
            '当前筛选条件下没有足够的番剧数据，请放宽筛选范围（例如降低最低评分人数或扩大年份范围）',
          poolSize: pool.length,
        },
        { status: 404 },
      );
    }

    const pair = pickRandomPair(pool);
    return NextResponse.json({ pair, poolSize: pool.length });
  } catch (err) {
    console.error('[/api/bangumi] error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
