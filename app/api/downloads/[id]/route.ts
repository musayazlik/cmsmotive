import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { utapi } from "@/lib/utapi";
import { creemMode } from "@/lib/creem";
import { releaseIsIncluded } from "@/lib/billing-access";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified)
    return new Response("Unauthorized", { status: 401 });
  const release = await prisma.productRelease.findUnique({
    where: { id: (await params).id },
  });
  if (!release) return new Response("Not found", { status: 404 });
  const plans = await prisma.billingPlan.findMany({
    where: { kind: release.kind, productSlug: release.productSlug },
    select: { id: true },
  });
  const subscriptions = await prisma.productSubscription.findMany({
    where: {
      userId: session.user.id,
      mode: creemMode(),
      planId: { in: plans.map((p) => p.id) },
    },
  });
  if (!subscriptions.some((s) => releaseIsIncluded(s, release)))
    return new Response("No download entitlement", { status: 403 });
  try {
    const { ufsUrl } = await utapi.generateSignedURL(release.fileKey, {
      expiresIn: 60,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: ufsUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("The download is temporarily unavailable.", {
      status: 503,
    });
  }
}
