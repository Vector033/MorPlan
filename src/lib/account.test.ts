import { describe, expect, it } from "vitest";
import { confirmsDeletion, initialOf, passwordChangeSchema, safeNext, signInMethods } from "./account";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/account?tab=security")).toBe("/account?tab=security");
  });
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "falls back to / for %s",
    (next) => expect(safeNext(next)).toBe("/"),
  );
});

describe("signInMethods", () => {
  it("lists known providers in a fixed order", () => {
    expect(signInMethods([{ provider: "google" }, { provider: "email" }, { provider: "github" }])).toEqual(["email", "google"]);
    expect(signInMethods(undefined)).toEqual([]);
  });
});

describe("initialOf", () => {
  it("prefers the name, then the email", () => {
    expect(initialOf("  นวัต ", "a@b.c")).toBe("น");
    expect(initialOf("", "student@example.com")).toBe("S");
  });
});

describe("passwordChangeSchema", () => {
  const withPassword = passwordChangeSchema(true);
  it("needs the current password when one exists", () => {
    const r = withPassword.safeParse({ current: "", next: "new-pass-123", confirm: "new-pass-123" });
    expect(r.success).toBe(false);
  });
  it("rejects a mismatched confirmation", () => {
    const r = withPassword.safeParse({ current: "old-pass-123", next: "new-pass-123", confirm: "new-pass-124" });
    expect(r.success && "ok").toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });
  it("rejects reusing the current password", () => {
    const r = withPassword.safeParse({ current: "same-pass-123", next: "same-pass-123", confirm: "same-pass-123" });
    expect(r.error?.issues[0].path).toEqual(["next"]);
  });
  it("rejects short and over-long passwords", () => {
    expect(withPassword.safeParse({ current: "x", next: "short", confirm: "short" }).success).toBe(false);
    const long = "a".repeat(73);
    expect(withPassword.safeParse({ current: "x", next: long, confirm: long }).success).toBe(false);
  });
  it("lets a Google-only account set a first password without a current one", () => {
    expect(passwordChangeSchema(false).safeParse({ next: "first-pass-1", confirm: "first-pass-1" }).success).toBe(true);
  });
});

describe("confirmsDeletion", () => {
  it("matches the account email, ignoring case and spaces", () => {
    expect(confirmsDeletion(" Student@Example.com ", "student@example.com")).toBe(true);
    expect(confirmsDeletion("other@example.com", "student@example.com")).toBe(false);
    expect(confirmsDeletion(undefined, "student@example.com")).toBe(false);
    expect(confirmsDeletion("", "")).toBe(false);
  });
});
