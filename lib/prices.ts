import type { ValidationResult } from "./catalog-guard";

/**
 * Client-safe contract for prices. A Price maps 1:1 to a Creem product: Creem
 * products carry exactly one amount, currency, billing type and period, so a
 * product sold monthly and yearly needs two prices (and two Creem products).
 */

export const BILLING_TYPES = ["onetime", "recurring"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const BILLING_INTERVALS = ["month", "quarter", "half-year", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Creem `billing_period` for each interval. */
export const CREEM_BILLING_PERIOD: Record<BillingInterval, string> = {
  month: "every-month",
  quarter: "every-three-months",
  "half-year": "every-six-months",
  year: "every-year",
};

export const TAX_MODES = ["inclusive", "exclusive"] as const;
export type TaxMode = (typeof TAX_MODES)[number];

export const CURRENCIES = ["EUR", "USD"] as const;

export const INTERVAL_LABELS: Record<BillingInterval, { adjective: string; per: string; months: number }> = {
  month: { adjective: "Monthly", per: "month", months: 1 },
  quarter: { adjective: "Quarterly", per: "3 months", months: 3 },
  "half-year": { adjective: "Every 6 months", per: "6 months", months: 6 },
  year: { adjective: "Yearly", per: "year", months: 12 },
};

export const PRICE_LIMITS = { name: 60, features: 8, feature: 120, amountCents: 10_000_000, seats: 100_000, updatesMonths: 120 } as const;

export function isBillingType(value: unknown): value is BillingType {
  return typeof value === "string" && (BILLING_TYPES as readonly string[]).includes(value);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

export type PriceFields = {
  name: string;
  billingType: BillingType;
  interval: BillingInterval | null;
  amountCents: number;
  currency: string;
  taxMode: TaxMode;
  updatesMonths: number | null;
  seats: number;
  features: string[];
  /** On sale: the save creates or updates its Creem product. */
  enabled: boolean;
  position: number;
  /** Optional: an existing Creem product (current payment mode) to link instead of creating one. */
  creemProductId: string | null;
};

const CREEM_PRODUCT = /^prod_[A-Za-z0-9]+$/;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const integer = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

export function validatePrice(body: Record<string, unknown>): ValidationResult<PriceFields> {
  const name = text(body.name);
  if (!name || name.length > PRICE_LIMITS.name) return { error: `Give the price a name of at most ${PRICE_LIMITS.name} characters.` };
  if (!isBillingType(body.billingType)) return { error: "Choose one-time or subscription billing." };
  const billingType = body.billingType;
  const interval = billingType === "recurring" ? body.interval : null;
  if (billingType === "recurring" && !isBillingInterval(interval)) return { error: "Choose how often the subscription renews." };

  const amountCents = integer(body.amountCents);
  if (amountCents === null || !Number.isInteger(amountCents) || amountCents < 0 || amountCents > PRICE_LIMITS.amountCents) {
    return { error: "Enter the amount in cents as a whole number." };
  }
  const currency = text(body.currency).toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: `Currency must be one of: ${CURRENCIES.join(", ")}.` };
  const taxMode = (TAX_MODES as readonly string[]).includes(text(body.taxMode)) ? (text(body.taxMode) as TaxMode) : "inclusive";

  const updatesMonths = billingType === "onetime" ? integer(body.updatesMonths) : null;
  if (updatesMonths !== null && (!Number.isInteger(updatesMonths) || updatesMonths < 1 || updatesMonths > PRICE_LIMITS.updatesMonths)) {
    return { error: `Included updates must be 1–${PRICE_LIMITS.updatesMonths} months, or empty for lifetime updates.` };
  }
  const seats = integer(body.seats) ?? 1;
  if (!Number.isInteger(seats) || seats < 1 || seats > PRICE_LIMITS.seats) return { error: "Installations covered must be a whole number of at least 1." };

  const rawFeatures = Array.isArray(body.features) ? body.features : text(body.features).split("\n");
  const features = rawFeatures.map(text).filter(Boolean);
  if (features.length > PRICE_LIMITS.features || features.some((line) => line.length > PRICE_LIMITS.feature)) {
    return { error: `Add at most ${PRICE_LIMITS.features} feature lines of up to ${PRICE_LIMITS.feature} characters.` };
  }

  const creemProductId = text(body.creemProductId) || null;
  if (creemProductId && !CREEM_PRODUCT.test(creemProductId)) return { error: "Creem product IDs start with prod_." };
  const position = integer(body.position) ?? 0;
  if (!Number.isInteger(position) || position < 0 || position > 9999) return { error: "Sort order must be a whole number between 0 and 9999." };

  return {
    data: {
      name, billingType, interval: interval as BillingInterval | null, amountCents, currency, taxMode, updatesMonths, seats, features,
      enabled: body.enabled === true, position, creemProductId,
    },
  };
}

/** `€269.00`, `$49.00` in the page language. */
export function formatAmount(amountCents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: amountCents % 100 ? 2 : 0 }).format(amountCents / 100);
}

/** "/ year", "/ 3 months" or "" for one-time prices. */
export function billingSuffix(price: { billingType: string; interval: string | null }): string {
  return price.billingType === "recurring" && isBillingInterval(price.interval) ? `/ ${INTERVAL_LABELS[price.interval].per}` : "";
}

/** Short panel description: "Yearly subscription", "One-time · 12 months of updates". */
export function describeBilling(price: { billingType: string; interval: string | null; updatesMonths?: number | null }): string {
  if (price.billingType === "recurring") return `${isBillingInterval(price.interval) ? INTERVAL_LABELS[price.interval].adjective : "Recurring"} subscription`;
  return price.updatesMonths ? `One-time · ${price.updatesMonths} months of updates` : "One-time · lifetime updates";
}

/** Whether a Creem product (GET /v1/products/:id) matches a price exactly; returns the mismatch, or null. */
export function creemProductMismatch(
  remote: Record<string, unknown>,
  price: { billingType: string; interval: string | null; amountCents: number; currency: string; taxMode: string },
): string | null {
  if (remote.status !== undefined && remote.status !== "active") return "The Creem product is not active.";
  if (remote.billing_type !== price.billingType) return `Creem bills this product as ${String(remote.billing_type)}, the price is ${price.billingType}.`;
  if (price.billingType === "recurring" && isBillingInterval(price.interval) && remote.billing_period !== CREEM_BILLING_PERIOD[price.interval]) {
    return `Creem renews ${String(remote.billing_period)}, the price renews ${CREEM_BILLING_PERIOD[price.interval]}.`;
  }
  if (remote.price !== price.amountCents || remote.currency !== price.currency) return "The Creem amount or currency differs from the price.";
  if (remote.tax_mode !== undefined && remote.tax_mode !== price.taxMode) return `Creem uses tax mode ${String(remote.tax_mode)}, the price uses ${price.taxMode}.`;
  if (remote.trial_period_days) return "Trials are not supported; remove the trial in Creem.";
  return null;
}
