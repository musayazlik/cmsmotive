import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isPostStatus, POST_STATUSES, type PostStatus } from "@/app/panel/blog/_lib";
import { resolveMcpActor } from "../context";
import {
  deletePostRecord,
  publishDuePosts,
  savePostRecord,
  setPostStatusRecord,
} from "../lib/posts";
import { iso, ToolError, runTool } from "../lib/result";

const postSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  status: true,
  featured: true,
  scheduledAt: true,
  publishedAt: true,
  readingTime: true,
  createdAt: true,
  updatedAt: true,
  cover: { select: { id: true, url: true, fileName: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  author: { select: { id: true, name: true, email: true } },
} as const;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

function mapPost(post: PostRow) {
  return {
    ...post,
    tags: post.tags.map((entry) => entry.tag),
    scheduledAt: iso(post.scheduledAt),
    publishedAt: iso(post.publishedAt),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

const pageSizeSchema = z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20);

export function registerPostTools(server: McpServer) {
  server.registerTool(
    "blog_posts_list",
    {
      title: "List blog posts",
      description:
        "List blog posts with optional search, status, category, tag and featured filters. Scheduled posts whose time has passed are published before the list is returned, matching the panel.",
      inputSchema: {
        q: z.string().optional().describe("Search in title, slug and excerpt."),
        status: z.enum(POST_STATUSES).optional(),
        categoryId: z.string().optional(),
        tagId: z.string().optional(),
        featured: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: pageSizeSchema,
        orderBy: z
          .enum(["updatedAt", "createdAt", "publishedAt", "title"])
          .default("updatedAt"),
        order: z.enum(["asc", "desc"]).default("desc"),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        await publishDuePosts();

        const where: Prisma.PostWhereInput = {
          ...(args.q
            ? {
                OR: [
                  { title: { contains: args.q, mode: "insensitive" } },
                  { slug: { contains: args.q, mode: "insensitive" } },
                  { excerpt: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(args.categoryId ? { categoryId: args.categoryId } : {}),
          ...(args.tagId ? { tags: { some: { tagId: args.tagId } } } : {}),
          ...(args.featured !== undefined ? { featured: args.featured } : {}),
        };

        const orderBy = {
          [args.orderBy]: args.order,
        } as Prisma.PostOrderByWithRelationInput;

        const [total, posts] = await Promise.all([
          prisma.post.count({ where }),
          prisma.post.findMany({
            where,
            orderBy,
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: postSelect,
          }),
        ]);

        return {
          posts: posts.map(mapPost),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "blog_posts_get",
    {
      title: "Get a blog post",
      description: "Return one blog post by id, including its full HTML content, category, tags and cover.",
      inputSchema: {
        id: z.string().describe("Post id (cuid)."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const post = await prisma.post.findUnique({
          where: { id: args.id },
          select: { ...postSelect, content: true },
        });
        if (!post) throw new ToolError("Post could not be found.");
        return mapPost(post);
      }),
  );

  server.registerTool(
    "blog_posts_create",
    {
      title: "Create a blog post",
      description:
        "Create a blog post. Publishing or scheduling requires a category and at least one tag. HTML content is expected in the same Tiptap HTML format the panel editor stores.",
      inputSchema: {
        title: z.string().max(60).describe("Post title, at most 60 characters."),
        slug: z.string().optional().describe("Slug; generated from the title when omitted."),
        excerpt: z.string().optional().describe("Teaser and SEO description, at most 160 characters."),
        content: z.string().optional().describe("Tiptap HTML content."),
        coverId: z.string().nullable().optional(),
        status: z.enum(POST_STATUSES).default("draft"),
        scheduledAt: z
          .string()
          .nullable()
          .optional()
          .describe("ISO date/time; required when status is scheduled."),
        featured: z.boolean().default(false),
        categoryId: z.string().nullable().optional(),
        tagIds: z.array(z.string()).default([]),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        return savePostRecord(
          {
            title: args.title,
            slug: args.slug ?? "",
            excerpt: args.excerpt ?? "",
            content: args.content ?? "",
            coverId: args.coverId ?? null,
            status: args.status,
            scheduledAt: args.scheduledAt ?? null,
            featured: args.featured,
            categoryId: args.categoryId ?? null,
            tagIds: args.tagIds,
          },
          actor.id,
        );
      }),
  );

  server.registerTool(
    "blog_posts_update",
    {
      title: "Update a blog post",
      description:
        "Update any subset of a blog post's fields. Omitted fields keep their stored values; provide tagIds to replace the tag set.",
      inputSchema: {
        id: z.string(),
        title: z.string().max(60).optional(),
        slug: z.string().optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        coverId: z.string().nullable().optional(),
        status: z.enum(POST_STATUSES).optional(),
        scheduledAt: z.string().nullable().optional(),
        featured: z.boolean().optional(),
        categoryId: z.string().nullable().optional(),
        tagIds: z.array(z.string()).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        await publishDuePosts();
        const actor = await resolveMcpActor();
        const existing = await prisma.post.findUnique({
          where: { id: args.id },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            content: true,
            coverId: true,
            status: true,
            scheduledAt: true,
            featured: true,
            categoryId: true,
            tags: { select: { tagId: true } },
          },
        });
        if (!existing) throw new ToolError("Post could not be found.");
        if (!isPostStatus(existing.status)) {
          throw new ToolError("The stored post has an unknown status.");
        }

        const status: PostStatus = args.status ?? existing.status;
        const scheduledAt =
          args.scheduledAt !== undefined
            ? args.scheduledAt
            : status === "scheduled"
              ? existing.scheduledAt?.toISOString() ?? null
              : null;

        return savePostRecord(
          {
            id: args.id,
            title: args.title ?? existing.title,
            slug: args.slug ?? existing.slug,
            excerpt: args.excerpt ?? existing.excerpt,
            content: args.content ?? existing.content,
            coverId: args.coverId !== undefined ? args.coverId : existing.coverId,
            status,
            scheduledAt,
            featured: args.featured ?? existing.featured,
            categoryId: args.categoryId !== undefined ? args.categoryId : existing.categoryId,
            tagIds: args.tagIds ?? existing.tags.map((entry) => entry.tagId),
          },
          actor.id,
        );
      }),
  );

  server.registerTool(
    "blog_posts_set_status",
    {
      title: "Publish or unpublish a blog post",
      description:
        "Quickly publish or move a post back to draft. Publishing requires a category and at least one tag. Use blog_posts_update for scheduled publishing.",
      inputSchema: {
        id: z.string(),
        status: z.enum(["draft", "published"]),
      },
      annotations: { destructiveHint: false },
    },
    async (args) => runTool(async () => setPostStatusRecord(args.id, args.status)),
  );

  server.registerTool(
    "blog_posts_delete",
    {
      title: "Delete a blog post",
      description: "Permanently delete a blog post. This cannot be undone.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => runTool(async () => deletePostRecord(args.id)),
  );
}
