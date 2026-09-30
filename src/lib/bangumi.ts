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
  platform: string; // 'TV' | 'OVA' | '剧场版' | 'WEB' | '其他'
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
  /**
   * Anime platforms to include. Empty/undefined = all.
   * Valid values: 'TV', 'OVA', '剧场版', 'WEB', '其他'.
   */
  platforms?: string[];
}

export interface AnimeListItem {
  id: number;
  name: string;
  name_cn: string;
  date: string;
  score: number;
  rating_count: number;
  rank: number;
  platform: string; // 'TV' | 'OVA' | '剧场版' | 'WEB' | '其他'
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
  return `${f.yearStart ?? 'min'}-${f.yearEnd ?? 'max'}-${f.minRatingCount ?? 0}-${f.minScore ?? 1}-${f.maxScore ?? 'max'}-${(f.platforms ?? []).slice().sort().join(',')}`;
}

/**
 * Fetch a batch of anime from Bangumi v0 search endpoint.
 * Bangumi only returns ~10 items per request when no keyword is given,
 * regardless of `size`. To get a diverse pool we therefore fire multiple
 * batches with different `sort` strategies and `air_date` windows.
 *
 * `sort` values per Bangumi docs:
 *   - "heat"   → by popularity (collection count) — high-rated popular shows
 *   - "rank"   → by rank (lower rank = lower score) — low-rated / obscure shows
 *   - "match"  → default relevance — a mix
 *   - "score"  → by score (highest first)
 */
async function fetchAnimeBatch(
  filters: AnimeFilters,
  sort: 'heat' | 'rank' | 'match' | 'score',
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
    sort,
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

  // Bangumi v0 search doesn't actually honour a `platform` filter (only
  // type/tag/air_date/rating/rank/nsfw are supported). We filter platforms
  // ourselves after the fetch.
  const platformSet =
    filters.platforms && filters.platforms.length > 0
      ? new Set(filters.platforms)
      : null;

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
      // Apply our own platform filter (Bangumi API ignores it).
      if (platformSet && !platformSet.has(s.platform)) {
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
      platform: s.platform,
      cover: s.images.large,
      summary: s.summary,
    }));
}

/**
 * Split a year range [start, end] into contiguous buckets of `bucketSize` years.
 * Returns at most `maxBuckets` buckets.
 */
function splitYearRange(
  start: number,
  end: number,
  bucketSize: number,
  maxBuckets: number,
): Array<[number, number]> {
  if (start > end) return [];
  const buckets: Array<[number, number]> = [];
  for (let y = start; y <= end && buckets.length < maxBuckets; y += bucketSize) {
    buckets.push([y, Math.min(y + bucketSize - 1, end)]);
  }
  return buckets;
}

/**
 * Fetch a pool of anime honouring the given filters.
 *
 * Bangumi's search endpoint caps the response at ~10 items per call when no
 * keyword is provided. To get a diverse pool (including low-rated anime when
 * the user sets a wide score range), we split the year range into 3-year
 * buckets and fetch each bucket with three different `sort` strategies
 * (`heat` for popular high-rated, `rank` for low-ranked, `match` for a mix).
 * This typically yields 30–150 unique items spanning the full score range.
 */
export async function fetchAnimePool(
  filters: AnimeFilters,
): Promise<AnimeListItem[]> {
  const key = filtersKey(filters);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const yearStart = filters.yearStart ?? 2000;
  const yearEnd = filters.yearEnd ?? new Date().getFullYear();

  // Split the user's year range into 3-year buckets, capped at 10 buckets
  // to keep request count reasonable (~30 parallel fetches max).
  const buckets = splitYearRange(yearStart, yearEnd, 3, 10);
  const sorts: Array<'heat' | 'rank' | 'match'> = ['heat', 'rank', 'match'];

  // Fire all bucket × sort combos in parallel.
  const fetches: Promise<AnimeListItem[]>[] = [];
  for (const [ys, ye] of buckets.length > 0 ? buckets : [[yearStart, yearEnd]]) {
    for (const sort of sorts) {
      fetches.push(
        fetchAnimeBatch(
          { ...filters, yearStart: ys, yearEnd: ye },
          sort,
          50,
        ),
      );
    }
  }
  const results = await Promise.all(fetches);

  // Merge + dedupe by id. The fetchAnimeBatch already filtered by score range,
  // so we just need to dedupe.
  const seen = new Set<number>();
  const merged: AnimeListItem[] = [];
  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
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
