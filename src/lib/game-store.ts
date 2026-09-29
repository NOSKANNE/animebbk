'use client';

import { create } from 'zustand';
import type { AnimeListItem } from './bangumi';

export type GameMode = 'menu' | 'single' | 'multiplayer';

export interface AnimeFilters {
  yearStart?: number;
  yearEnd?: number;
  minRatingCount?: number;
  minScore?: number;
  maxScore?: number;
}

export interface RoundResult {
  animeA: AnimeListItem;
  animeB: AnimeListItem;
  correctId: number; // the higher-rated one's id
  pickedId?: number; // what the local player chose
  correct: boolean;
  /** True if animeA was carried over from the previous round's B (chain mode). */
  aIsCarryOver: boolean;
}

interface GameState {
  // navigation
  mode: GameMode;
  setMode: (m: GameMode) => void;

  // filters
  filters: AnimeFilters;
  setFilters: (f: AnimeFilters) => void;

  // single-player state
  round: number;
  totalRounds: number;
  score: number;
  streak: number;
  bestStreak: number;
  currentPair: AnimeListItem[] | null;
  /** True if currentPair[0] is carried over from the previous B (chain mode). */
  aIsCarryOver: boolean;
  loadingPair: boolean;
  lastResult: RoundResult | null;
  showResult: boolean;

  // actions
  startGame: () => void;
  loadNextPair: () => Promise<void>;
  pick: (animeId: number) => void;
  resetGame: () => void;
  finishGame: () => void;
}

const DEFAULT_FILTERS: AnimeFilters = {
  yearStart: 2000,
  yearEnd: new Date().getFullYear(),
  minRatingCount: 100,
  minScore: 1,
  maxScore: 10,
};

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'menu',
  setMode: (m) => set({ mode: m }),

  filters: DEFAULT_FILTERS,
  setFilters: (f) => set({ filters: f }),

  round: 0,
  totalRounds: 10,
  score: 0,
  streak: 0,
  bestStreak: 0,
  currentPair: null,
  aIsCarryOver: false,
  loadingPair: false,
  lastResult: null,
  showResult: false,

  startGame: () => {
    set({
      round: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      lastResult: null,
      showResult: false,
      currentPair: null,
      aIsCarryOver: false,
    });
  },

  /**
   * Chain mode: round 1 fetches a fresh pair. Round >1 carries the previous
   * B (currentPair[1]) over to become the new A, then fetches a single new
   * anime to fill the B slot.
   */
  loadNextPair: async () => {
    const { filters, round, totalRounds, currentPair } = get();
    if (round >= totalRounds) {
      set({ showResult: false, currentPair: null });
      return;
    }

    const isFirstRound = round === 0 || !currentPair;

    set({ loadingPair: true, showResult: false, lastResult: null });

    try {
      if (isFirstRound) {
        const res = await fetch('/api/bangumi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...filters, count: 2 }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          pair: AnimeListItem[];
          poolSize: number;
        };
        set({
          currentPair: data.pair,
          aIsCarryOver: false,
          loadingPair: false,
          round: get().round + 1,
          showResult: false,
          lastResult: null,
        });
      } else {
        // Carry previous B → new A. Exclude previous B's id so the new B
        // is a different anime.
        const previousB = currentPair[1];
        const res = await fetch('/api/bangumi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...filters,
            count: 1,
            excludeId: previousB.id,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          anime: AnimeListItem;
          poolSize: number;
        };
        set({
          currentPair: [previousB, data.anime],
          aIsCarryOver: true,
          loadingPair: false,
          round: get().round + 1,
          showResult: false,
          lastResult: null,
        });
      }
    } catch (err) {
      console.error('[loadNextPair] failed', err);
      set({ loadingPair: false });
      throw err;
    }
  },

  pick: (animeId) => {
    const state = get();
    const pair = state.currentPair;
    if (!pair || state.showResult) return;

    const [a, b] = pair;
    const correctId =
      a.score > b.score ? a.id : b.score > a.score ? b.id : animeId;
    const correct = animeId === correctId;

    const nextStreak = correct ? state.streak + 1 : 0;
    const nextBest = Math.max(state.bestStreak, nextStreak);
    const delta = correct ? 10 + Math.max(0, (nextStreak - 1) * 2) : -3;

    set({
      showResult: true,
      lastResult: {
        animeA: a,
        animeB: b,
        correctId,
        pickedId: animeId,
        correct,
        aIsCarryOver: state.aIsCarryOver,
      },
      streak: nextStreak,
      bestStreak: nextBest,
      score: Math.max(0, state.score + delta),
    });
  },

  resetGame: () => {
    set({
      round: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      currentPair: null,
      aIsCarryOver: false,
      loadingPair: false,
      lastResult: null,
      showResult: false,
    });
  },

  finishGame: () => {
    set({ showResult: false, currentPair: null, aIsCarryOver: false });
  },
}));
