import { prisma } from "@/lib/prisma";
import { recaptchaSiteKey, verifyRecaptcha } from "@/lib/recaptcha";
import { isLocale } from "@/lib/i18n/config";
import { sendNotificationEmail } from "@/lib/plunk";
import { REVIEW_CAPTCHA_ACTION, REVIEW_LIMITS, publicAuthorName } from "@/lib/reviews";
import { getEmailSettings, getReviewSettings } from "@/lib/settings";
import { currentStoreId } from "@/lib/current-store";
import { VISIBLE_STATUSES } from "@/lib/catalog-guard";

export const runtime = "nodejs";

/** Newest approved reviews returned to a product page. */
const PUBLIC_LIMIT = 50;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Errors carry a stable `code` so product.js can show them in the page
 * language; `error` is the English fallback.
 */
function fail(code: string, error: string, status: number) {
  return Response.json({ code, error }, { status });
}

/** The reviewed product, listed in the store, as a ProductReview filter. */
async function findProduct(storeId: string, slug: unknown) {
  if (typeof slug !== "string" || !slug) return null;
  const product = await prisma.product.findFirst({ where: { storeId, slug, status: { in: VISIBLE_STATUSES } }, select: { id: true } });
  return product ? { productId: product.id } : null;
}

/** Approved reviews and the star summary for one product page. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const storeId = await currentStoreId();
  const product = await findProduct(storeId, params.get("product"));
  if (!product) return fail("unknown-product", "Unknown product.", 404);

  const where = { ...product, storeId, status: "approved" };
  const [reviews, groups] = await Promise.all([
    prisma.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PUBLIC_LIMIT,
      select: { id: true, authorName: true, rating: true, body: true, createdAt: true },
    }),
    prisma.productReview.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);

  // distribution[0] counts 1-star reviews, distribution[4] 5-star reviews.
  const distribution = [0, 0, 0, 0, 0];
  for (const group of groups) distribution[group.rating - 1] = group._count._all;
  const count = distribution.reduce((sum, value) => sum + value, 0);
  const total = distribution.reduce((sum, value, index) => sum + value * (index + 1), 0);

  return Response.json(
    {
      summary: { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution },
      reviews: reviews.map((review) => ({
        id: review.id,
        name: publicAuthorName(review.authorName),
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt.toISOString(),
      })),
      recaptchaSiteKey: recaptchaSiteKey(),
    },
    // Approvals show up within a minute without hammering the database.
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } },
  );
}

/**
 * Guest review submission: validated, captcha-checked and stored as pending,
 * or published straight away when Settings → Reviews auto-approves.
 */
export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return fail("invalid", "Invalid request.", 400);
  }
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

  const product = text("product");
  const name = text("name").replace(/\s+/g, " ");
  const email = text("email").toLowerCase();
  const body = text("body");
  const rating = input.rating;
  const requestKey = text("requestKey");
  const locale = isLocale(text("locale")) ? text("locale") : "de";

  const storeId = await currentStoreId();
  const target = await findProduct(storeId, product);
  if (!target) return fail("unknown-product", "Unknown product.", 404);
  // Honeypot: real visitors never see or fill the "website" field.
  if (text("website")) return fail("invalid", "Please check the form fields.", 400);
  if (
    name.length < REVIEW_LIMITS.nameMin ||
    name.length > REVIEW_LIMITS.nameMax ||
    email.length > REVIEW_LIMITS.emailMax ||
    !EMAIL.test(email) ||
    !UUID.test(requestKey)
  ) {
    return fail("invalid-identity", "Please enter your full name and a valid e-mail address.", 400);
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail("invalid-rating", "Please choose a rating from 1 to 5 stars.", 400);
  }
  if (body.length < REVIEW_LIMITS.bodyMin || body.length > REVIEW_LIMITS.bodyMax) {
    return fail("invalid-body", "Your review must be between 10 and 2,000 characters.", 400);
  }

  const settings = await getReviewSettings(storeId);
  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captcha = await verifyRecaptcha(text("captchaToken"), REVIEW_CAPTCHA_ACTION, {
    remoteIp,
    minScore: settings.minCaptchaScore,
  });
  if (!captcha.ok) {
    if (captcha.reason === "not-configured") console.error("reviews: RECAPTCHA_SECRET_KEY is not set");
    return fail("captcha", "Google reCAPTCHA could not verify you. Please try again.", 400);
  }

  const status = settings.autoApprove ? "approved" : "pending";
  let created = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Serializes submissions per address so the hourly limit cannot be raced.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const existing = await tx.productReview.findUnique({ where: { requestKey }, select: { id: true } });
      if (existing) return; // A retried request that already went through.
      const recent = await tx.productReview.count({
        where: { authorEmail: email, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
      });
      if (recent >= settings.perHour) throw new Error("rate-limit");
      await tx.productReview.create({
        data: {
          ...target,
          storeId,
          productSlug: product,
          authorName: name,
          authorEmail: email,
          rating,
          body,
          locale,
          requestKey,
          status,
          ...(settings.autoApprove ? { moderatedAt: new Date() } : {}),
        },
      });
      created = true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "rate-limit") {
      return fail("rate-limit", "Please wait a while before sending another review.", 429);
    }
    console.error("reviews: saving failed", error);
    return fail("server", "Your review could not be saved. Please try again.", 500);
  }

  if (created && (await getEmailSettings(storeId)).notifyReviews) {
    // A courtesy for the moderators: a failed mail never fails the submission.
    await sendNotificationEmail(storeId, {
      subject: `New ${rating}★ review for ${product}${status === "pending" ? " — awaiting moderation" : ""}`,
      heading: "New product review",
      rows: [
        ["Product", product],
        ["Rating", `${rating} / 5`],
        ["Name", name],
        ["Email", email],
        ["Status", status],
        ["Review", body],
      ],
      replyTo: email,
      actionPath: "/panel/reviews",
      actionText: "Open reviews",
    }).catch((error) => console.error("reviews: notification email failed", error));
  }

  // product.js shows "published" or "awaiting approval" from the status.
  return Response.json({ ok: true, status });
}
