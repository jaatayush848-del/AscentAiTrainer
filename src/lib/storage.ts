/**
 * Local persistence. Everything lives on-device in AsyncStorage: profile,
 * program, sessions, body logs, progress photos, quests, level and settings.
 * Nothing is sent anywhere except the model calls the user's own key authorises.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { DEFAULT_CHAT_MODEL, DEFAULT_COUNCIL } from './models';
import { DEFAULT_BASE_URL } from './tokenHarbor';
import { UnlockedAchievement } from './achievements';

const K = {
  settings: '@arise_free/settings',
  profile: '@arise_free/profile',
  program: '@arise_free/program',
  sessions: '@arise_free/sessions',
  bodyLogs: '@arise_free/bodyLogs',
  photos: '@arise_free/photos',
  quests: '@arise_free/quests',
  level: '@arise_free/level',
  chat: '@arise_free/chat',
  completions: '@arise_free/completions',
  achievements: '@arise_free/achievements',
};

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiBaseUrl: DEFAULT_BASE_URL,
  councilModels: DEFAULT_COUNCIL,
  chatModel: DEFAULT_CHAT_MODEL,
  ensembleSize: 5,
  councilMode: false,
  streaming: true,
  imageModel: 'gpt-image-1',
  units: 'metric',
};

export const storage = {
  /* settings */
  getSettings: () => getJson<AppSettings>(K.settings, DEFAULT_SETTINGS),
  saveSettings: (s: AppSettings) => setJson(K.settings, s),

  /* profile */
  getProfile: () => getJson<OnboardingProfile | null>(K.profile, null),
  saveProfile: (p: OnboardingProfile) => setJson(K.profile, p),
  clearProfile: () => AsyncStorage.removeItem(K.profile),

  /* program */
  getProgram: () => getJson<WorkoutProgram | null>(K.program, null),
  saveProgram: (p: WorkoutProgram) => setJson(K.program, p),

  /* sessions */
  getSessions: () => getJson<WorkoutSession[]>(K.sessions, []),
  saveSessions: (s: WorkoutSession[]) => setJson(K.sessions, s),
  async addSession(s: WorkoutSession) {
    const all = await this.getSessions();
    all.push(s);
    await this.saveSessions(all);
    return all;
  },

  /* body logs */
  getBodyLogs: () => getJson<BodyLog[]>(K.bodyLogs, []),
  saveBodyLogs: (b: BodyLog[]) => setJson(K.bodyLogs, b),
  async addBodyLog(b: BodyLog) {
    const all = await this.getBodyLogs();
    all.push(b);
    all.sort((x, y) => x.date - y.date);
    await this.saveBodyLogs(all);
    return all;
  },

  /* progress photos */
  getPhotos: () => getJson<ProgressPhoto[]>(K.photos, []),
  savePhotos: (p: ProgressPhoto[]) => setJson(K.photos, p),
  async addPhoto(p: ProgressPhoto) {
    const all = await this.getPhotos();
    all.push(p);
    all.sort((x, y) => x.date - y.date);
    await this.savePhotos(all);
    return all;
  },

  /* quests */
  getQuests: () => getJson<Quest[]>(K.quests, []),
  saveQuests: (q: Quest[]) => setJson(K.quests, q),

  /* level */
  getLevel: () => getJson<UserLevel>(K.level, { level: 1, xp: 0, rank: 'E' }),
  saveLevel: (l: UserLevel) => setJson(K.level, l),

  /* coach chat history */
  getChat: () => getJson<ChatMessage[]>(K.chat, []),
  saveChat: (m: ChatMessage[]) => setJson(K.chat, m),

  /* completed day numbers of a program (for the calendar) */
  getCompletions: () => getJson<number[]>(K.completions, []),
  async addCompletion(day: number) {
    const all = await this.getCompletions();
    if (!all.includes(day)) all.push(day);
    await setJson(K.completions, all);
    return all;
  },

  /* unlocked achievements */
  getAchievements: () => getJson<UnlockedAchievement[]>(K.achievements, []),
  saveAchievements: (a: UnlockedAchievement[]) => setJson(K.achievements, a),

  async resetAll() {
    await AsyncStorage.multiRemove(Object.values(K));
  },
};
