import { describe, expect, it } from "vitest";
import { buildCsp } from "@/proxy";
import { sectionSchema, workspaceSchema } from "@/lib/workspace/storage";
import { checkMutation, clientId, hashKey, sameOrigin } from "./guard";

const h = (init: Record<string, string>) => new Headers(init);

describe("checkMutation", () => {
  const json = { "content-type": "application/json", host: "morplan.vercel.app" };

  it("accepts same-origin JSON and Origin-less JSON", () => {
    expect(checkMutation(h({ ...json, origin: "https://morplan.vercel.app" }))).toBe("ok");
    expect(checkMutation(h(json))).toBe("ok");
  });

  it("rejects a foreign or malformed Origin", () => {
    expect(checkMutation(h({ ...json, origin: "https://evil.example" }))).toBe("bad-origin");
    expect(checkMutation(h({ ...json, origin: "https://morplan.vercel.app.evil.example" }))).toBe("bad-origin");
    expect(checkMutation(h({ ...json, origin: "null" }))).toBe("bad-origin");
  });

  it("rejects simple-request content types that skip the CORS preflight", () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      expect(checkMutation(h({ host: "morplan.vercel.app", "content-type": type }))).toBe("bad-type");
    }
  });

  it("uses the forwarded host behind the proxy", () => {
    expect(sameOrigin(h({ host: "internal", "x-forwarded-host": "morplan.vercel.app", origin: "https://morplan.vercel.app" }))).toBe(true);
  });
});

describe("rate-limit keys", () => {
  it("never contain the client address and differ per bucket and salt", () => {
    const k = hashKey("ask", "203.0.113.7", "s1");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("203.0.113.7");
    expect(hashKey("share", "203.0.113.7", "s1")).not.toBe(k);
    expect(hashKey("ask", "203.0.113.7", "s2")).not.toBe(k);
  });

  it("takes the first forwarded address", () => {
    expect(clientId(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientId(h({}))).toBe("local");
  });
});

describe("buildCsp", () => {
  it("only lets nonce-tagged scripts run in production", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self';");
  });
});

describe("schemas bound untrusted input", () => {
  const section = {
    id: "204101-001-000",
    courseNo: "204101",
    title: "X",
    lec: "001",
    lab: "000",
    meetings: [{ days: ["Mo"], start: 480, end: 570 }],
    instructors: [],
  };

  it("accepts a normal section", () => expect(sectionSchema.safeParse(section).success).toBe(true));

  it("rejects oversized or malformed fields", () => {
    expect(sectionSchema.safeParse({ ...section, title: "ก".repeat(201) }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...section, id: "<script>" }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...section, instructors: Array(13).fill("a") }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...section, meetings: [{ days: ["Mo"], start: -1, end: 99999 }] }).success).toBe(false);
  });

  it("rejects a workspace with a bad term or too many plans", () => {
    const plan = { id: "A", name: "แผน A", courseNos: [], sectionIds: [] };
    const ws = { version: 1, term: "2/2569", pool: [], plans: [plan], activePlanId: "A" };
    expect(workspaceSchema.safeParse(ws).success).toBe(true);
    expect(workspaceSchema.safeParse({ ...ws, term: "'; drop table" }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...ws, plans: Array(6).fill(plan) }).success).toBe(false);
  });
});
