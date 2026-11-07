// Quick check of which FreeLLMAPI models answer a Thai JSON prompt, and how fast.
// Usage: npx tsx scripts/llm-probe.mts <model> [model...]   (needs FREELLMAPI_KEY in .env.local)
import { config } from "dotenv";
import { z } from "zod";
import { freeLlm } from "../src/lib/rag/llm";

config({ path: ".env.local" });
const schema = z.object({ answer: z.string(), cited: z.array(z.number()) });
const prompt = "[1] นักศึกษาต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 จึงมีสิทธิ์สอบ\n\nคำถาม: ต้องเข้าเรียนกี่เปอร์เซ็นต์";

await Promise.all(
  process.argv.slice(2).map(async (model) => {
    const llm = freeLlm(model);
    if (!llm) throw new Error("FREELLMAPI_KEY is not set");
    const t0 = performance.now();
    try {
      const r = await llm.json({ system: "ตอบเป็นภาษาไทย อ้างอิงหมายเลขข้อความใน cited", prompt, schema });
      console.log(`${model}\t${Math.round(performance.now() - t0)} ms\t${JSON.stringify(r.data)}`);
    } catch (e) {
      console.log(`${model}\tFAIL\t${String(e).slice(0, 160)}`);
    }
  }),
);
