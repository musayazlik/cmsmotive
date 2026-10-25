import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLegalSettings } from "@/lib/legal";
import { legalReadiness } from "@/lib/legal-settings-shared";
import {
  billingOrigin,
  creemConfigured,
  creemMode,
  creemRedirect,
  creemRequest,
} from "@/lib/creem";
import { isLocale } from "@/lib/i18n/config";
import { safePurchaseReturn } from "@/lib/purchase-flow";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== billingOrigin())
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const form = await request.formData();
  const lang = form.get("lang");
  const locale = isLocale(typeof lang === "string" ? lang : undefined)
    ? String(lang)
    : "en";
  const finish = (url: string) =>
    request.headers.get("accept")?.includes("application/json")
      ? Response.json({ url })
      : Response.redirect(url, 303);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      {
        error: "Sign in first.",
        loginUrl: `/auth/sign-in?${new URLSearchParams({ lang: locale, next: safePurchaseReturn(form.get("returnPath")) ?? `/account/checkout?${new URLSearchParams({ plan: String(form.get("planId") ?? ""), lang: locale })}` })}`,
      },
      { status: 401 },
    );
  if (!session.user.emailVerified)
    return Response.json(
      { error: "Verify your email first.", code: "EMAIL_UNVERIFIED" },
      { status: 401 },
    );
  const testCheckout = creemMode() === "test";
  const legal = await getLegalSettings();
  if (
    !creemConfigured() ||
    (!testCheckout &&
      (legalReadiness(legal).length || !legal.salesTermsReviewed))
  )
    return Response.json(
      { error: "Checkout is not available yet." },
      { status: 503 },
    );
  if (
    form.get("terms") !== "on" ||
    form.get("renewal") !== "on" ||
    form.get("termsVersion") !== legal.termsVersion
  )
    return Response.json(
      {
        error:
          "Accept the current sales terms and annual recurring billing before continuing.",
      },
      { status: 400 },
    );
  const plan = await prisma.billingPlan.findFirst({
    where: { id: String(form.get("planId") ?? ""), enabled: true },
  });
  if (!plan) return Response.json({ error: "Unknown plan." }, { status: 404 });
  const product =
    plan.kind === "theme"
      ? await prisma.theme.findUnique({ where: { slug: plan.productSlug } })
      : await prisma.extension.findUnique({
          where: { slug: plan.productSlug },
        });
  const { readCompliance, publicationMissing } = await import(
    "@/lib/product-compliance"
  );
  if (
    !product ||
    (!testCheckout &&
      (product.status !== "published" ||
        publicationMissing(readCompliance(product.compliance)).length))
  )
    return Response.json(
      { error: "This product is not released yet." },
      { status: 409 },
    );
  if (
    !testCheckout &&
    !(await prisma.productRelease.findFirst({
      where: { kind: plan.kind, productSlug: plan.productSlug },
      select: { id: true },
    }))
  )
    return Response.json(
      { error: "This product has no downloadable release yet." },
      { status: 409 },
    );
  const productId =
    creemMode() === "prod" ? plan.creemLiveProductId : plan.creemTestProductId;
  if (!productId)
    return Response.json(
      {
        error:
          "This plan is not configured for the selected payment environment.",
      },
      { status: 503 },
    );
  const existing = await prisma.productSubscription.findFirst({
    where: {
      userId: session.user.id,
      planId: plan.id,
      mode: creemMode(),
      status: { in: ["active", "scheduled_cancel"] },
      currentPeriodEnd: { gt: new Date() },
    },
  });
  if (existing)
    return finish(`${billingOrigin()}/account/billing?lang=${locale}`);
  try {
    const remote = await creemRequest(
      `/v1/products/${encodeURIComponent(productId)}`,
    );
    if (
      remote.billing_type !== "recurring" ||
      remote.billing_period !== "every-year" ||
      remote.currency !== plan.currency ||
      remote.price !== plan.priceCents ||
      remote.status !== "active" ||
      remote.tax_mode !== "inclusive" ||
      remote.trial_period_days
    )
      return Response.json(
        {
          error:
            "The Creem product must match this yearly, tax-inclusive plan, without a trial.",
        },
        { status: 409 },
      );
    const recent = await prisma.checkoutAttempt.count({
      where: {
        userId: session.user.id,
        createdAt: { gt: new Date(Date.now() - 60000) },
      },
    });
    if (recent >= 3)
      return Response.json(
        { error: "Please wait before starting another checkout." },
        { status: 429 },
      );
    const attempt = await prisma.checkoutAttempt.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        creemProductId: productId,
        mode: creemMode(),
        termsVersion: legal.termsVersion,
        privacyVersion: legal.privacyVersion,
      },
    });
    const result = await creemRequest("/v1/checkouts", {
      request_id: attempt.id,
      product_id: productId,
      units: 1,
      customer: { email: session.user.email },
      success_url: `${billingOrigin()}/account?lang=${locale}&checkout=pending`,
      metadata: { checkoutAttemptId: attempt.id },
    });
    return finish(creemRedirect(result.checkout_url));
  } catch {
    return Response.json(
      {
        error:
          "The secure checkout could not be opened. Please try again later.",
      },
      { status: 502 },
    );
  }
}
