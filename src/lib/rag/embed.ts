// Embedding providers. `local` runs multilingual-e5-small in-process (free,
// offline after the first model download); `gemini` calls gemini-embedding-001.
export type EmbedKind = "query" | "passage";

export interface Embedder {
  /** Stored with each vector so different models never get compared. */
  readonly model: string;
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>;
}

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

export class LocalE5Embedder implements Embedder {
  readonly model = "multilingual-e5-small-q8";

  private load(): Promise<Extractor> {
    extractorPromise ??= (async () => {
      const [{ pipeline, env }, os, path] = await Promise.all([
        import("@huggingface/transformers"),
        import("node:os"),
        import("node:path"),
      ]);
      // A fixed, writable location (the working directory is read-only on serverless hosts).
      env.cacheDir = process.env.HF_CACHE_DIR ?? path.join(os.tmpdir(), "morplan-hf");
      return (await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" })) as unknown as Extractor;
    })();
    return extractorPromise;
  }

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    const extractor = await this.load();
    // e5 models are trained with these prefixes.
    const prefixed = texts.map((t) => `${kind === "query" ? "query" : "passage"}: ${t}`);
    const out: number[][] = [];
    for (let i = 0; i < prefixed.length; i += 16) {
      const batch = await extractor(prefixed.slice(i, i + 16), { pooling: "mean", normalize: true });
      out.push(...batch.tolist());
    }
    return out;
  }
}

export class GeminiEmbedder implements Embedder {
  readonly model = "gemini-embedding-001-768";
  constructor(private apiKey: string) {}

  async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          requests: texts.slice(i, i + 100).map((text) => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
            outputDimensionality: 768,
          })),
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { embeddings: { values: number[] }[] };
      // Truncated Gemini vectors are not unit length; normalise for cosine.
      out.push(...body.embeddings.map((e) => unit(e.values)));
    }
    return out;
  }
}

function unit(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export function getEmbedder(): Embedder {
  const key = process.env.GEMINI_API_KEY;
  if (process.env.EMBEDDING_PROVIDER === "gemini" && key) return new GeminiEmbedder(key);
  return new LocalE5Embedder();
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
