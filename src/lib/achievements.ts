/**
 * Achievements — the long-game layer.
 *
 * Ranks are a ladder you climb; achievements are the moments you remember.
 * Every one is derived from real recorded data (sessions, streaks, quests,
 * measurements, photos), so nothing can be unlocked by pretending and there is
 * nothing to buy. Pure functions: `evaluateAchievements` is called from the
 * context on every state change.
 */

import {
  BodyLog,
  ProgressPhoto,
  Quest,
  WorkoutProgram,
  WorkoutSession,
} from '../types';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  icon: string;
  /** XP paid the first time it is unlocked */
  xp: number;
  /** how far through the requirement the user is, 0..1 */
  progress: (ctx: AchievementContext) => number;
}

export interface AchievementContext {
  sessions: WorkoutSession[];
  streak: number;
  bestStreak: number;
  quests: Quest[];
  bodyLogs: BodyLog[];
  photos: ProgressPhoto[];
  program: WorkoutProgram | null;
  level: number;
}

export interface UnlockedAchievement {
  id: string;
  at: number;
}

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: '#c48b52',
  silver: '#b9c4d6',
  gold: '#ffcc4d',
  mythic: '#a06bff',
};

/** Total completed sets across every session. */
export function totalSets(sessions: WorkoutSession[]): number {
  return sessions.reduce(
    (n, s) => n + s.exercises.reduce((k, e) => k + e.sets.filter((x) => x.completed).length, 0),
    0,
  );
}

/** Total weight moved, in kg (reps × load), a genuinely satisfying number. */
export function totalVolumeKg(sessions: WorkoutSession[]): number {
  let v = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (set.completed) v += (set.reps || 0) * (set.weightKg || 0);
      }
    }
  }
  return Math.round(v);
}

export function totalMinutes(sessions: WorkoutSession[]): number {
  return Math.round(sessions.reduce((n, s) => n + (s.durationSeconds || 0), 0) / 60);
}

/** Longest run of consecutive training days anywhere in the history. */
export function bestStreakFrom(sessions: WorkoutSession[]): number {
  if (!sessions.length) return 0;
  const days = Array.from(
    new Set(sessions.map((s) => new Date(s.finishedAt ?? s.startedAt).toDateString())),
  )
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b);

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const gap = Math.round((days[i] - days[i - 1]) / 86400000);
    if (gap === 1) run += 1;
    else if (gap > 1) run = 1;
    best = Math.max(best, run);
  }
  return best;
}

const ratio = (value: number, goal: number) => Math.max(0, Math.min(1, value / goal));

export const ACHIEVEMENTS: AchievementDef[] = [
  /* ---- first steps ---- */
  {
    id: 'awakened',
    title: 'First Rep',
    description: 'Finish your first workout',
    tier: 'bronze',
    icon: 'star-four-points-outline',
    xp: 50,
    progress: (c) => ratio(c.sessions.length, 1),
  },
  {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Complete 10 workouts',
    tier: 'bronze',
    icon: 'sword',
    xp: 100,
    progress: (c) => ratio(c.sessions.length, 10),
  },
  {
    id: 'regular',
    title: 'The Regular',
    description: 'Complete 30 workouts',
    tier: 'silver',
    icon: 'calendar-check',
    xp: 250,
    progress: (c) => ratio(c.sessions.length, 30),
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Complete 100 workouts',
    tier: 'gold',
    icon: 'shield-star',
    xp: 800,
    progress: (c) => ratio(c.sessions.length, 100),
  },

  /* ---- streaks ---- */
  {
    id: 'streak_3',
    title: 'Momentum',
    description: 'Train 3 days in a row',
    tier: 'bronze',
    icon: 'fire',
    xp: 75,
    progress: (c) => ratio(c.bestStreak, 3),
  },
  {
    id: 'streak_7',
    title: 'Unbroken',
    description: 'Train 7 days in a row',
    tier: 'silver',
    icon: 'fire-circle',
    xp: 200,
    progress: (c) => ratio(c.bestStreak, 7),
  },
  {
    id: 'streak_30',
    title: 'Unbreakable Habit',
    description: 'Train 30 days in a row',
    tier: 'mythic',
    icon: 'crown-outline',
    xp: 1500,
    progress: (c) => ratio(c.bestStreak, 30),
  },

  /* ---- work volume ---- */
  {
    id: 'sets_500',
    title: '500 Sets',
    description: 'Log 500 completed sets',
    tier: 'silver',
    icon: 'dumbbell',
    xp: 300,
    progress: (c) => ratio(totalSets(c.sessions), 500),
  },
  {
    id: 'volume_100',
    title: '100 Tonnes',
    description: 'Move 100,000 kg of total volume',
    tier: 'gold',
    icon: 'weight-lifter',
    xp: 600,
    progress: (c) => ratio(totalVolumeKg(c.sessions), 100000),
  },
  {
    id: 'hours_50',
    title: '50 Hours',
    description: 'Spend 50 hours training',
    tier: 'gold',
    icon: 'timer-outline',
    xp: 500,
    progress: (c) => ratio(totalMinutes(c.sessions), 3000),
  },

  /* ---- measurement ---- */
  {
    id: 'tracker',
    title: 'Tracker',
    description: 'Log your body stats 10 times',
    tier: 'bronze',
    icon: 'clipboard-pulse-outline',
    xp: 120,
    progress: (c) => ratio(c.bodyLogs.length, 10),
  },
  {
    id: 'first_kilo',
    title: 'First Kilo',
    description: 'Move 1 kg toward your target',
    tier: 'bronze',
    icon: 'scale-bathroom',
    xp: 100,
    progress: (c) => {
      if (!c.program || c.bodyLogs.length < 2) return 0;
      const start = c.bodyLogs[0].weightKg ?? 0;
      const now = c.bodyLogs[c.bodyLogs.length - 1].weightKg ?? start;
      return ratio(Math.abs(start - now), 1);
    },
  },
  {
    id: 'selfie',
    title: 'See the Change',
    description: 'Generate your first progress image',
    tier: 'bronze',
    icon: 'image-multiple-outline',
    xp: 120,
    progress: (c) => ratio(c.photos.length, 1),
  },
  {
    id: 'gallery',
    title: 'Gallery',
    description: 'Collect 12 progress images',
    tier: 'silver',
    icon: 'album',
    xp: 350,
    progress: (c) => ratio(c.photos.length, 12),
  },

  /* ---- consistency ---- */
  {
    id: 'quests_50',
    title: 'Quest Master',
    description: 'Complete 50 daily quests',
    tier: 'silver',
    icon: 'check-decagram-outline',
    xp: 300,
    progress: (c) => ratio(c.quests.filter((q) => q.done).length, 50),
  },
  {
    id: 'level_10',
    title: 'Level 10',
    description: 'Reach level 10',
    tier: 'silver',
    icon: 'numeric-10-circle-outline',
    xp: 250,
    progress: (c) => ratio(c.level, 10),
  },
  {
    id: 'level_25',
    title: 'Level 25',
    description: 'Reach level 25',
    tier: 'gold',
    icon: 'rocket-launch-outline',
    xp: 600,
    progress: (c) => ratio(c.level, 25),
  },
  {
    id: 'level_50',
    title: 'Halfway to the Top',
    description: 'Reach level 50',
    tier: 'mythic',
    icon: 'chess-king',
    xp: 2000,
    progress: (c) => ratio(c.level, 50),
  },
];

export const ACHIEVEMENT_INDEX: Record<string, AchievementDef> = ACHIEVEMENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, AchievementDef>,
);

/**
 * Which achievements are now satisfied that were not before.
 * Returns only the newly unlocked ids so the caller can pay XP exactly once.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  already: UnlockedAchievement[],
): string[] {
  const have = new Set(already.map((a) => a.id));
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    if (a.progress(ctx) >= 1) fresh.push(a.id);
  }
  return fresh;
}
