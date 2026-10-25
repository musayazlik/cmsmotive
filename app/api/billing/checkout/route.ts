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
import { resolveRequestStore } from "@/lib/stores";
import { creemProductMismatch } from "@/lib/prices";
import { VISIBLE_STATUSES } from "@/lib/catalog-guard";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== (await billingOrigin(request)))
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
        loginUrl: `/auth/sign-in?${new URLSearchParams({ lang: locale, next: safePurchaseReturn(form.get("returnPath")) ?? `/account/checkout?${new URLSearchParams({ price: String(form.get("priceId") ?? ""), lang: locale })}` })}`,
      },
      { status: 401 },
    );
  if (!session.user.emailVerified)
    return Response.json(
      { error: "Verify your email first.", code: "EMAIL_UNVERIFIED" },
      { status: 401 },
    );
  const testCheckout = creemMode() === "test";
  const storeId = (await resolveRequestStore(request)).store.id;
  const legal = await getLegalSettings(storeId);
  if (
    !creemConfigured() ||
    (!testCheckout &&
      (legalReadiness(legal).length || !legal.salesTermsReviewed))
  )
    return Response.json(
      { error: "Checkout is not available yet." },
      { status: 503 },
    );
  const price = await prisma.price.findFirst({
    where: {
      id: String(form.get("priceId") ?? ""),
      enabled: true,
      product: { storeId, status: { in: VISIBLE_STATUSES } },
    },
    include: { product: true },
  });
  if (!price) return Response.json({ error: "Unknown price." }, { status: 404 });
  const recurring = price.billingType === "recurring";
  if (
    form.get("terms") !== "on" ||
    (recurring && form.get("renewal") !== "on") ||
    form.get("termsVersion") !== legal.termsVersion
  )
    return Response.json(
      {
        error: recurring
          ? "Accept the current sales terms and the recurring billing before continuing."
          : "Accept the current sales terms before continuing.",
      },
      { status: 400 },
    );
  const { product } = price;
  const { readCompliance, publicationMissing } = await import(
    "@/lib/product-compliance"
  );
  if (
    !testCheckout &&
    (product.status !== "published" ||
      publicationMissing(readCompliance(product.compliance)).length)
  )
    return Response.json(
      { error: "This product is not released yet." },
      { status: 409 },
    );
  if (
    !testCheckout &&
    !(await prisma.productRelease.findFirst({
      where: { productId: product.id },
      select: { id: true },
    }))
  )
    return Response.json(
      { error: "This product has no downloadable release yet." },
      { status: 409 },
    );
  const productId =
    creemMode() === "prod" ? price.creemLiveProductId : price.creemTestProductId;
  if (!productId)
    return Response.json(
      {
        error:
          "This price is not configured for the selected payment environment.",
      },
      { status: 503 },
    );
  // Already covered: a running subscription to this price, or a one-time purchase that still receives updates.
  const owned = recurring
    ? await prisma.subscription.findFirst({
        where: {
          priceId: price.id,
          mode: creemMode(),
          customer: { userId: session.user.id },
          status: { in: ["active", "scheduled_cancel", "trialing"] },
          currentPeriodEnd: { gt: new Date() },
        },
        select: { id: true },
      })
    : await prisma.entitlement.findFirst({
        where: {
          productId: product.id,
          storeId,
          orderId: { not: null },
          revokedAt: null,
          customer: { userId: session.user.id, mode: creemMode() },
          OR: [{ updatesUntil: null }, { updatesUntil: { gt: new Date() } }],
        },
        select: { id: true },
      });
  if (owned)
    return finish(`${await billingOrigin(request)}/account?lang=${locale}`);
  try {
    const remote = await creemRequest(
      `/v1/products/${encodeURIComponent(productId)}`,
    );
    const mismatch = creemProductMismatch(remote, price);
    if (mismatch)
      return Response.json(
        { error: `The Creem product does not match this price: ${mismatch}` },
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
        storeId,
        priceId: price.id,
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
      success_url: `${await billingOrigin(request)}/account?lang=${locale}&checkout=pending`,
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
