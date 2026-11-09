/**
 * Global app state. One provider owns settings, profile, program, history and
 * level so screens stay simple and always read the same source of truth.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppSettings,
  BodyLog,
  ChatMessage,
  OnboardingProfile,
  ProgressPhoto,
  Quest,
  UserLevel,
  WorkoutProgram,
  WorkoutSession,
} from '../types';
import { DEFAULT_SETTINGS, storage } from '../lib/storage';
import {
  applyXp,
  buildDailyQuests,
  dayOfYear,
  levelProgress,
  streakFrom,
} from '../lib/gamification';
import {
  ACHIEVEMENT_INDEX,
  AchievementContext,
  UnlockedAchievement,
  bestStreakFrom,
  evaluateAchievements,
} from '../lib/achievements';

/** A just-unlocked achievement, surfaced as a toast by the root layout. */
export interface UnlockToast {
  id: string;
  title: string;
  description: string;
  tier: string;
  icon: string;
  xp: number;
}

interface AppState {
  ready: boolean;
  settings: AppSettings;
  profile: OnboardingProfile | null;
  program: WorkoutProgram | null;
  sessions: WorkoutSession[];
  bodyLogs: BodyLog[];
  photos: ProgressPhoto[];
  quests: Quest[];
  level: UserLevel;
  streak: number;
  bestStreak: number;
  levelProgress: number;
  chat: ChatMessage[];
  completions: number[];
  achievements: UnlockedAchievement[];
  /** queue of achievements unlocked moments ago */
  unlockQueue: UnlockToast[];

  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setProfile: (p: OnboardingProfile) => Promise<void>;
  setProgram: (p: WorkoutProgram) => Promise<void>;
  addSession: (s: WorkoutSession) => Promise<void>;
  addBodyLog: (b: BodyLog) => Promise<void>;
  addPhoto: (p: ProgressPhoto) => Promise<void>;
  updatePhoto: (id: string, patch: Partial<ProgressPhoto>) => Promise<void>;
  toggleQuest: (id: string) => Promise<void>;
  addXp: (n: number) => Promise<void>;
  setChatMessages: (m: ChatMessage[]) => Promise<void>;
  dismissUnlock: (id: string) => void;
  reset: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfileState] = useState<OnboardingProfile | null>(null);
  const [program, setProgramState] = useState<WorkoutProgram | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [level, setLevel] = useState<UserLevel>({ level: 1, xp: 0, rank: 'E' });
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [completions, setCompletions] = useState<number[]>([]);
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [unlockQueue, setUnlockQueue] = useState<UnlockToast[]>([]);

  /**
   * Mirror of the unlocked ids in a ref, so the evaluator never reads stale
   * state and can never pay the same XP twice.
   */
  const unlockedRef = useRef<UnlockedAchievement[]>([]);

  useEffect(() => {
    (async () => {
      const [s, p, pr, se, bl, ph, q, lv, ch, cp, ac] = await Promise.all([
        storage.getSettings(),
        storage.getProfile(),
        storage.getProgram(),
        storage.getSessions(),
        storage.getBodyLogs(),
        storage.getPhotos(),
        storage.getQuests(),
        storage.getLevel(),
        storage.getChat(),
        storage.getCompletions(),
        storage.getAchievements(),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setProfileState(p);
      setProgramState(pr);
      setSessions(se);
      setBodyLogs(bl);
      setPhotos(ph);
      setLevel(lv);
      setChat(ch);
      setCompletions(cp);
      setAchievements(ac);
      unlockedRef.current = ac;

      // refresh daily quests when the stored set belongs to a previous day
      const todayKey = String(dayOfYear());
      const isToday = q.length > 0 && q.every((it) => it.day === todayKey);
      if (!isToday) {
        const fresh = buildDailyQuests(dayOfYear(), pr);
        setQuests(fresh);
        await storage.saveQuests(fresh);
      } else {
        setQuests(q);
      }
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void storage.saveSettings(next);
      return next;
    });
  }, []);

  const setProfile = useCallback(async (p: OnboardingProfile) => {
    setProfileState(p);
    await storage.saveProfile(p);
  }, []);

  const setProgram = useCallback(async (p: WorkoutProgram) => {
    setProgramState(p);
    await storage.saveProgram(p);
    const fresh = buildDailyQuests(dayOfYear(), p);
    setQuests(fresh);
    await storage.saveQuests(fresh);
  }, []);

  const addSession = useCallback(async (s: WorkoutSession) => {
    const all = await storage.addSession(s);
    setSessions(all);
    const done = await storage.addCompletion(s.dayNumber);
    setCompletions(done);
    // award the training quest
    setQuests((prev) => {
      const next = prev.map((q) => (q.id === 'train' ? { ...q, done: true } : q));
      void storage.saveQuests(next);
      return next;
    });
    // award XP in one place so level + rank stay in sync
    setLevel((lvl) => {
      const updated = applyXp(lvl, s.xpEarned);
      void storage.saveLevel(updated);
      return updated;
    });
  }, []);

  const addBodyLog = useCallback(async (b: BodyLog) => {
    const all = await storage.addBodyLog(b);
    setBodyLogs(all);
  }, []);

  const addPhoto = useCallback(async (p: ProgressPhoto) => {
    const all = await storage.addPhoto(p);
    setPhotos(all);
  }, []);

  const updatePhoto = useCallback(async (id: string, patch: Partial<ProgressPhoto>) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      void storage.savePhotos(next);
      return next;
    });
  }, []);

  const toggleQuest = useCallback(async (id: string) => {
    setQuests((prev) => {
      const target = prev.find((q) => q.id === id);
      const next = prev.map((q) => (q.id === id ? { ...q, done: !q.done } : q));
      void storage.saveQuests(next);
      if (target && !target.done) {
        setLevel((lvl) => {
          const updated = applyXp(lvl, target.xp);
          void storage.saveLevel(updated);
          return updated;
        });
      }
      return next;
    });
  }, []);

  const addXp = useCallback(async (n: number) => {
    setLevel((lvl) => {
      const updated = applyXp(lvl, n);
      void storage.saveLevel(updated);
      return updated;
    });
  }, []);

  const setChatMessages = useCallback(async (m: ChatMessage[]) => {
    setChat(m);
    await storage.saveChat(m);
  }, []);

  const dismissUnlock = useCallback((id: string) => {
    setUnlockQueue((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const bestStreak = useMemo(() => bestStreakFrom(sessions), [sessions]);

  /**
   * Achievement engine. Runs whenever the data it depends on changes; only
   * newly satisfied definitions are unlocked, and their XP is paid once.
   */
  useEffect(() => {
    if (!ready) return;
    const ctx: AchievementContext = {
      sessions,
      streak: streakFrom(sessions),
      bestStreak,
      quests,
      bodyLogs,
      photos,
      program,
      level: level.level,
    };
    const fresh = evaluateAchievements(ctx, unlockedRef.current);
    if (!fresh.length) return;

    const now = Date.now();
    const added: UnlockedAchievement[] = fresh.map((id) => ({ id, at: now }));
    const nextAll = [...unlockedRef.current, ...added];
    unlockedRef.current = nextAll;
    setAchievements(nextAll);
    void storage.saveAchievements(nextAll);

    const toasts: UnlockToast[] = fresh
      .map((id) => ACHIEVEMENT_INDEX[id])
      .filter(Boolean)
      .map((def) => ({
        id: def.id,
        title: def.title,
        description: def.description,
        tier: def.tier,
        icon: def.icon,
        xp: def.xp,
      }));
    if (toasts.length) setUnlockQueue((prev) => [...prev, ...toasts]);

    const bonus = fresh.reduce((n, id) => n + (ACHIEVEMENT_INDEX[id]?.xp ?? 0), 0);
    if (bonus > 0) {
      setLevel((lvl) => {
        const updated = applyXp(lvl, bonus);
        void storage.saveLevel(updated);
        return updated;
      });
    }
  }, [ready, sessions, bestStreak, quests, bodyLogs, photos, program, level.level]);

  const reset = useCallback(async () => {
    await storage.resetAll();
    unlockedRef.current = [];
    setSettings(DEFAULT_SETTINGS);
    setProfileState(null);
    setProgramState(null);
    setSessions([]);
    setBodyLogs([]);
    setPhotos([]);
    setQuests([]);
    setLevel({ level: 1, xp: 0, rank: 'E' });
    setChat([]);
    setCompletions([]);
    setAchievements([]);
    setUnlockQueue([]);
  }, []);

  const streak = useMemo(() => streakFrom(sessions), [sessions]);
  const progress = useMemo(() => levelProgress(level), [level]);

  const value: AppState = {
    ready,
    settings,
    profile,
    program,
    sessions,
    bodyLogs,
    photos,
    quests,
    level,
    streak,
    bestStreak,
    levelProgress: progress,
    chat,
    completions,
    achievements,
    unlockQueue,
    updateSettings,
    setProfile,
    setProgram,
    addSession,
    addBodyLog,
    addPhoto,
    updatePhoto,
    toggleQuest,
    addXp,
    setChatMessages,
    dismissUnlock,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}