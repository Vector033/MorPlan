import { expect, test } from "@playwright/test";

test("pages send security headers and a nonce-based CSP", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("API rejects cross-site and non-JSON writes", async ({ request }) => {
  const body = JSON.stringify({ term: "2/2569", name: "x", sections: [] });
  const evil = await request.post("/api/share", {
    data: body,
    headers: { "content-type": "application/json", origin: "https://evil.example" },
  });
  expect(evil.status()).toBe(403);
  const form = await request.post("/api/share", { data: body, headers: { "content-type": "text/plain" } });
  expect(form.status()).toBe(415);
  const anon = await request.put("/api/workspace", { data: "{}", headers: { "content-type": "application/json" } });
  expect(anon.status()).toBe(401);
  expect((await request.post("/api/event", { data: { kind: "nope" } })).status()).toBe(400);
});

test("curriculum API rejects cross-site and non-JSON writes", async ({ request }) => {
  const body = JSON.stringify({ id: "zzzzzzzzzz" });
  for (const path of ["/api/curriculum/read", "/api/curriculum/confirm"]) {
    const evil = await request.post(path, { data: body, headers: { "content-type": "application/json", origin: "https://evil.example" } });
    expect(evil.status(), path).toBe(403);
    const form = await request.post(path, { data: body, headers: { "content-type": "text/plain" } });
    expect(form.status(), path).toBe(415);
  }
  expect((await request.get("/api/curriculum/zzzzzzzzzz")).status()).toBe(404);
});

test("signing out cannot be triggered from another site", async ({ request }) => {
  const res = await request.post("/auth/signout", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
  expect(res.status()).toBe(403);
});

test("no CSP violations while using the planner", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ลองด้วยข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("ค้นหาด้วยรหัสหรือชื่อวิชา", { exact: false }).fill("206111");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).first().click();
  await page.goto("/ask");
  await page.goto("/compare");
  expect(violations).toEqual([]);
});
