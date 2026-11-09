/**
 * Model catalog for the "duel council".
 *
 * Token Harbor routes 50+ frontier and value models behind one key. The list
 * below is a resilient default: the app also calls `GET /v1/models` at runtime
 * and merges whatever the account can actually reach, so renamed or newly
 * added ids appear automatically. Any id you see on https://tokenharbor.ai/models
 * works — just paste it in Settings.
 *
 * `roles` declares the specialty each model is recruited for by the
 * orchestrator (`src/lib/orchestrator.ts`).
 */

export type ModelRole =
  | 'planner'      // builds the workout program skeleton
  | 'coach'        // exercise selection + progression logic
  | 'nutrition'    // macros + meal guidance
  | 'motivator'    // pep talks, captions, mindset
  | 'analyst'      // reads body metrics / progress data
  | 'critic'       // reviews and hardens other models' output
  | 'general';     // all-rounders used for chat

export interface ModelInfo {
  id: string;
  label: string;
  vendor: string;
  roles: ModelRole[];
  /** rough quality weight used when ranking council answers */
  weight: number;
  speed: 'fast' | 'balanced' | 'deep';
}

export const MODEL_CATALOG: ModelInfo[] = [
  { id: 'claude-opus-5.5', label: 'Claude Opus 5.5', vendor: 'Anthropic', roles: ['planner', 'critic', 'general'], weight: 10, speed: 'deep' },
  { id: 'claude-sonnet-5.5', label: 'Claude Sonnet 5.5', vendor: 'Anthropic', roles: ['planner', 'coach', 'general'], weight: 9, speed: 'balanced' },
  { id: 'claude-fable-5.1', label: 'Claude Fable 5.1', vendor: 'Anthropic', roles: ['motivator', 'critic'], weight: 9, speed: 'deep' },
  { id: 'claude-haiku-5', label: 'Claude Haiku 5', vendor: 'Anthropic', roles: ['general', 'motivator'], weight: 7, speed: 'fast' },

  { id: 'gpt-6-astra', label: 'GPT-6 Astra', vendor: 'OpenAI', roles: ['planner', 'analyst', 'general'], weight: 10, speed: 'deep' },
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', vendor: 'OpenAI', roles: ['planner', 'coach'], weight: 9, speed: 'fast' },
  { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', vendor: 'OpenAI', roles: ['general', 'critic'], weight: 8, speed: 'fast' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini', vendor: 'OpenAI', roles: ['general', 'motivator'], weight: 6, speed: 'fast' },

  { id: 'gemini-4-argon', label: 'Gemini 4 Argon', vendor: 'Google', roles: ['analyst', 'nutrition', 'general'], weight: 9, speed: 'balanced' },
  { id: 'gemini-4-flash', label: 'Gemini 4 Flash', vendor: 'Google', roles: ['general', 'analyst'], weight: 7, speed: 'fast' },

  { id: 'kimi-k3.1-pro', label: 'Kimi K3.1 Pro', vendor: 'Moonshot', roles: ['planner', 'coach'], weight: 8, speed: 'balanced' },
  { id: 'muse-wonder-1.0', label: 'Muse Wonder 1.0', vendor: 'Muse', roles: ['motivator', 'general'], weight: 8, speed: 'balanced' },
  { id: 'grok-4.7', label: 'Grok 4.7', vendor: 'xAI', roles: ['general', 'critic'], weight: 7, speed: 'balanced' },
  { id: 'glm-5.3', label: 'GLM-5.3', vendor: 'Zhipu', roles: ['general', 'nutrition'], weight: 6, speed: 'fast' },
  { id: 'qwen3.8-max', label: 'Qwen3.8 Max', vendor: 'Alibaba', roles: ['analyst', 'general'], weight: 7, speed: 'balanced' },
  { id: 'deepseek-v4.1-flash-1017-ultrafast', label: 'DeepSeek V4.1 Flash', vendor: 'DeepSeek', roles: ['general', 'motivator'], weight: 6, speed: 'fast' },
  { id: 'deepseek-v4.1', label: 'DeepSeek V4.1', vendor: 'DeepSeek', roles: ['coach', 'analyst'], weight: 7, speed: 'balanced' },
  { id: 'llama-4.5-405b', label: 'Llama 4.5 405B', vendor: 'Meta', roles: ['general', 'coach'], weight: 6, speed: 'balanced' },
  { id: 'llama-4.5-70b', label: 'Llama 4.5 70B', vendor: 'Meta', roles: ['general', 'motivator'], weight: 5, speed: 'fast' },
  { id: 'mistral-large-3', label: 'Mistral Large 3', vendor: 'Mistral', roles: ['general', 'nutrition'], weight: 6, speed: 'fast' },
  { id: 'command-r-plus-2', label: 'Command R+ 2', vendor: 'Cohere', roles: ['analyst', 'general'], weight: 6, speed: 'fast' },
  { id: 'phi-5', label: 'Phi-5', vendor: 'Microsoft', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'nova-pro-2', label: 'Nova Pro 2', vendor: 'Amazon', roles: ['general', 'analyst'], weight: 6, speed: 'fast' },
  { id: 'ernie-5', label: 'ERNIE 5', vendor: 'Baidu', roles: ['general'], weight: 5, speed: 'balanced' },
  { id: 'yi-large-2', label: 'Yi Large 2', vendor: '01.AI', roles: ['general'], weight: 5, speed: 'balanced' },
  { id: 'minimax-abab7', label: 'MiniMax abab7', vendor: 'MiniMax', roles: ['general', 'motivator'], weight: 5, speed: 'fast' },
  { id: 'hunyuan-pro-2', label: 'Hunyuan Pro 2', vendor: 'Tencent', roles: ['general'], weight: 5, speed: 'balanced' },
  { id: 'doubao-pro-2', label: 'Doubao Pro 2', vendor: 'ByteDance', roles: ['general'], weight: 5, speed: 'fast' },
  { id: 'sonar-pro-2', label: 'Sonar Pro 2', vendor: 'Perplexity', roles: ['analyst'], weight: 6, speed: 'balanced' },
  { id: 'o5-reasoning', label: 'o5 Reasoning', vendor: 'OpenAI', roles: ['critic', 'analyst'], weight: 9, speed: 'deep' },
  { id: 'o5-mini', label: 'o5 Mini', vendor: 'OpenAI', roles: ['critic', 'general'], weight: 7, speed: 'balanced' },

  // Value / free-route models. Ids ending in `:free` never charge the balance
  // according to https://tokenharbor.ai/docs/billing/cashback — great for the
  // roster of "background" council members.
  { id: 'qwen3.7-max', label: 'Qwen3.7 Max', vendor: 'Alibaba', roles: ['general', 'coach'], weight: 6, speed: 'balanced' },
  { id: 'deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', vendor: 'DeepSeek', roles: ['general'], weight: 5, speed: 'fast' },
  { id: 'glm-5.3:free', label: 'GLM-5.3 (free)', vendor: 'Zhipu', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'llama-4.5-8b:free', label: 'Llama 4.5 8B (free)', vendor: 'Meta', roles: ['general', 'motivator'], weight: 3, speed: 'fast' },
  { id: 'gemma-4-27b:free', label: 'Gemma 4 27B (free)', vendor: 'Google', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'mistral-small-4:free', label: 'Mistral Small 4 (free)', vendor: 'Mistral', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'qwen3.8-32b:free', label: 'Qwen3.8 32B (free)', vendor: 'Alibaba', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'phi-5-mini:free', label: 'Phi-5 Mini (free)', vendor: 'Microsoft', roles: ['general'], weight: 3, speed: 'fast' },

  // Additional reachable ids (the live /v1/models call fills any gaps).
  { id: 'gpt-6.1-terra-long', label: 'GPT-6.1 Terra Long', vendor: 'OpenAI', roles: ['planner'], weight: 8, speed: 'deep' },
  { id: 'claude-opus-5.5-long', label: 'Claude Opus 5.5 Long', vendor: 'Anthropic', roles: ['planner', 'critic'], weight: 9, speed: 'deep' },
  { id: 'gemini-4-argon-pro', label: 'Gemini 4 Argon Pro', vendor: 'Google', roles: ['analyst', 'planner'], weight: 9, speed: 'deep' },
  { id: 'grok-4.7-fast', label: 'Grok 4.7 Fast', vendor: 'xAI', roles: ['general'], weight: 6, speed: 'fast' },
  { id: 'kimi-k3.1-fast', label: 'Kimi K3.1 Fast', vendor: 'Moonshot', roles: ['general', 'coach'], weight: 6, speed: 'fast' },
  { id: 'muse-wonder-1.0-mini', label: 'Muse Wonder Mini', vendor: 'Muse', roles: ['motivator'], weight: 5, speed: 'fast' },
  { id: 'ernie-5-turbo', label: 'ERNIE 5 Turbo', vendor: 'Baidu', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'minimax-abab7-chat', label: 'MiniMax abab7 Chat', vendor: 'MiniMax', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'hunyuan-turbo-2', label: 'Hunyuan Turbo 2', vendor: 'Tencent', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'doubao-lite-2', label: 'Doubao Lite 2', vendor: 'ByteDance', roles: ['general'], weight: 4, speed: 'fast' },
  { id: 'sonar-2', label: 'Sonar 2', vendor: 'Perplexity', roles: ['analyst'], weight: 5, speed: 'fast' },
  { id: 'command-r-2:free', label: 'Command R 2 (free)', vendor: 'Cohere', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'nova-lite-2:free', label: 'Nova Lite 2 (free)', vendor: 'Amazon', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'yi-large-turbo-2:free', label: 'Yi Large Turbo 2 (free)', vendor: '01.AI', roles: ['general'], weight: 3, speed: 'fast' },
  { id: 'phi-5-mini', label: 'Phi-5 Mini', vendor: 'Microsoft', roles: ['general', 'motivator'], weight: 4, speed: 'fast' },
  { id: 'gemma-4-27b', label: 'Gemma 4 27B', vendor: 'Google', roles: ['general'], weight: 4, speed: 'fast' },
];

export const MODEL_INDEX: Record<string, ModelInfo> = MODEL_CATALOG.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<string, ModelInfo>,
);

export function modelLabel(id: string): string {
  return MODEL_INDEX[id]?.label ?? id;
}

export function modelsByRole(role: ModelRole): ModelInfo[] {
  return MODEL_CATALOG.filter((m) => m.roles.includes(role)).sort(
    (a, b) => b.weight - a.weight,
  );
}

/**
 * Merge the live catalog (GET /v1/models) with our curated metadata so unknown
 * ids still get sensible labels and default to the `general` role.
 */
export function mergeLiveModels(liveIds: string[]): ModelInfo[] {
  const known = new Map(MODEL_CATALOG.map((m) => [m.id, m]));
  const merged: ModelInfo[] = [];
  for (const id of liveIds) {
    const m = known.get(id) ?? {
      id,
      label: id,
      vendor: 'Token Harbor',
      roles: ['general'] as ModelRole[],
      weight: 4,
      speed: 'balanced' as const,
    };
    merged.push(m);
    known.delete(id);
  }
  // keep curated entries that the live call did not return
  return [...merged, ...known.values()];
}

export const DEFAULT_COUNCIL: string[] = [
  'claude-opus-5.5',
  'gpt-6-astra',
  'gemini-4-argon',
  'claude-sonnet-5.5',
  'deepseek-v4.1',
  'kimi-k3.1-pro',
  'llama-4.5-405b',
  'grok-4.7',
  'qwen3.8-max',
  'glm-5.3',
];

export const DEFAULT_CHAT_MODEL = 'gpt-6.1-sol';
