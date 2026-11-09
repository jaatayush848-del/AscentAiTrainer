/**
 * AI layer.
 *
 * Turns a plain-language profile into: an onboarding questionnaire, a full
 * workout program, a nutrition plan, progress analysis, motivational copy and
 * free-form coach answers. Structured tasks go through the multi-model council.
 */

import {
  OnboardingProfile,
  WorkoutProgram,
  ProgramDay,
  NutritionPlan,
  ChatMessage,
} from '../types';
import { consultCouncil, consultCouncilJson } from './orchestrator';
import { chat, chatStream, parseJsonLoose } from './tokenHarbor';
import { DEFAULT_CHAT_MODEL } from './models';

export interface AiContext {
  apiKey: string;
  baseUrl: string;
  chatModel?: string;
  councilModels?: string[];
  ensembleSize?: number;
}

/* ------------------------------------------------------------------ *
 * Onboarding: the questions the AI asks at the start
 * ------------------------------------------------------------------ */

export type QuestionKind = 'single' | 'multi' | 'text' | 'number';

export interface OnboardingQuestion {
  id: string;
  kind: QuestionKind;
  title: string;
  subtitle?: string;
  options?: { value: string; label: string; description?: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** whether the AI should probe deeper on the answer */
  aiProbe?: boolean;
}

/**
 * The opening interview. Covers the essentials (gender, age, height, weight,
 * target, goal, level, activity, equipment, focus areas, motivations, health)
 * and adds the "in how many days / what do you want to become" question the
 * user asked for.
 */
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'goal',
    kind: 'single',
    title: 'What is your primary goal?',
    subtitle: 'The AI tailors every exercise around this.',
    options: [
      { value: 'loseWeight', label: 'Lose weight', description: 'Burn fat, keep muscle' },
      { value: 'buildMuscle', label: 'Build muscle', description: 'Hypertrophy focus' },
      { value: 'getStronger', label: 'Get stronger', description: 'Strength / powerlifting' },
      { value: 'endurance', label: 'Endurance', description: 'Stamina and cardio' },
      { value: 'lookBetter', label: 'Look better', description: 'Aesthetics and tone' },
      { value: 'stayInShape', label: 'Stay in shape', description: 'Maintain and feel good' },
    ],
  },
  {
    id: 'gender',
    kind: 'single',
    title: 'What is your gender?',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other / prefer not to say' },
    ],
  },
  { id: 'age', kind: 'number', title: 'How old are you?', min: 13, max: 90 },
  { id: 'heightCm', kind: 'number', title: 'Your height (cm)', min: 120, max: 230 },
  { id: 'weightKg', kind: 'number', title: 'Your current weight (kg)', min: 30, max: 250 },
  { id: 'targetWeightKg', kind: 'number', title: 'Your target weight (kg)', min: 30, max: 250 },
  {
    id: 'goalDays',
    kind: 'number',
    title: 'In how many days do you want to reach it?',
    subtitle: 'e.g. 30, 60, 90, 180. The AI paces the whole plan to this deadline.',
    min: 7,
    max: 1095,
    aiProbe: true,
  },
  {
    id: 'fitnessLevel',
    kind: 'single',
    title: 'Your current fitness level',
    options: [
      { value: 'beginner', label: 'Beginner', description: 'New to training' },
      { value: 'intermediate', label: 'Intermediate', description: '6+ months consistent' },
      { value: 'advanced', label: 'Advanced', description: 'Years of training' },
    ],
  },
  {
    id: 'activityLevel',
    kind: 'single',
    title: 'How active are you day to day?',
    options: [
      { value: 'sedentary', label: 'Sedentary', description: 'Desk job, little walking' },
      { value: 'lightlyActive', label: 'Lightly active', description: 'Some walking' },
      { value: 'moderatelyActive', label: 'Moderately active', description: 'On feet a lot' },
      { value: 'veryActive', label: 'Very active', description: 'Physical job / sport' },
    ],
  },
  {
    id: 'equipment',
    kind: 'multi',
    title: 'What equipment do you have?',
    options: [
      { value: 'none', label: 'Bodyweight only' },
      { value: 'dumbbells', label: 'Dumbbells' },
      { value: 'barbell', label: 'Barbell + plates' },
      { value: 'kettlebell', label: 'Kettlebell' },
      { value: 'bands', label: 'Resistance bands' },
      { value: 'machines', label: 'Gym machines' },
      { value: 'fullGym', label: 'Full gym access' },
    ],
  },
  {
    id: 'focusAreas',
    kind: 'multi',
    title: 'Any areas you want to prioritize?',
    options: [
      { value: 'chest', label: 'Chest' },
      { value: 'back', label: 'Back' },
      { value: 'shoulders', label: 'Shoulders' },
      { value: 'arms', label: 'Arms' },
      { value: 'abs', label: 'Abs / core' },
      { value: 'glutes', label: 'Glutes' },
      { value: 'legs', label: 'Legs' },
      { value: 'cardio', label: 'Cardio' },
    ],
  },
  {
    id: 'workoutDaysPerWeek',
    kind: 'single',
    title: 'How many days a week can you train?',
    options: [
      { value: '2', label: '2 days' },
      { value: '3', label: '3 days' },
      { value: '4', label: '4 days' },
      { value: '5', label: '5 days' },
      { value: '6', label: '6 days' },
    ],
  },
  {
    id: 'motivations',
    kind: 'multi',
    title: 'What keeps you motivated?',
    subtitle: 'The AI uses these to talk to you the right way.',
    options: [
      { value: 'weightLoss', label: 'Seeing the scale drop' },
      { value: 'appearance', label: 'Looking better in the mirror' },
      { value: 'health', label: 'Being healthy' },
      { value: 'energy', label: 'More energy' },
      { value: 'stress', label: 'Stress relief' },
      { value: 'confidence', label: 'Confidence' },
      { value: 'enjoyment', label: 'I enjoy training' },
      { value: 'social', label: 'Doing it with others' },
    ],
  },
  {
    id: 'healthConditions',
    kind: 'multi',
    title: 'Any injuries or conditions to work around?',
    options: [
      { value: 'none', label: 'None' },
      { value: 'backKnee', label: 'Back or knee issues' },
      { value: 'shoulder', label: 'Shoulder issues' },
      { value: 'heart', label: 'Heart condition' },
      { value: 'diabetes', label: 'Diabetes' },
      { value: 'pregnancy', label: 'Pregnant / postpartum' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'whatYouWantToBecome',
    kind: 'text',
    title: 'Describe who you want to become',
    subtitle: 'Free text. The council reads this to shape tone, style and goals.',
    placeholder: 'e.g. "Lean and athletic, visible abs, strong legs, confident"',
    aiProbe: true,
  },
  {
    id: 'weeklySchedule',
    kind: 'text',
    title: 'Which days and times do you usually train?',
    subtitle: 'e.g. "Mon/Wed/Fri mornings, 45 min"',
    placeholder: 'Mon/Wed/Fri mornings, 45 min',
    aiProbe: true,
  },
];

/** Fields the AI extracts into a profile after the interview. */
export const PROFILE_FIELDS = [
  'goal',
  'gender',
  'age',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'goalDays',
  'fitnessLevel',
  'activityLevel',
  'equipment',
  'focusAreas',
  'motivations',
  'healthConditions',
] as const;

/* ------------------------------------------------------------------ *
 * Program generation
 * ------------------------------------------------------------------ */

export interface RawAnswers {
  [key: string]: string | string[] | number | undefined;
}

function describeProfile(p: OnboardingProfile): string {
  const eq = p.equipment.filter((e) => e !== 'none').join(', ') || 'bodyweight only';
  const focus = p.focusAreas.join(', ') || 'balanced';
  const cond = p.healthConditions.filter((c) => c !== 'none').join(', ') || 'none';
  return [
    `Name: ${p.name}`,
    `Goal: ${p.goal} — reach ${p.targetWeightKg}kg from ${p.weightKg}kg within ${p.goalDays} days`,
    `Demographics: ${p.gender}, ${p.age}y, ${p.heightCm}cm`,
    `Fitness level: ${p.fitnessLevel}; daily activity: ${p.activityLevel}`,
    `Equipment: ${eq}`,
    `Focus areas: ${focus}`,
    `Motivations: ${p.motivations.join(', ') || 'general health'}`,
    `Health conditions/injuries: ${cond}`,
    p.becoming ? `Who they want to become: ${p.becoming}` : '',
    p.daysPerWeek ? `Training days per week they committed to: ${p.daysPerWeek}` : '',
    p.freeNotes ? `In their own words: ${p.freeNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface GenerateOptions extends AiContext {
  scheduleDaysPerWeek?: number;
  weeks?: number;
  onProgress?: (msg: string, done: number, total: number) => void;
  signal?: AbortSignal;
}

const PROGRAM_SCHEMA = `{
  "title": string,
  "summary": string,
  "weeks": number,
  "daysPerWeek": number,
  "difficulty": "beginner"|"intermediate"|"advanced",
  "weeklySchedule": [{
    "day": number, "title": string, "focus": string, "isRest": boolean,
    "estimatedMinutes": number,
    "exercises": [{ "name": string, "sets": number, "reps": string, "restSeconds": number, "targetMuscles": string[], "notes": string }]
  }],
  "awakeningPlan": [ same shape as weeklySchedule, an 8-day gentle starter for a brand-new user else [] ],
  "nutrition": { "dailyCalories": number, "proteinG": number, "carbsG": number, "fatG": number, "waterMl": number, "guidance": string[] }
}`;

/**
 * Ask the council for a full program. The heavy prompt is shared; several
 * models draft, then the synthesizer reconciles into one JSON program.
 */
export async function generateProgram(
  profile: OnboardingProfile,
  opts: GenerateOptions,
): Promise<WorkoutProgram> {
  const weeks = opts.weeks ?? Math.max(4, Math.min(24, Math.round(profile.goalDays / 7)));
  const daysPerWeek = opts.scheduleDaysPerWeek ?? profile.daysPerWeek ?? 4;

  const prompt =
    `Create a personalized ${weeks}-week workout program and nutrition plan.\n\n` +
    `USER PROFILE\n${describeProfile(profile)}\n\n` +
    `RULES\n` +
    `- Respect the ${profile.goalDays}-day deadline and split the work into phases.\n` +
    `- Only use equipment the user has: ${profile.equipment.join(', ')}.\n` +
    `- Never program movements that aggravate: ${profile.healthConditions.join(', ') || 'nothing'}.\n` +
    `- Exactly ${daysPerWeek} training days/week with rest days marked isRest=true.\n` +
    `- Give every exercise sensible sets, rep ranges or time, and rest seconds.\n` +
    `- Compute calories/macros for the goal and bodyweight (Mifflin-St Jeor + activity).\n` +
    `- Also include awakeningPlan: an 8-day gentle build-up on-ramp for day one.\n\n` +
    `Return JSON matching exactly this TypeScript shape:\n${PROGRAM_SCHEMA}`;

  const { data, answer } = await consultCouncilJson<Omit<WorkoutProgram, 'id' | 'generatedBy' | 'createdAt'>>(
    {
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      prompt,
      roles: ['planner', 'coach', 'nutrition'],
      size: opts.ensembleSize ?? 6,
      synthesizer: 'claude-opus-5.5',
      maxTokens: 4000,
      temperature: 0.4,
      onProgress: (done, total, model) =>
        opts.onProgress?.(`Drafting with ${model}`, done, total),
      signal: opts.signal,
    },
  );

  const program: WorkoutProgram = {
    id: `prog_${Date.now()}`,
    title: data.title || 'Your Training Program',
    summary: data.summary || '',
    weeks: data.weeks || weeks,
    daysPerWeek: data.daysPerWeek || daysPerWeek,
    difficulty: data.difficulty || profile.fitnessLevel,
    weeklySchedule: (data.weeklySchedule || []).map(normalizeDay),
    awakeningPlan: (data.awakeningPlan || []).map(normalizeDay),
    nutrition: data.nutrition || fallbackNutrition(profile),
    generatedBy: answer.consulted,
    createdAt: Date.now(),
  };
  return program;
}

function normalizeDay(d: Partial<ProgramDay> & { day?: number }, i: number): ProgramDay {
  return {
    day: d.day ?? i + 1,
    title: d.title ?? `Day ${i + 1}`,
    focus: d.focus ?? '',
    isRest: d.isRest ?? false,
    estimatedMinutes: d.estimatedMinutes ?? 45,
    exercises: (d.exercises ?? []).map((e) => ({
      name: e.name ?? 'Exercise',
      sets: e.sets ?? 3,
      reps: e.reps ?? '8-12',
      restSeconds: e.restSeconds ?? 60,
      targetMuscles: e.targetMuscles ?? [],
      notes: e.notes,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Nutrition fallback (deterministic, used if the AI omits numbers)
 * ------------------------------------------------------------------ */

function fallbackNutrition(p: OnboardingProfile): NutritionPlan {
  const s = p.gender === 'male' ? 5 : -161;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s;
  const factor =
    p.activityLevel === 'sedentary'
      ? 1.2
      : p.activityLevel === 'lightlyActive'
        ? 1.375
        : p.activityLevel === 'moderatelyActive'
          ? 1.55
          : 1.725;
  let calories = Math.round(bmr * factor);
  if (p.goal === 'loseWeight') calories -= 500;
  if (p.goal === 'buildMuscle' || p.goal === 'getStronger') calories += 300;
  const proteinG = Math.round(p.weightKg * 2);
  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return {
    dailyCalories: Math.max(1200, calories),
    proteinG,
    carbsG,
    fatG,
    waterMl: Math.round(p.weightKg * 35),
    guidance: [
      'Hit your protein target every day to protect muscle.',
      'Eat whole foods for ~80% of calories.',
      'Spread protein across 3-4 meals.',
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Progress analysis + motivational image caption
 * ------------------------------------------------------------------ */

export interface ProgressAnalysis {
  score: number;
  headline: string;
  observations: string[];
  encouragement: string;
  nextSteps: string[];
  imagePrompt: string;
}

/**
 * Analyze a progress check-in. Vision models on many gateways accept images,
 * but to stay model-agnostic we describe the numeric metrics and any note, and
 * the council produces structured feedback plus a prompt we can hand to an
 * image model for the motivational "transformation" image.
 */
export async function analyzeProgress(
  profile: OnboardingProfile,
  metrics: {
    dayNumber: number;
    startWeightKg: number;
    currentWeightKg: number;
    targetWeightKg: number;
    waistCm?: number;
    chestCm?: number;
    armsCm?: number;
    note?: string;
  },
  opts: AiContext,
): Promise<ProgressAnalysis> {
  const lost = metrics.startWeightKg - metrics.currentWeightKg;
  const prompt =
    `You are the user's motivating coach. Analyze this progress check-in and reply with JSON.\n\n` +
    `Profile: ${describeProfile(profile)}\n` +
    `Day ${metrics.dayNumber} of ${profile.goalDays}.\n` +
    `Weight: start ${metrics.startWeightKg}kg -> now ${metrics.currentWeightKg}kg ` +
    `(${lost >= 0 ? 'lost' : 'gained'} ${Math.abs(lost).toFixed(1)}kg), target ${metrics.targetWeightKg}kg.\n` +
    (metrics.waistCm ? `Waist: ${metrics.waistCm}cm. ` : '') +
    (metrics.chestCm ? `Chest: ${metrics.chestCm}cm. ` : '') +
    (metrics.armsCm ? `Arms: ${metrics.armsCm}cm. ` : '') +
    (metrics.note ? `\nUser's note: ${metrics.note}` : '') +
    `\n\nReturn JSON: { "score": 0-100, "headline": string, "observations": string[], ` +
    `"encouragement": string, "nextSteps": string[], ` +
    `"imagePrompt": string  // a vivid text-to-image prompt for a motivational, cinematic hero image of this user's transformation, no real names, non-identifying }`;

  try {
    const { data } = await consultCouncilJson<ProgressAnalysis>(
      {
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        prompt,
        roles: ['analyst', 'motivator'],
        size: opts.ensembleSize ?? 4,
        maxTokens: 1200,
        temperature: 0.6,
      },
    );
    return {
      score: clamp(data.score ?? 70, 0, 100),
      headline: data.headline ?? 'Progress logged',
      observations: data.observations ?? [],
      encouragement: data.encouragement ?? 'Keep going — consistency wins.',
      nextSteps: data.nextSteps ?? [],
      imagePrompt: data.imagePrompt ?? defaultImagePrompt(profile),
    };
  } catch {
    const pct = clamp(Math.round(50 + (lost * 10)), 5, 99);
    return {
      score: pct,
      headline: `Down ${lost.toFixed(1)}kg`,
      observations: ['Weight trend captured.'],
      encouragement: 'Every logged day compounds. Stay with it.',
      nextSteps: ['Keep protein high', 'Stay consistent this week'],
      imagePrompt: defaultImagePrompt(profile),
    };
  }
}

export function defaultImagePrompt(profile: OnboardingProfile): string {
  return (
    `Cinematic motivational poster of a determined athlete, ${profile.gender}, ` +
    `silhouette against a glowing dawn sky, dramatic rim light, gold and deep ` +
    `blue palette, subtle particle effects, epic game-UI energy aura, ` +
    `no text, no real identifiable person, high detail, 4k.`
  );
}

/* ------------------------------------------------------------------ *
 * Motivation + chat
 * ------------------------------------------------------------------ */

export async function motivate(
  profile: OnboardingProfile,
  stats: { streak: number; level: number; rank: string; todayDone: boolean },
  opts: AiContext,
): Promise<string> {
  const prompt =
    `Write ONE short, punchy motivational line (max 24 words) for ${profile.name}, ` +
    `whose motivations are ${profile.motivations.join(', ') || 'staying healthy'}. ` +
    `Context: level ${stats.level}, rank ${stats.rank}, ${stats.streak}-day streak, ` +
    `${stats.todayDone ? 'workout already done today' : 'workout still ahead today'}. ` +
    `Tone: ${stats.todayDone ? 'proud and propulsive' : 'ignite urgency, no guilt'}. Return only the line.`;
  try {
    const res = await chat(opts.apiKey, {
      model: opts.chatModel ?? DEFAULT_CHAT_MODEL,
      baseUrl: opts.baseUrl,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      maxTokens: 80,
    });
    return res.content.trim();
  } catch {
    return stats.todayDone
      ? 'Logged. That is how the transformation is built.'
      : 'The version of you that you want is waiting on today. Go.';
  }
}

/**
 * Free-form coach chat. Uses the council when the question is complex or the
 * user explicitly asks, otherwise a fast single model.
 */
export async function coachAnswer(
  history: ChatMessage[],
  question: string,
  profile: OnboardingProfile,
  opts: AiContext & {
    useCouncil?: boolean;
    stream?: boolean;
    onProgress?: (m: string, d: number, t: number) => void;
    /** called with each new fragment when `stream` is on */
    onDelta?: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<{ answer: string; consulted: string[] }> {
  const context =
    `You are ${profile.name}'s personal AI fitness coach. You know their profile:\n` +
    `${describeProfile(profile)}\n\n` +
    `Answer any question accurately and helpfully — training, nutrition, recovery, ` +
    `motivation, technique. If something is a medical concern, advise seeing a professional. ` +
    `Keep answers practical and encouraging.`;

  const recent = history.slice(-8).map((m) => `${m.role}: ${m.content}`).join('\n');
  const prompt = recent ? `${recent}\nuser: ${question}` : question;

  if (opts.useCouncil) {
    const res = await consultCouncil({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      prompt,
      system: context,
      roles: ['coach', 'nutrition', 'motivator', 'general'],
      size: opts.ensembleSize ?? 5,
      models: opts.councilModels,
      onProgress: opts.onProgress,
      maxTokens: 1200,
      signal: opts.signal,
    });
    // The council answers in one shot, so replay it as a single delta.
    opts.onDelta?.(res.answer);
    return { answer: res.answer, consulted: res.consulted };
  }

  const model = opts.chatModel ?? DEFAULT_CHAT_MODEL;

  // Streaming fast path: tokens appear as the model writes them.
  if (opts.stream && opts.onDelta) {
    const res = await chatStream(
      opts.apiKey,
      {
        model,
        baseUrl: opts.baseUrl,
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        maxTokens: 900,
        signal: opts.signal,
      },
      opts.onDelta,
    );
    return { answer: res.content.trim(), consulted: [res.model] };
  }

  const res = await chat(opts.apiKey, {
    model,
    baseUrl: opts.baseUrl,
    messages: [
      { role: 'system', content: context },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
    maxTokens: 900,
    signal: opts.signal,
  });
  return { answer: res.content.trim(), consulted: [res.model] };
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Ask the model to turn raw onboarding answers into a normalized profile.
 * Falls back to a direct field mapping if the model is unavailable.
 */
export async function extractProfile(
  answers: RawAnswers,
  opts: AiContext,
): Promise<Partial<OnboardingProfile>> {
  try {
    const res = await chat(opts.apiKey, {
      model: opts.chatModel ?? DEFAULT_CHAT_MODEL,
      baseUrl: opts.baseUrl,
      messages: [
        {
          role: 'system',
          content:
            'You convert raw onboarding answers into a normalized fitness profile. ' +
            'Reply with JSON only.',
        },
        {
          role: 'user',
          content:
            `Answers: ${JSON.stringify(answers)}\n\n` +
            `Return JSON with keys: goal, gender, age, heightCm, weightKg, ` +
            `targetWeightKg, goalDays, fitnessLevel, activityLevel, equipment[], ` +
            `focusAreas[], motivations[], healthConditions[], name, freeNotes.`,
        },
      ],
      temperature: 0.1,
      maxTokens: 600,
    });
    return parseJsonLoose<Partial<OnboardingProfile>>(res.content);
  } catch {
    return mapRawAnswers(answers);
  }
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v ? [v] : [];
  return [];
}
function asNumber(v: unknown, d: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
}

export function mapRawAnswers(a: RawAnswers): Partial<OnboardingProfile> {
  const name = typeof a.name === 'string' ? a.name : undefined;
  const free = [a.whatYouWantToBecome, a.weeklySchedule]
    .filter((x) => typeof x === 'string' && x)
    .join(' | ');
  return {
    name,
    goal: (a.goal as any) || 'stayInShape',
    gender: (a.gender as any) || 'other',
    age: asNumber(a.age, 30),
    heightCm: asNumber(a.heightCm, 170),
    weightKg: asNumber(a.weightKg, 75),
    targetWeightKg: asNumber(a.targetWeightKg, asNumber(a.weightKg, 75)),
    goalDays: asNumber(a.goalDays, 60),
    daysPerWeek: a.workoutDaysPerWeek ? clamp(asNumber(a.workoutDaysPerWeek, 4), 1, 7) : undefined,
    fitnessLevel: (a.fitnessLevel as any) || 'beginner',
    activityLevel: (a.activityLevel as any) || 'lightlyActive',
    equipment: asArray(a.equipment).length ? asArray(a.equipment) : ['none'],
    focusAreas: asArray(a.focusAreas),
    motivations: asArray(a.motivations),
    healthConditions: asArray(a.healthConditions).length ? asArray(a.healthConditions) : ['none'],
    becoming: typeof a.whatYouWantToBecome === 'string' ? a.whatYouWantToBecome : undefined,
    freeNotes: free || undefined,
  };
}
