/**
 * Gamification: XP, levels, tiered ranks and daily quests.
 * Pure functions so they are trivially testable and reusable in any screen.
 */

import { Quest, UserLevel, WorkoutProgram, WorkoutSession } from '../types';

export const RANKS = [
  { rank: 'E', minLevel: 1 },
  { rank: 'D', minLevel: 5 },
  { rank: 'C', minLevel: 12 },
  { rank: 'B', minLevel: 22 },
  { rank: 'A', minLevel: 35 },
  { rank: 'S', minLevel: 50 },
  { rank: 'Contender', minLevel: 70 },
  { rank: 'Elite', minLevel: 100 },
];

export function xpForLevel(level: number): number {
  // smooth, ever-growing curve
  return Math.round(100 * Math.pow(level, 1.35));
}

export function rankForLevel(level: number): string {
  let rank = 'E';
  for (const r of RANKS) if (level >= r.minLevel) rank = r.rank;
  return rank;
}

/** Apply XP and roll levels forward while the threshold is met. */
export function applyXp(current: UserLevel, gained: number): UserLevel {
  let { level, xp } = current;
  xp += Math.max(0, Math.round(gained));
  let guard = 0;
  while (xp >= xpForLevel(level) && guard++ < 500) {
    xp -= xpForLevel(level);
    level += 1;
  }
  return { level, xp, rank: rankForLevel(level) };
}

export function levelProgress(level: { level: number; xp: number }): number {
  return Math.max(0, Math.min(1, level.xp / xpForLevel(level.level)));
}

/** XP for finishing a workout: base + per set, scaled by difficulty. */
export function sessionXp(session: WorkoutSession, difficulty: string): number {
  const sets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const base = 60;
  const perSet = difficulty === 'advanced' ? 9 : difficulty === 'intermediate' ? 7 : 5;
  const bonus = session.durationSeconds > 1800 ? 25 : 0;
  return base + sets * perSet + bonus;
}

/** Deterministic daily quests for a given day-of-year. */
export function buildDailyQuests(dayOfYear: number, program: WorkoutProgram | null): Quest[] {
  const today = program?.weeklySchedule?.[dayOfYear % (program.weeklySchedule.length || 1)];
  const dayKey = String(dayOfYear);
  const rotating: Omit<Quest, 'done'>[] = [
    { id: 'water', title: 'Hydration', description: 'Drink your full water target', xp: 20, kind: 'daily', day: dayKey },
    { id: 'steps', title: 'Move 8k steps', description: 'Stay active outside the gym', xp: 25, kind: 'daily', day: dayKey },
    { id: 'sleep', title: 'Sleep 7h+', description: 'Recovery is where you grow', xp: 25, kind: 'daily', day: dayKey },
    { id: 'protein', title: 'Hit protein', description: 'Reach your daily protein goal', xp: 30, kind: 'daily', day: dayKey },
    { id: 'mobility', title: '10 min mobility', description: 'Stretch and prep your joints', xp: 20, kind: 'daily', day: dayKey },
  ];
  const picked = [rotating[dayOfYear % rotating.length], rotating[(dayOfYear + 2) % rotating.length]];
  const quests: Quest[] = [
    {
      id: 'train',
      title: today && !today.isRest ? `Train: ${today.title}` : 'Active recovery',
      description:
        today && !today.isRest
          ? today.focus || 'Complete today\'s session'
          : 'Light walk, stretch or rest fully',
      xp: 80,
      kind: 'daily',
      done: false,
      day: dayKey,
    },
    ...picked.map((q) => ({ ...q, done: false })),
  ];
  return quests;
}

export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

export function streakFrom(sessions: WorkoutSession[]): number {
  if (!sessions.length) return 0;
  const days = new Set(
    sessions.map((s) => new Date(s.finishedAt ?? s.startedAt).toDateString()),
  );
  let streak = 0;
  const cursor = new Date();
  // allow the streak to remain if today is not yet done but yesterday was
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
