import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/admin-guard";
import { getAdminAccessSettings } from "@/lib/admin-access";

/** An authenticated account may learn its own destination; guests never receive the private entry. */
export async function GET() {
  const responseHeaders = { "Cache-Control": "private, no-store" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized." }, { status: 401, headers: responseHeaders });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const target = isAdminRole(user?.role) ? (await getAdminAccessSettings()).panelPath : "/";
  return Response.json({ target }, { headers: responseHeaders });
}
