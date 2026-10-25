import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  billingOrigin,
  creemMode,
  creemRedirect,
  creemRequest,
} from "@/lib/creem";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== billingOrigin())
    return new Response("Forbidden", { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const form = await request.formData();
  // Never accept a customer ID from the browser.
  const subscription = await prisma.productSubscription.findFirst({
    where: {
      id: String(form.get("subscriptionId") ?? ""),
      userId: session.user.id,
      mode: creemMode(),
    },
  });
  if (!subscription) return new Response("Not found", { status: 404 });
  try {
    const result = await creemRequest("/v1/customers/billing", {
      customer_id: subscription.creemCustomerId,
    });
    return Response.redirect(creemRedirect(result.customer_portal_link), 303);
  } catch {
    return new Response("The billing portal is temporarily unavailable.", {
      status: 502,
    });
  }
}
