/**
 * Shared domain types.
 * Kept dependency-free so they can be reused everywhere.
 */

export type Gender = 'male' | 'female' | 'other';

export type Goal = 'loseWeight' | 'buildMuscle' | 'lookBetter' | 'stayInShape' | 'getStronger' | 'endurance';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export type ActivityLevel = 'sedentary' | 'lightlyActive' | 'moderatelyActive' | 'veryActive';

export type Equipment = 'none' | 'dumbbells' | 'barbell' | 'kettlebell' | 'machines' | 'bands' | 'fullGym';

export type FocusArea = 'chest' | 'back' | 'arms' | 'abs' | 'legs' | 'shoulders' | 'glutes' | 'cardio';

export type Motivation = 'weightLoss' | 'appearance' | 'health' | 'energy' | 'stress' | 'confidence' | 'enjoyment' | 'social';

export type HealthCondition = 'none' | 'backKnee' | 'shoulder' | 'heart' | 'diabetes' | 'pregnancy' | 'other';

export type Units = 'metric' | 'imperial';

/** Everything the AI learns about the user during onboarding. */
export interface OnboardingProfile {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  /** deadline the user picks: "in how many days / by when" */
  goalDays: number;
  /** training days per week the user said they can commit to */
  daysPerWeek?: number;
  units: Units;
  goal: Goal;
  fitnessLevel: FitnessLevel;
  activityLevel: ActivityLevel;
  equipment: Equipment[];
  focusAreas: FocusArea[];
  motivations: Motivation[];
  healthConditions: HealthCondition[];
  /** the user's own words: who they want to become by the deadline */
  becoming?: string;
  /** optional free-text answers collected by the conversational onboarding */
  freeNotes?: string;
}

export interface ProgramDay {
  day: number;
  title: string;
  focus: string;
  /** rest days have no exercises */
  isRest: boolean;
  estimatedMinutes: number;
  exercises: ProgramExercise[];
}

export interface ProgramExercise {
  name: string;
  sets: number;
  reps: string; // "8-12" | "30s" | "until failure"
  restSeconds: number;
  targetMuscles: string[];
  notes?: string;
}

export interface WorkoutProgram {
  id: string;
  title: string;
  summary: string;
  weeks: number;
  daysPerWeek: number;
  difficulty: FitnessLevel;
  weeklySchedule: ProgramDay[];
/** the 8-day "build-up" opening plan for a brand-new trainee */
  awakeningPlan: ProgramDay[];
  nutrition: NutritionPlan;
  generatedBy: string[]; // which models contributed
  createdAt: number;
}

export interface NutritionPlan {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  guidance: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  kind: 'daily' | 'weekly' | 'milestone';
  done: boolean;
  /** day-of-year key the quest belongs to (daily quests only) */
  day?: string;
}

/** One set actually performed by the user. */
export interface SetLog {
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseName: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  programId: string;
  dayNumber: number;
  title: string;
  startedAt: number;
  finishedAt?: number;
  durationSeconds: number;
  xpEarned: number;
  exercises: ExerciseLog[];
  notes?: string;
}

export interface BodyLog {
  id: string;
  date: number;
  weightKg?: number;
  bodyFatPct?: number;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  thighsCm?: number;
}

/** Everything drawn on the offline transformation poster. */
export interface PosterStats {
  name: string;
  dayNumber: number;
  totalDays: number;
  startWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  rank: string;
  level: number;
  streak: number;
  headline: string;
  encouragement: string;
  score: number;
}

export interface ProgressPhoto {
  id: string;
  /** uri of the user's real photo (optional) */
  uri: string;
  date: number;
  weightKg?: number;
  note?: string;
  /** AI-written coach commentary and a motivational caption */
  aiCaption?: string;
  aiScore?: number;
  aiHeadline?: string;
  aiEncouragement?: string;
  /** local uri of the generated AI illustration, if any */
  aiImageUri?: string;
  /** local uri of the offline SVG transformation poster, if any */
  posterUri?: string;
  /** the numbers behind the poster, so the gallery can redraw it natively */
  posterStats?: PosterStats;
  /** prompt the council wrote for the image generator */
  imagePrompt?: string;
}

export interface UserLevel {
  level: number;
  xp: number;
  rank: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  at: number;
  model?: string;
  /** models that were consulted for this answer */
  consulted?: string[];
}

export interface AppSettings {
  apiKey: string;
  apiBaseUrl: string;
  /** the "council": ids used by the multi-model orchestrator */
  councilModels: string[];
  /** single model used for fast chat */
  chatModel: string;
  /** models that should always join the ensemble, plus count */
  ensembleSize: number;
  /** start the coach in council mode (several models per answer) */
  councilMode: boolean;
  streaming: boolean;
  /** image model id for progress illustrations (e.g. gpt-image-1) */
  imageModel: string;
  /** how weights are entered and shown; stored data stays metric */
  units: 'metric' | 'imperial';
}
