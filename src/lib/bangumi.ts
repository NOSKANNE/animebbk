/**
 * Bangumi API helpers — server-side only.
 * Docs: https://bangumi.github.io/api/
 */

export interface BangumiRating {
  total: number; // total ratings count
  score: number; // average score (0-10)
  rank: number;
}

export interface BangumiSubject {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  nsfw: boolean;
  date: string; // YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD
  rating: BangumiRating;
  images: {
    large: string;
    common: string;
    medium: string;
    small: string;
    grid: string;
  };
}

export interface AnimeFilters {
  yearStart?: number;
  yearEnd?: number;
  minRatingCount?: number;
  /** Min score (1-10), default 1 — drops unrated entries */
  minScore?: number;
  /** Max score (1-10), optional */
  maxScore?: number;
}

export interface AnimeListItem {
  id: number;
  name: string;
  name_cn: string;
  date: string;
  score: number;
  rating_count: number;
  rank: number;
  cover: string; // large image URL
  summary: string;
}

// ---- In-memory cache (server-side) ---------------------------------------

interface CacheEntry {
  items: AnimeListItem[];
  expiresAt: number;
  filtersKey: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes per filter combo

function filtersKey(f: AnimeFilters): string {
  return `${f.yearStart ?? 'min'}-${f.yearEnd ?? 'max'}-${f.minRatingCount ?? 0}-${f.minScore ?? 1}-${f.maxScore ?? 'max'}`;
}

/**
 * Fetch a batch of anime from Bangumi v0 search endpoint.
 * Returns up to 50 items sorted by "heat" (popularity).
 */
async function fetchAnimeBatch(
  filters: AnimeFilters,
  size: number,
): Promise<AnimeListItem[]> {
  const airDate: string[] = [];
  if (filters.yearStart) airDate.push(`>${filters.yearStart}-01-01`);
  if (filters.yearEnd) airDate.push(`<${filters.yearEnd}-12-31`);

  // Bangumi rating filter accepts expressions like ">5", "<7"
  const ratingExpr: string[] = [`>${filters.minScore ?? 1}`];
  if (filters.maxScore) ratingExpr.push(`<${filters.maxScore}`);

  const body: Record<string, unknown> = {
    keyword: '',
    sort: 'heat',
    filter: {
      type: [2], // 2 = anime
      ...(airDate.length ? { air_date: airDate } : {}),
      rating: ratingExpr,
    },
    size: Math.min(50, Math.max(10, size)),
  };

  const res = await fetch('https://api.bgm.tv/v0/search/subjects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'anime-battle-game/1.0 (https://github.com/anime-battle)',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Bangumi API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { data?: BangumiSubject[] };
  const list = Array.isArray(data.data) ? data.data : [];

  return list
    .filter((s) => {
      if (!s.images?.large) return false;
      if (!s.rating || typeof s.rating.score !== 'number') return false;
      if (filters.minRatingCount && s.rating.total < filters.minRatingCount) {
        return false;
      }
      // Double-check score range (Bangumi's rating filter is sometimes lenient).
      const min = filters.minScore ?? 1;
      const max = filters.maxScore ?? 10;
      if (s.rating.score < min || s.rating.score > max) {
        return false;
      }
      return true;
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      name_cn: s.name_cn || s.name,
      date: s.date,
      score: s.rating.score,
      rating_count: s.rating.total,
      rank: s.rating.rank,
      cover: s.images.large,
      summary: s.summary,
    }));
}

/**
 * Fetch a pool of anime honouring the given filters.
 * Uses server-side caching keyed by the filter combo.
 */
export async function fetchAnimePool(
  filters: AnimeFilters,
): Promise<AnimeListItem[]> {
  const key = filtersKey(filters);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  // Sort by heat gives a popularity-ordered list. Combine with a "rank" sort
  // to widen the pool so less-known titles appear too.
  const [heatList, rankList] = await Promise.all([
    fetchAnimeBatch(filters, 50),
    fetchAnimeBatch(filters, 50),
  ]);

  // Dedupe by id, keep order (heat first).
  const seen = new Set<number>();
  const merged: AnimeListItem[] = [];
  for (const item of [...heatList, ...rankList]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  cache.set(key, {
    items: merged,
    expiresAt: Date.now() + CACHE_TTL_MS,
    filtersKey: key,
  });

  return merged;
}

/**
 * Pick two distinct random anime from the pool, excluding any anime
 * whose id is in `excludeIds` (previously seen in the current game).
 *
 * If the unseen subset is too small to form a pair, falls back to the full
 * pool so the game can keep going (the duplicate-prevention is best-effort
 * for narrow filter pools).
 */
export function pickRandomPair(
  pool: AnimeListItem[],
  excludeIds: number[] = [],
): AnimeListItem[] {
  if (pool.length < 2) {
    throw new Error('Not enough anime in pool for a pair');
  }

  const excludeSet = new Set(excludeIds);
  let usePool = pool.filter((a) => !excludeSet.has(a.id));
  if (usePool.length < 2) {
    // Pool exhausted — fall back to full pool (will repeat).
    usePool = pool;
  }

  const firstIdx = Math.floor(Math.random() * usePool.length);
  const first = usePool[firstIdx];
  let secondIdx = Math.floor(Math.random() * usePool.length);
  let tries = 0;
  while (secondIdx === firstIdx && tries < 10) {
    secondIdx = Math.floor(Math.random() * usePool.length);
    tries += 1;
  }
  return [first, usePool[secondIdx]];
}

/**
 * Pick a single random anime from the pool, excluding any anime whose id
 * is in `excludeIds`. Falls back to the full pool if everything has been
 * seen.
 */
export function pickSingle(
  pool: AnimeListItem[],
  excludeIds: number[] = [],
): AnimeListItem {
  if (pool.length < 1) {
    throw new Error('Pool is empty');
  }
  const excludeSet = new Set(excludeIds);
  let candidates = pool.filter((a) => !excludeSet.has(a.id));
  if (candidates.length === 0) {
    // All seen — fall back to full pool.
    candidates = pool;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
