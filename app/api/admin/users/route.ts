import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { EMAIL_PATTERN, USER_ROLES, isUserRole, requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

const PAGE_SIZES = [20, 50, 100];
const CREDENTIAL_PROVIDER = "credential";

/** GET /api/admin/users?q=&role=&joinedFrom=&page=&pageSize= */
export async function GET(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();

  const pageParam = Number(params.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const pageSizeParam = Number(params.get("pageSize"));
  const pageSize = PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : PAGE_SIZES[0];

  const roleParam = params.get("role") ?? "";
  const joinedFrom = (params.get("joinedFrom") ?? "").trim();
  let joinedAfter: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(joinedFrom)) {
    const date = new Date(`${joinedFrom}T00:00:00`);
    if (!Number.isNaN(date.getTime())) joinedAfter = date;
  }

  const where = {
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
      : {}),
    ...(isUserRole(roleParam) ? { role: roleParam } : {}),
    ...(joinedAfter ? { createdAt: { gte: joinedAfter } } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return Response.json({
    users: users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/admin/users */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return Response.json({ error: "Please provide a valid e-mail address." }, { status: 400 });
  }
  if (!isUserRole(role)) {
    return Response.json({ error: `Role must be one of: ${USER_ROLES.join(", ")}.` }, { status: 400 });
  }
  if (password.length > 0 && password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters, or left empty." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json({ error: "A user with this e-mail address already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { id: crypto.randomUUID(), name, email, role, emailVerified: true },
    select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
  });

  if (password.length > 0) {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER,
        userId: user.id,
        password: await hashPassword(password),
      },
    });
  }

  return Response.json({ user: { ...user, createdAt: user.createdAt.toISOString() } }, { status: 201 });
}
