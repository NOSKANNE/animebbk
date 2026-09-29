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
  /** Score delta for this round (positive on correct, 0 on wrong — HP loss is separate). */
  scoreDelta: number;
  /** HP change for this round (negative on wrong, possibly +1 if healed). */
  hpDelta: number;
  /** True if this pick triggered a heal (every 10 consecutive correct). */
  healed: boolean;
}

interface GameState {
  // navigation
  mode: GameMode;
  setMode: (m: GameMode) => void;

  // filters
  filters: AnimeFilters;
  setFilters: (f: AnimeFilters) => void;

  // single-player state — blood/HP mode
  hp: number;
  maxHp: number;
  round: number; // rounds played so far (1-indexed after first load)
  score: number; // bonus score, kept for fun
  streak: number; // current consecutive correct streak
  bestStreak: number;
  correctCount: number;
  wrongCount: number;
  /** Correct answers since the last HP restore (resets at every 10). */
  correctSinceLastHeal: number;

  currentPair: AnimeListItem[] | null;
  /** True if currentPair[0] was carried over from the previous round's B (chain mode). */
  aIsCarryOver: boolean;
  loadingPair: boolean;
  lastResult: RoundResult | null;
  showResult: boolean;
  gameOver: boolean;

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

const DEFAULT_MAX_HP = 3;
const HEAL_EVERY_N_CORRECT = 10;

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'menu',
  setMode: (m) => set({ mode: m }),

  filters: DEFAULT_FILTERS,
  setFilters: (f) => set({ filters: f }),

  hp: DEFAULT_MAX_HP,
  maxHp: DEFAULT_MAX_HP,
  round: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctCount: 0,
  wrongCount: 0,
  correctSinceLastHeal: 0,
  currentPair: null,
  aIsCarryOver: false,
  loadingPair: false,
  lastResult: null,
  showResult: false,
  gameOver: false,

  startGame: () => {
    set({
      hp: DEFAULT_MAX_HP,
      maxHp: DEFAULT_MAX_HP,
      round: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctCount: 0,
      wrongCount: 0,
      correctSinceLastHeal: 0,
      lastResult: null,
      showResult: false,
      currentPair: null,
      aIsCarryOver: false,
      loadingPair: false,
      gameOver: false,
    });
  },

  /**
   * Chain mode + HP survival mode.
   * Round 1 fetches a fresh pair. Round >1 carries the previous B → new A,
   * then fetches a single new anime for B.
   * If HP is 0 (game over), do nothing — UI shows the game-over screen.
   */
  loadNextPair: async () => {
    const state = get();
    if (state.gameOver || state.hp <= 0) {
      // Game over — clear the pair so UI transitions to game over screen.
      set({ showResult: false, currentPair: null });
      return;
    }

    const { filters, round, currentPair } = state;
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
    if (!pair || state.showResult || state.gameOver) return;

    const [a, b] = pair;
    const correctId =
      a.score > b.score ? a.id : b.score > a.score ? b.id : animeId;
    const correct = animeId === correctId;

    const prevStreak = state.streak;
    const nextStreak = correct ? prevStreak + 1 : 0;
    const nextBest = Math.max(state.bestStreak, nextStreak);

    let hp = state.hp;
    let score = state.score;
    let correctSinceLastHeal = state.correctSinceLastHeal;
    let healed = false;
    let scoreDelta = 0;
    let hpDelta = 0;

    if (correct) {
      // +10 base, +2 per streak level above 1 (kept for fun stats).
      scoreDelta = 10 + Math.max(0, (nextStreak - 1) * 2);
      score += scoreDelta;
      correctSinceLastHeal += 1;
      // Heal every N consecutive correct.
      if (
        correctSinceLastHeal >= HEAL_EVERY_N_CORRECT &&
        hp < state.maxHp
      ) {
        hp += 1;
        healed = true;
        correctSinceLastHeal = 0;
        hpDelta = +1;
      } else if (correctSinceLastHeal >= HEAL_EVERY_N_CORRECT) {
        // Already at max HP — reset the counter so the player keeps making progress.
        correctSinceLastHeal = 0;
      }
    } else {
      hp = Math.max(0, hp - 1);
      hpDelta = -1;
      correctSinceLastHeal = 0;
    }

    const newGameOver = hp <= 0;

    set({
      showResult: true,
      lastResult: {
        animeA: a,
        animeB: b,
        correctId,
        pickedId: animeId,
        correct,
        aIsCarryOver: state.aIsCarryOver,
        scoreDelta,
        hpDelta,
        healed,
      },
      streak: nextStreak,
      bestStreak: nextBest,
      score,
      hp,
      correctCount: state.correctCount + (correct ? 1 : 0),
      wrongCount: state.wrongCount + (correct ? 0 : 1),
      correctSinceLastHeal,
      // Don't immediately transition to game over — let the player see the
      // reveal of their last wrong answer. The "next" button will trigger
      // loadNextPair, which detects gameOver via hp <= 0.
      gameOver: newGameOver,
    });
  },

  resetGame: () => {
    set({
      hp: DEFAULT_MAX_HP,
      maxHp: DEFAULT_MAX_HP,
      round: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctCount: 0,
      wrongCount: 0,
      correctSinceLastHeal: 0,
      currentPair: null,
      aIsCarryOver: false,
      loadingPair: false,
      lastResult: null,
      showResult: false,
      gameOver: false,
    });
  },

  finishGame: () => {
    set({
      showResult: false,
      currentPair: null,
      aIsCarryOver: false,
      gameOver: true,
    });
  },
}));
