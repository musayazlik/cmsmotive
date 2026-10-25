import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  billingOrigin,
  creemMode,
  creemRedirect,
  creemRequest,
} from "@/lib/creem";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== (await billingOrigin(request)))
    return new Response("Forbidden", { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const form = await request.formData();
  // Never accept a customer ID from the browser: the portal opens for one of the account's own customer records.
  const customer = await prisma.customer.findFirst({
    where: {
      id: String(form.get("customerId") ?? ""),
      userId: session.user.id,
      mode: creemMode(),
    },
  });
  if (!customer) return new Response("Not found", { status: 404 });
  try {
    const result = await creemRequest("/v1/customers/billing", {
      customer_id: customer.creemCustomerId,
    });
    return Response.redirect(creemRedirect(result.customer_portal_link), 303);
  } catch {
    return new Response("The billing portal is temporarily unavailable.", {
      status: 502,
    });
  }
}
