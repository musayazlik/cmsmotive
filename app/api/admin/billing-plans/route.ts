import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { creemMode, creemRequest } from "@/lib/creem";
import { panelStore } from "@/lib/panel-store";
const schema = z.object({
  id: z.string().optional(),
  kind: z.enum(["theme", "extension"]),
  productSlug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(80),
  priceCents: z.number().int().min(100).max(10000000),
  installations: z.number().int().min(1).max(100000),
  creemTestProductId: z
    .string()
    .regex(/^prod_[a-zA-Z0-9]+$/)
    .nullable(),
  creemLiveProductId: z
    .string()
    .regex(/^prod_[a-zA-Z0-9]+$/)
    .nullable(),
  enabled: z.boolean(),
});
export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  const storeId = (await panelStore()).id;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Check the yearly plan fields and Creem product IDs." },
      { status: 400 },
    );
  const { id, ...data } = parsed.data;
  const product =
    data.kind === "theme"
      ? await prisma.theme.findUnique({ where: { storeId_slug: { storeId, slug: data.productSlug } } })
      : await prisma.extension.findUnique({
          where: { storeId_slug: { storeId, slug: data.productSlug } },
        });
  if (!product)
    return Response.json({ error: "Product not found." }, { status: 404 });
  if (data.enabled) {
    const remoteId =
      creemMode() === "prod"
        ? data.creemLiveProductId
        : data.creemTestProductId;
    if (!remoteId)
      return Response.json(
        {
          error: "Add the Creem product ID for the current environment first.",
        },
        { status: 400 },
      );
    try {
      const remote = await creemRequest(
        `/v1/products/${encodeURIComponent(remoteId)}`,
      );
      if (
        remote.price !== data.priceCents ||
        remote.currency !== "EUR" ||
        remote.billing_period !== "every-year" ||
        remote.billing_type !== "recurring" ||
        remote.tax_mode !== "inclusive" ||
        remote.trial_period_days
      )
        return Response.json(
          {
            error:
              "Creem must use the same EUR amount, recurring every-year, tax-inclusive, with no trial.",
          },
          { status: 400 },
        );
    } catch {
      return Response.json(
        { error: "The Creem product could not be verified." },
        { status: 502 },
      );
    }
  }
  try {
    if (id) {
      const current = await prisma.billingPlan.findFirst({ where: { id, storeId } });
      if (!current)
        return Response.json({ error: "Plan not found." }, { status: 404 });
      if (
        current.kind !== data.kind ||
        current.productSlug !== data.productSlug
      )
        return Response.json(
          { error: "A plan cannot be moved to another product." },
          { status: 400 },
        );
      await prisma.billingPlan.update({ where: { id, storeId }, data });
    } else await prisma.billingPlan.create({ data: { ...data, storeId } });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error: "The plan could not be saved. Creem product IDs must be unique.",
      },
      { status: 400 },
    );
  }
}
