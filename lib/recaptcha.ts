/**
 * Google reCAPTCHA v3 verification. The browser earns a token for a named
 * action; Google confirms the token and returns a 0–1 score. Product reviews
 * are open to guests, so verification is mandatory there: a missing secret
 * fails closed instead of letting unverified submissions through.
 */

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export type RecaptchaResult = { ok: true } | { ok: false; reason: string };

/** Public site key, handed to the static pages through the reviews API. */
export function recaptchaSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
}

/** `minScore` is the lowest accepted score; reviews read it from Settings → Reviews. */
export async function verifyRecaptcha(
  token: string,
  action: string,
  options: { remoteIp?: string; minScore: number },
): Promise<RecaptchaResult> {
  const { remoteIp, minScore } = options;
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: false, reason: "not-configured" };
  if (!token) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, reason: `verify-http-${response.status}` };
    const result = (await response.json()) as { success?: boolean; score?: number; action?: string; "error-codes"?: string[] };
    if (!result.success) return { ok: false, reason: result["error-codes"]?.join(",") || "verification-failed" };
    if (result.action !== action) return { ok: false, reason: "action-mismatch" };
    if (typeof result.score !== "number" || result.score < minScore) return { ok: false, reason: "low-score" };
    return { ok: true };
  } catch (error) {
    console.error("recaptcha: verification request failed", error);
    return { ok: false, reason: "verify-unreachable" };
  }
}
