import { z } from "zod";

export type LlmResult<T> = { data: T; inputTokens: number; outputTokens: number };

// Every model call goes through this interface so the provider can be swapped
// (Gemini, an OpenAI-compatible router, or a fake in tests) without touching the callers.
export interface LlmProvider {
  readonly name: string;
  json<T>(req: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<LlmResult<T>>;
  /** USD for a call with these token counts. */
  cost(inputTokens: number, outputTokens: number): number;
}

export class LlmError extends Error {}

// Per-million-token prices; override with env when Google changes them.
const PRICE_IN = Number(process.env.GEMINI_PRICE_IN_PER_M ?? 0.3);
const PRICE_OUT = Number(process.env.GEMINI_PRICE_OUT_PER_M ?? 2.5);

export class GeminiProvider implements LlmProvider {
  readonly name: string;

  constructor(
    private apiKey: string,
    // Flash-Lite answers in about a second on the free tier; "gemini-flash-latest" now times out there.
    private model = "gemini-flash-lite-latest",
  ) {
    this.name = `gemini:${model}`;
  }

  cost(inputTokens: number, outputTokens: number) {
    return (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1e6;
  }

  async json<T>({ system, prompt, schema }: { system: string; prompt: string; schema: z.ZodType<T> }) {
    const send = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          // Gemini answers 400 to a schema with maxItems; the limits are still enforced by schema.safeParse below.
          responseJsonSchema: JSON.parse(JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" }), (k, v) => (k === "maxItems" ? undefined : v))),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    // The free tier answers 503 "high demand" about one call in ten; a second try usually goes through.
    let res = await send();
    if (res.status === 503) res = await send();
    if (!res.ok) throw new LlmError(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new LlmError("Model did not return JSON");
    }
    const result = schema.safeParse(parsed);
    if (!result.success) throw new LlmError(`Model output failed validation: ${result.error.message}`);
    const u = body.usageMetadata ?? {};
    return {
      data: result.data,
      inputTokens: u.promptTokenCount ?? 0,
      outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    };
  }
}

/** Pull a JSON object out of a chat reply that may wrap it in fences or reasoning text. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : cleaned;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("Model did not return JSON");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new LlmError("Model did not return JSON");
  }
}

/**
 * Any OpenAI-compatible chat endpoint. Used for FreeLLMAPI, a router over free
 * model tiers that runs on 127.0.0.1, so it only works on a dev machine (evals),
 * never on Vercel. Free tiers cost $0, so cost() is 0.
 */
export class OpenAiCompatProvider implements LlmProvider {
  readonly name: string;

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    label = "freellmapi",
  ) {
    this.name = `${label}:${model}`;
  }

  cost() {
    return 0;
  }

  async json<T>({ system, prompt, schema }: { system: string; prompt: string; schema: z.ZodType<T> }) {
    const shape = JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" }));
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}

Reply with one JSON object only, matching this JSON Schema: ${shape}` },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new LlmError(`${this.name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const result = schema.safeParse(extractJson(body.choices?.[0]?.message?.content ?? ""));
    if (!result.success) throw new LlmError(`Model output failed validation: ${result.error.message}`);
    return {
      data: result.data,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  }
}

const FREELLMAPI_URL = "http://127.0.0.1:31415/v1";

/** A FreeLLMAPI provider for one model, or null when no key is set. Local only. */
export function freeLlm(model: string): LlmProvider | null {
  const key = process.env.FREELLMAPI_KEY;
  if (!key) return null;
  return new OpenAiCompatProvider(process.env.FREELLMAPI_BASE_URL || FREELLMAPI_URL, key, model);
}

/**
 * The configured provider, or null when no model is available.
 * LLM_PROVIDER=freellmapi picks the local router (FREELLMAPI_MODEL, default "auto");
 * otherwise Gemini when GEMINI_API_KEY is set. Other-university import needs one;
 * regulation answers use it only when ASK_LLM=true (see /api/ask).
 */
export function getLlm(): LlmProvider | null {
  if (process.env.LLM_PROVIDER === "freellmapi") return freeLlm(process.env.FREELLMAPI_MODEL || "auto");
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GeminiProvider(key, process.env.GEMINI_MODEL || undefined);
}
