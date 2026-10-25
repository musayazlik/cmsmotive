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
export async function creemRequest(path: string, body?: unknown, headers?: Record<string, string>, method?: "POST" | "PATCH") {
  const key = process.env.CREEM_API_KEY;
  if (!key) throw new Error("Creem is not configured.");
  if (creemMode() === "test" && !key.startsWith("creem_test_"))
    throw new Error("Use a Creem test key in test mode.");
  if (creemMode() === "prod" && key.startsWith("creem_test_"))
    throw new Error("A test key cannot be used in live mode.");
  const response = await fetch(
    `${creemMode() === "prod" ? "https://api.creem.io" : "https://test-api.creem.io"}${path}`,
    {
      method: body === undefined ? "GET" : (method ?? "POST"),
      headers: { "x-api-key": key, "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    // Creem's error bodies carry a human-readable reason; surface it so the panel can show it.
    const details = (await response.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
    const reason =
      typeof details?.message === "string" ? details.message : typeof details?.error === "string" ? details.error : null;
    throw new Error(reason ? `Creem request failed (${response.status}): ${reason}` : `Creem request failed (${response.status}).`);
  }
  return (await response.json()) as Record<string, unknown>;
}
const idOrObject = z.union([
  z.string(),
  z.object({ id: z.string() }).passthrough(),
]);
export const objectId = (value: z.infer<typeof idOrObject>) =>
  typeof value === "string" ? value : value.id;

/** Creem reports test-mode objects as test, sandbox or local; only prod is live. */
export function normalizeMode(mode: unknown): "test" | "prod" {
  return mode === "prod" ? "prod" : "test";
}
const mode = z.string().transform(normalizeMode);
const isoDate = z.iso.datetime({ offset: true });
/** Unix milliseconds or an ISO date, as Creem uses both. */
const timestamp = z.union([z.number(), isoDate]).transform((value) => new Date(value));

export const subscriptionSchema = z
  .object({
    id: z.string().regex(/^sub_/),
    product: idOrObject,
    customer: idOrObject,
    mode,
    status: z.string(),
    last_transaction_id: z.string().nullish(),
    current_period_start_date: isoDate,
    current_period_end_date: isoDate,
    canceled_at: isoDate.nullish(),
    updated_at: isoDate,
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();
export type CreemSubscription = z.infer<typeof subscriptionSchema>;

export const customerSchema = z
  .object({
    id: z.string(),
    email: z.string().nullish(),
    name: z.string().nullish(),
    country: z.string().nullish(),
  })
  .passthrough();

export const licenseKeySchema = z
  .object({
    id: z.string(),
    key: z.string(),
    status: z.string(),
    activation: z.number().int().default(0),
    activation_limit: z.number().int().nullish(),
    expires_at: isoDate.nullish(),
    mode,
  })
  .passthrough();

export const orderSchema = z
  .object({
    id: z.string().regex(/^ord_/),
    customer: idOrObject,
    product: idOrObject,
    amount: z.number().int(),
    currency: z.string(),
    status: z.string(),
    type: z.string(),
    created_at: isoDate,
    mode,
  })
  .passthrough();

export const checkoutSchema = z
  .object({
    id: z.string(),
    request_id: z.string().nullish(),
    status: z.string(),
    mode,
    order: orderSchema,
    customer: z.union([z.string(), customerSchema]),
    subscription: idOrObject.nullish(),
    license_keys: z.array(licenseKeySchema).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();
export type CreemCheckout = z.infer<typeof checkoutSchema>;

export const transactionSchema = z
  .object({
    id: z.string().regex(/^tran_/),
    amount: z.number().int(),
    amount_paid: z.number().int().nullish(),
    discount_amount: z.number().int().nullish(),
    tax_amount: z.number().int().nullish(),
    refunded_amount: z.number().int().nullish(),
    currency: z.string(),
    type: z.string(),
    status: z.string(),
    tax_country: z.string().nullish(),
    order: z.string().nullish(),
    subscription: z.string().nullish(),
    customer: z.string().nullish(),
    description: z.string().nullish(),
    period_start: timestamp.nullish(),
    period_end: timestamp.nullish(),
    created_at: timestamp,
    mode,
  })
  .passthrough();
export type CreemTransaction = z.infer<typeof transactionSchema>;

/** Every transaction Creem lists for a filter (order, customer, product), first pages only. */
export async function searchTransactions(filter: Record<string, string>, pages = 3): Promise<CreemTransaction[]> {
  const found: CreemTransaction[] = [];
  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({ ...filter, page_number: String(page), page_size: "50" });
    const result = await creemRequest(`/v1/transactions/search?${query}`);
    const items = Array.isArray(result.items) ? result.items : [];
    for (const item of items) {
      const parsed = transactionSchema.safeParse(item);
      if (parsed.success) found.push(parsed.data);
    }
    const pagination = result.pagination as { next_page?: number | null } | undefined;
    if (!pagination?.next_page) break;
  }
  return found;
}
