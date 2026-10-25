import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isReviewStatus, REVIEW_STATUSES } from "@/lib/reviews";
import { iso, runTool, ToolError } from "../lib/result";
import { mcpStoreId } from "@/mcp/context";

const reviewSelect = {
  id: true,
  productSlug: true,
  authorName: true,
  authorEmail: true,
  rating: true,
  body: true,
  status: true,
  locale: true,
  moderatedAt: true,
  createdAt: true,
  product: { select: { id: true, name: true, slug: true } },
} as const;

function mapReview(review: Prisma.ProductReviewGetPayload<{ select: typeof reviewSelect }>) {
  const { product, ...row } = review;
  return {
    ...row,
    product,
    moderatedAt: iso(review.moderatedAt),
    createdAt: iso(review.createdAt),
  };
}

export function registerReviewTools(server: McpServer) {
  server.registerTool(
    "reviews_list",
    {
      title: "List product reviews",
      description:
        "List guest product reviews with status and product filters. Reviews are always created as pending by the public site; this tool moderates them.",
      inputSchema: {
        status: z.enum(REVIEW_STATUSES).optional(),
        productId: z.string().optional(),
        typeKey: z.string().optional().describe("Filter by product type key, e.g. theme."),
        q: z.string().optional().describe("Search author, e-mail, product slug and body."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.ProductReviewWhereInput = {
          storeId: mcpStoreId(),
          ...(args.productId ? { productId: args.productId } : {}),
          ...(args.typeKey ? { product: { type: { key: args.typeKey } } } : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(args.q
            ? {
                OR: [
                  { authorName: { contains: args.q, mode: "insensitive" } },
                  { authorEmail: { contains: args.q, mode: "insensitive" } },
                  { productSlug: { contains: args.q, mode: "insensitive" } },
                  { body: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [total, reviews] = await Promise.all([
          prisma.productReview.count({ where }),
          prisma.productReview.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: reviewSelect,
          }),
        ]);

        return {
          reviews: reviews.map(mapReview),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "reviews_set_status",
    {
      title: "Moderate a product review",
      description:
        "Approve, reject or return a review to pending. Approved reviews appear publicly and count toward the star rating.",
      inputSchema: {
        id: z.string(),
        status: z.enum(REVIEW_STATUSES),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        if (!isReviewStatus(args.status)) throw new ToolError("Unknown review status.");
        const existing = await prisma.productReview.findFirst({
          where: { id: args.id, storeId: mcpStoreId() },
          select: { id: true },
        });
        if (!existing) throw new ToolError("Review not found.");
        await prisma.productReview.update({
          where: { id: args.id },
          data: {
            status: args.status,
            moderatedAt: args.status === "pending" ? null : new Date(),
          },
        });
        return { id: args.id, status: args.status };
      }),
  );

  server.registerTool(
    "reviews_delete",
    {
      title: "Delete a product review",
      description:
        "Permanently delete a review. Rejecting it instead keeps the moderation record.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        const existing = await prisma.productReview.findFirst({
          where: { id: args.id, storeId: mcpStoreId() },
          select: { id: true },
        });
        if (!existing) throw new ToolError("Review not found.");
        await prisma.productReview.delete({ where: { id: args.id } });
        return { id: args.id, deleted: true };
      }),
  );
}
