/**
 * Token Harbor client.
 *
 * Token Harbor is an OpenAI-compatible multi-model gateway:
 *   Base URL : https://tokenharbor.ai/v1
 *   Auth     : Authorization: Bearer thk_live_<your-key>
 *   Chat     : POST /chat/completions
 *   Catalog  : GET  /models
 *
 * Docs: https://tokenharbor.ai/docs
 *
 * The user pastes their own Universal Key in the in-app setup screen, so the
 * app itself stays completely free: the developer never pays for inference and
 * never ships a hard-coded key.
 */

export const DEFAULT_BASE_URL = 'https://tokenharbor.ai/v1';

export interface ChatMessageIn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  /** override the configured base url */
  baseUrl?: string;
  model: string;
  messages: ChatMessageIn[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** optional JSON-schema-ish nudge; we ask the model to return JSON in the prompt */
  responseFormat?: 'text' | 'json';
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface GatewayModel {
  id: string;
  owned_by?: string;
  context_length?: number;
}

export class TokenHarborError extends Error {
  status: number;
  body: string;
  constructor(message: string, status = 0, body = '') {
    super(message);
    this.name = 'TokenHarborError';
    this.status = status;
    this.body = body;
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function normalizeBase(baseUrl?: string): string {
  const base = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  return base;
}

/** Strip ```json fences some models like to wrap structured output in. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

/** Best-effort JSON parse of a model reply, tolerant of fences and leading prose. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.search(/[[{]/);
    const lastObj = cleaned.lastIndexOf('}');
    const lastArr = cleaned.lastIndexOf(']');
    const last = Math.max(lastObj, lastArr);
    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    }
    throw new TokenHarborError('Model did not return valid JSON', 0, raw.slice(0, 500));
  }
}

/** Non-streaming chat completion. */
export async function chat(
  apiKey: string,
  opts: ChatRequestOptions,
): Promise<ChatResult> {
  if (!apiKey) throw new TokenHarborError('Missing Token Harbor API key');
  const base = normalizeBase(opts.baseUrl);
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (typeof opts.maxTokens === 'number') body.max_tokens = opts.maxTokens;
  if (opts.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TokenHarborError(
      `Token Harbor ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  const json = (await res.json()) as any;
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model: json?.model ?? opts.model,
    usage: json?.usage,
  };
}

/**
 * Streaming chat completion using Server-Sent Events.
 * `onDelta` fires for each text fragment; resolves with the full text.
 */
export async function chatStream(
  apiKey: string,
  opts: ChatRequestOptions,
  onDelta: (delta: string) => void,
): Promise<ChatResult> {
  if (!apiKey) throw new TokenHarborError('Missing Token Harbor API key');
  const base = normalizeBase(opts.baseUrl);
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
  };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (typeof opts.maxTokens === 'number') body.max_tokens = opts.maxTokens;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    // Fall back to non-streaming if the runtime has no stream support.
    const fallback = await chat(apiKey, { ...opts, stream: false });
    onDelta(fallback.content);
    return fallback;
  }

  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta: string = parsed?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // ignore keep-alives / malformed chunks
      }
    }
  }
  return { content: full, model: opts.model };
}

/** Fetch the live model catalog. Requires the key, per Token Harbor docs. */
export async function listModels(
  apiKey: string,
  baseUrl?: string,
): Promise<GatewayModel[]> {
  const base = normalizeBase(baseUrl);
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new TokenHarborError(`Token Harbor ${res.status}`, res.status);
  }
  const json = (await res.json()) as { data?: GatewayModel[] };
  return json.data ?? [];
}

/** Cheap connectivity check: a one-token completion. */
export async function ping(
  apiKey: string,
  model: string,
  baseUrl?: string,
): Promise<boolean> {
  try {
    const r = await chat(apiKey, {
      model,
      baseUrl,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 4,
    });
    return typeof r.content === 'string';
  } catch {
    return false;
  }
}
