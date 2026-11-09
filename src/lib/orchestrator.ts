/**
 * Multi-model orchestrator ("the council").
 *
 * The user asked for an AI where 50+ models work together. This module makes
 * that literal: for a given request it recruits several models in parallel,
 * each with a specialty role, then hands every draft to a strong synthesizer
 * that merges them into one best answer.
 *
 * Pipeline:
 *   1. ROUTE  - pick the models whose role matches the task
 *   2. DRAFT  - run them in parallel (Promise.allSettled, so one failure is fine)
 *   3. SYNTH  - a top model reconciles the drafts into the final answer
 *   4. FALLBACK - if synthesis fails, return the highest-weight draft
 *
 * Everything is resilient: a mistyped or unreachable model id never breaks the
 * whole request, it just drops out of the ensemble.
 */

import { chat, ChatMessageIn, TokenHarborError } from './tokenHarbor';
import { MODEL_INDEX, modelsByRole, ModelRole, modelLabel } from './models';

export interface CouncilRequest {
  apiKey: string;
  baseUrl?: string;
  /** the user-facing instruction to all models */
  prompt: string;
  /** optional shared context/system prompt */
  system?: string;
  /** which specialties to recruit. Defaults to general + critic. */
  roles?: ModelRole[];
  /** how many drafters to run (clamped to available models) */
  size?: number;
  /** explicit model ids to use instead of role routing */
  models?: string[];
  /** the model that merges the drafts */
  synthesizer?: string;
  temperature?: number;
  maxTokens?: number;
  onProgress?: (done: number, total: number, modelId: string) => void;
  signal?: AbortSignal;
}

export interface CouncilAnswer {
  answer: string;
  /** models that produced a usable draft */
  consulted: string[];
  synthesizer: string;
  drafts: { model: string; ok: boolean; content: string; error?: string }[];
}

export interface CouncilOptions {
  size?: number;
  synthesizer?: string;
}

function defaultSynthesizer(models: string[]): string {
  // Prefer the strongest planner in the pool, else the first model.
  const ranked = [...models].sort(
    (a, b) => (MODEL_INDEX[b]?.weight ?? 0) - (MODEL_INDEX[a]?.weight ?? 0),
  );
  return ranked[0] ?? 'claude-opus-5.5';
}

/** Choose which models to recruit for the given request. */
export function routeCouncil(req: CouncilRequest, opts: CouncilOptions = {}): {
  drafters: string[];
  synthesizer: string;
} {
  const roles = req.roles && req.roles.length ? req.roles : ['general', 'critic'];
  let pool: string[];
  if (req.models && req.models.length) {
    pool = req.models;
  } else {
    const set = new Set<string>();
    for (const role of roles) {
      for (const m of modelsByRole(role)) set.add(m.id);
    }
    // top up with all-rounders if a specialty is thin
    for (const m of modelsByRole('general')) set.add(m.id);
    pool = Array.from(set);
  }

  const size = Math.max(
    2,
    Math.min(opts.size ?? req.size ?? 5, pool.length || 2),
  );

  // Weighted round-robin so we get a spread of vendors, not five Claudes.
  pool.sort((a, b) => (MODEL_INDEX[b]?.weight ?? 0) - (MODEL_INDEX[a]?.weight ?? 0));
  const drafters: string[] = [];
  const vendorSeen: Record<string, number> = {};
  for (const id of pool) {
    const vendor = MODEL_INDEX[id]?.vendor ?? id;
    const used = vendorSeen[vendor] ?? 0;
    if (used >= 2) continue;
    drafters.push(id);
    vendorSeen[vendor] = used + 1;
    if (drafters.length >= size) break;
  }
  // if the vendor cap left us short, fill from the rest of the pool
  for (const id of pool) {
    if (drafters.length >= size) break;
    if (!drafters.includes(id)) drafters.push(id);
  }

  return {
    drafters,
    synthesizer: opts.synthesizer ?? req.synthesizer ?? defaultSynthesizer(drafters),
  };
}

/**
 * Run a single model, never throwing: returns `{ ok:false }` on error so the
 * ensemble can tolerate partial failures.
 */
async function safeChat(
  apiKey: string,
  baseUrl: string | undefined,
  model: string,
  messages: ChatMessageIn[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ model: string; ok: boolean; content: string; error?: string }> {
  try {
    const res = await chat(apiKey, {
      model,
      baseUrl,
      messages,
      temperature,
      maxTokens,
      signal,
    });
    const content = (res.content || '').trim();
    return { model, ok: !!content, content, error: content ? undefined : 'empty' };
  } catch (e) {
    const msg = e instanceof TokenHarborError ? e.message : (e as Error).message;
    return { model, ok: false, content: '', error: msg };
  }
}

/**
 * Full council run: draft with N models, then synthesize.
 */
export async function consultCouncil(
  req: CouncilRequest,
  opts: CouncilOptions = {},
): Promise<CouncilAnswer> {
  const { drafters, synthesizer } = routeCouncil(req, opts);
  const system =
    req.system ??
    'You are part of a council of expert fitness coaches, sports scientists and nutritionists answering one user. Give your best, focused, correct answer. Be concrete.';
  const temperature = req.temperature ?? 0.5;
  const maxTokens = req.maxTokens ?? 1200;

  let done = 0;
  const drafts = await Promise.all(
    drafters.map(async (model) => {
      const messages: ChatMessageIn[] = [
        { role: 'system', content: system },
        { role: 'user', content: req.prompt },
      ];
      const r = await safeChat(
        req.apiKey,
        req.baseUrl,
        model,
        messages,
        temperature,
        maxTokens,
        req.signal,
      );
      done += 1;
      req.onProgress?.(done, drafters.length, model);
      return r;
    }),
  );

  const okDrafts = drafts.filter((d) => d.ok);
  if (okDrafts.length === 0) {
    const firstError = drafts.find((d) => d.error)?.error ?? 'all models failed';
    throw new TokenHarborError(`Council failed: ${firstError}`, 0, '');
  }

  // If only one model succeeded there is nothing to synthesize.
  if (okDrafts.length === 1) {
    return {
      answer: okDrafts[0].content,
      consulted: [okDrafts[0].model],
      synthesizer: okDrafts[0].model,
      drafts,
    };
  }

  const labeled = okDrafts
    .map(
      (d, i) =>
        `### Draft ${i + 1} — ${modelLabel(d.model)}\n${d.content}`,
    )
    .join('\n\n');

  const synthPrompt =
    `${req.prompt}\n\n` +
    `Several expert models each drafted an answer below. Merge them into ONE ` +
    `superior answer: keep the strongest, most specific and correct points from ` +
    `every draft, resolve any disagreements, remove contradictions and filler, ` +
    `and never mention "drafts", models or this instruction. Return only the ` +
    `final answer in the same format the drafts used.\n\n${labeled}`;

  try {
    const synth = await safeChat(
      req.apiKey,
      req.baseUrl,
      synthesizer,
      [
        { role: 'system', content: system },
        { role: 'user', content: synthPrompt },
      ],
      0.3,
      Math.max(maxTokens, 1600),
      req.signal,
    );
    if (synth.ok) {
      return {
        answer: synth.content,
        consulted: okDrafts.map((d) => d.model),
        synthesizer,
        drafts,
      };
    }
  } catch {
    // fall through to best-draft fallback
  }

  const best = okDrafts.sort(
    (a, b) => (MODEL_INDEX[b.model]?.weight ?? 0) - (MODEL_INDEX[a.model]?.weight ?? 0),
  )[0];
  return {
    answer: best.content,
    consulted: okDrafts.map((d) => d.model),
    synthesizer: best.model,
    drafts,
  };
}

/**
 * Convenience wrapper for structured JSON tasks (program generation, analysis).
 * Drafts are asked for JSON; the synthesizer reconciles into JSON too.
 */
export async function consultCouncilJson<T>(
  req: CouncilRequest,
  opts: CouncilOptions = {},
): Promise<{ data: T; answer: CouncilAnswer }> {
  const jsonReq: CouncilRequest = {
    ...req,
    system:
      (req.system ?? '') +
      '\n\nIMPORTANT: Reply with a single valid JSON object and nothing else. No markdown fences, no commentary.',
  };
  const answer = await consultCouncil(jsonReq, opts);
  const { parseJsonLoose } = await import('./tokenHarbor');
  const data = parseJsonLoose<T>(answer.answer);
  return { data, answer };
}

/** Single-model streaming chat used by the coach screen (fast path). */
export async function streamSingle(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: ChatMessageIn[],
  onDelta: (d: string) => void,
  signal?: AbortSignal,
) {
  const { chatStream } = await import('./tokenHarbor');
  return chatStream(apiKey, { model, baseUrl, messages, signal }, onDelta);
}
