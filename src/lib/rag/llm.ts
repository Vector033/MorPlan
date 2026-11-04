import { z } from "zod";

export type LlmResult<T> = { data: T; inputTokens: number; outputTokens: number };

// Every model call goes through this interface so the provider can be swapped
// (Gemini today; a fake in tests) without touching the callers.
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
    private model = "gemini-flash-latest",
  ) {
    this.name = `gemini:${model}`;
  }

  cost(inputTokens: number, outputTokens: number) {
    return (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1e6;
  }

  async json<T>({ system, prompt, schema }: { system: string; prompt: string; schema: z.ZodType<T> }) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema, { target: "draft-7" }),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
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

/** The configured provider, or null when no API key is set. */
export function getLlm(): LlmProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GeminiProvider(key, process.env.GEMINI_MODEL || undefined);
}
