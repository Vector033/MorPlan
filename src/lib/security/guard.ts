import { createHash } from "node:crypto";

/**
 * The client address as Vercel reports it. Vercel overwrites
 * x-forwarded-for, so its first entry cannot be spoofed by the caller there;
 * locally it falls back to a constant.
 */
export function clientId(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

/** Salted hash so rate-limit rows never hold an IP address or user id. */
export function hashKey(bucket: string, id: string, salt = process.env.RATE_LIMIT_SALT ?? "morplan"): string {
  return createHash("sha256").update(`${salt}:${bucket}:${id}`).digest("hex");
}

/** False when the request carries an Origin header for a different host. */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * CSRF guard for state-changing API calls. Browsers always send Origin on a
 * cross-site POST/PUT, so a present-but-foreign Origin is rejected. Requiring
 * a JSON content type also forces a CORS preflight, which this app never
 * answers, so a foreign page cannot fire the request at all. Requests without
 * Origin (curl, server-to-server) carry no ambient browser cookies of a
 * victim, so they are allowed through to the normal auth and rate limits.
 */
export function checkMutation(headers: Headers): "ok" | "bad-origin" | "bad-type" {
  if (!sameOrigin(headers)) return "bad-origin";
  const type = headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return "bad-type";
  return "ok";
}
