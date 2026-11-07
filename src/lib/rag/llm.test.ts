import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { extractJson, getLlm, LlmError, OpenAiCompatProvider } from "./llm";

describe("extractJson", () => {
  it("reads bare, fenced and reasoning-wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('<think>maybe {"a":0}</think>{"a":3}')).toEqual({ a: 3 });
  });
  it("throws LlmError when there is no object", () => {
    expect(() => extractJson("ไม่พบ")).toThrow(LlmError);
  });
});

describe("OpenAiCompatProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts a chat request and validates the reply", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"answer":"ร้อยละ 80"}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const llm = new OpenAiCompatProvider("http://127.0.0.1:31415/v1/", "k", "typhoon");
    const r = await llm.json({ system: "s", prompt: "p", schema: z.object({ answer: z.string() }) });
    expect(r).toEqual({ data: { answer: "ร้อยละ 80" }, inputTokens: 12, outputTokens: 5 });
    expect(llm.name).toBe("freellmapi:typhoon");
    expect(llm.cost()).toBe(0);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:31415/v1/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "typhoon", temperature: 0 });
  });

  it("rejects output that fails the schema", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ choices: [{ message: { content: '{"x":1}' } }] }));
    const llm = new OpenAiCompatProvider("http://h/v1", "k", "m");
    await expect(llm.json({ system: "s", prompt: "p", schema: z.object({ answer: z.string() }) })).rejects.toThrow(LlmError);
  });
});

describe("getLlm", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses FreeLLMAPI only when asked and a key is set", () => {
    vi.stubEnv("LLM_PROVIDER", "freellmapi");
    vi.stubEnv("FREELLMAPI_KEY", "k");
    vi.stubEnv("FREELLMAPI_MODEL", "typhoon");
    expect(getLlm()?.name).toBe("freellmapi:typhoon");
    vi.stubEnv("FREELLMAPI_KEY", "");
    expect(getLlm()).toBeNull();
  });

  it("returns null with no provider configured (production)", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getLlm()).toBeNull();
  });
});
