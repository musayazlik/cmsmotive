import { z } from "zod";
import { resolveRequestStore } from "./stores";
export function creemMode(): "test" | "prod" {
  return process.env.CREEM_MODE === "live" ? "prod" : "test";
}
export function creemConfigured() {
  return Boolean(process.env.CREEM_API_KEY && process.env.CREEM_WEBHOOK_SECRET);
}
/** Canonical origin of the store `request` was addressed to; checkout and email links return there. */
export async function billingOrigin(request: Request) {
  const url = new URL((await resolveRequestStore(request)).origin);
  if (
    url.protocol !== "https:" &&
    !/^(localhost|127\.0\.0\.1|.+\.localhost)$/.test(url.hostname)
  )
    throw new Error("Billing requires an HTTPS site URL.");
  return url.origin;
}
export function creemRedirect(value: unknown): string {
  const url = new URL(z.string().parse(value));
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "creem.io" || url.hostname.endsWith(".creem.io"))
  )
    throw new Error("Unexpected billing redirect.");
  return url.href;
}
export async function creemRequest(path: string, body?: unknown) {
  const key = process.env.CREEM_API_KEY;
  if (!key) throw new Error("Creem is not configured.");
  if (creemMode() === "test" && !key.startsWith("creem_test_"))
    throw new Error("Use a Creem test key in test mode.");
  if (creemMode() === "prod" && key.startsWith("creem_test_"))
    throw new Error("A test key cannot be used in live mode.");
  const response = await fetch(
    `${creemMode() === "prod" ? "https://api.creem.io" : "https://test-api.creem.io"}${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(`Creem request failed (${response.status}).`);
  return (await response.json()) as Record<string, unknown>;
}
const idOrObject = z.union([
  z.string(),
  z.object({ id: z.string() }).passthrough(),
]);
export const subscriptionSchema = z
  .object({
    id: z.string().regex(/^sub_/),
    product: idOrObject,
    customer: idOrObject,
    mode: z.enum(["test", "prod"]),
    status: z.string(),
    current_period_start_date: z.iso.datetime({ offset: true }),
    current_period_end_date: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();
export const objectId = (value: z.infer<typeof idOrObject>) =>
  typeof value === "string" ? value : value.id;
