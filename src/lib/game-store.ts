'use client';

import { create } from 'zustand';
import type { AnimeListItem } from './bangumi';

export type GameMode = 'menu' | 'single' | 'multiplayer';

export interface AnimeFilters {
  yearStart?: number;
  yearEnd?: number;
  minRatingCount?: number;
}

export interface RoundResult {
  animeA: AnimeListItem;
  animeB: AnimeListItem;
  correctId: number; // the higher-rated one's id
  pickedId?: number; // what the local player chose
  correct: boolean;
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
    });
  },

  loadNextPair: async () => {
    const { filters, round, totalRounds } = get();
    if (round >= totalRounds) {
      set({ showResult: false, currentPair: null });
      return;
    }

    set({ loadingPair: true, showResult: false, lastResult: null });

    try {
      const res = await fetch('/api/bangumi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        pair: AnimeListItem[];
        poolSize: number;
      };
      set({
        currentPair: data.pair,
        loadingPair: false,
        round: get().round + 1,
        showResult: false,
        lastResult: null,
      });
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
    // Higher score wins. Tie goes to whichever was picked.
    const correctId =
      a.score > b.score ? a.id : b.score > a.score ? b.id : animeId;
    const correct = animeId === correctId;

    const nextStreak = correct ? state.streak + 1 : 0;
    const nextBest = Math.max(state.bestStreak, nextStreak);
    // Score: +10 base, +2 per streak level above 1 (encourages consecutive correct).
    const delta = correct ? 10 + Math.max(0, (nextStreak - 1) * 2) : -3;

    set({
      showResult: true,
      lastResult: {
        animeA: a,
        animeB: b,
        correctId,
        pickedId: animeId,
        correct,
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
      loadingPair: false,
      lastResult: null,
      showResult: false,
    });
  },

  finishGame: () => {
    set({ showResult: false, currentPair: null });
  },
}));
