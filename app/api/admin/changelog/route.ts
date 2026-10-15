import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { validateChangelog } from "@/lib/catalog-guard";
import { prismaErrors } from "@/lib/prisma-errors";
import { productExists } from "@/lib/changelog";

export const runtime = "nodejs";

const productSelect = { select: { id: true, name: true, slug: true } } as const;

/** "theme:<id>", "extension:<id>", "type:theme" or "type:extension" → a Prisma filter. */
function productFilter(value: string | null) {
  if (value === "type:theme") return { themeId: { not: null } };
  if (value === "type:extension") return { extensionId: { not: null } };
  const match = value?.match(/^(theme|extension):(\S+)$/);
  if (!match) return {};
  return match[1] === "theme" ? { themeId: match[2] } : { extensionId: match[2] };
}

/** GET /api/admin/changelog?product=&q=&page=&pageSize= — newest entries first. */
export async function GET(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = [20, 50, 100].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 20;

  const where = {
    ...productFilter(params.get("product")),
    ...(q
      ? {
          OR: [
            { version: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { theme: { name: { contains: q, mode: "insensitive" as const } } },
            { extension: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.changelogEntry.count({ where }),
    prisma.changelogEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, version: true, title: true, releasedAt: true, changes: true, createdAt: true,
        theme: productSelect,
        extension: productSelect,
      },
    }),
  ]);

  return Response.json({
    entries: entries.map(({ theme, extension, changes, ...entry }) => ({
      ...entry,
      product: theme ? { type: "theme", ...theme } : extension ? { type: "extension", ...extension } : null,
      changeCount: Array.isArray(changes) ? changes.length : 0,
      releasedAt: entry.releasedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/admin/changelog */
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const validated = validateChangelog(body);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });
  if (!(await productExists(validated.data))) {
    return Response.json({ error: "The chosen theme or extension no longer exists." }, { status: 400 });
  }

  try {
    const entry = await prisma.changelogEntry.create({ data: validated.data, select: { id: true } });
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    return prismaErrors(error, "The changelog entry could not be created.") ?? Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
