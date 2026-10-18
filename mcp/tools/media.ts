import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { getEmbeddedUsage, NO_EMBEDS, type EmbeddedUsage } from "@/lib/media-usage";
import { prisma } from "@/lib/prisma";
import { resolveMcpActor } from "../context";
import {
  deleteMediaRecord,
  updateMediaRecord,
  uploadMediaRecord,
} from "../lib/media";
import { iso, runTool, ToolError } from "../lib/result";

const mediaSelect = {
  id: true,
  key: true,
  url: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  alt: true,
  width: true,
  height: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  _count: {
    select: {
      themeCovers: true,
      extensionCovers: true,
      postCovers: true,
      themeGallery: true,
      extensionGallery: true,
    },
  },
} as const;

function mapMedia(
  asset: Prisma.MediaAssetGetPayload<{ select: typeof mediaSelect }>,
  embedded: Map<string, EmbeddedUsage>,
) {
  const { _count, ...row } = asset;
  return {
    ...row,
    createdAt: iso(asset.createdAt),
    usage: {
      themes: _count.themeCovers,
      extensions: _count.extensionCovers,
      posts: _count.postCovers,
      gallery: _count.themeGallery + _count.extensionGallery,
      // Placed inside post bodies / theme and extension descriptions.
      embedded: embedded.get(asset.key) ?? NO_EMBEDS,
    },
  };
}

export function registerMediaTools(server: McpServer) {
  server.registerTool(
    "media_list",
    {
      title: "List media assets",
      description:
        "List tracked media library uploads with search, file-kind filtering and usage counts. Newest uploads first.",
      inputSchema: {
        q: z.string().optional().describe("Search in file name and alt text."),
        kind: z.enum(["all", "image", "video", "other"]).default("all"),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const where: Prisma.MediaAssetWhereInput = {
          ...(args.q
            ? {
                OR: [
                  { fileName: { contains: args.q, mode: "insensitive" } },
                  { alt: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(args.kind === "image" ? { mimeType: { startsWith: "image/" } } : {}),
          ...(args.kind === "video" ? { mimeType: { startsWith: "video/" } } : {}),
          ...(args.kind === "other"
            ? {
                NOT: [
                  { mimeType: { startsWith: "image/" } },
                  { mimeType: { startsWith: "video/" } },
                ],
              }
            : {}),
        };

        const [total, assets, embedded] = await Promise.all([
          prisma.mediaAsset.count({ where }),
          prisma.mediaAsset.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: mediaSelect,
          }),
          getEmbeddedUsage(),
        ]);

        return {
          assets: assets.map((asset) => mapMedia(asset, embedded)),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "media_get",
    {
      title: "Get a media asset",
      description: "Return one media asset by id, including where it is used.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const asset = await prisma.mediaAsset.findUnique({
          where: { id: args.id },
          select: mediaSelect,
        });
        if (!asset) throw new ToolError("Media asset not found.");
        return mapMedia(asset, await getEmbeddedUsage());
      }),
  );

  server.registerTool(
    "media_update",
    {
      title: "Update media alt text",
      description: "Set or clear the alt text stored on a media asset.",
      inputSchema: {
        id: z.string(),
        alt: z.string().nullable().describe("Alt text; null or an empty string clears it."),
      },
      annotations: { destructiveHint: false },
    },
    async (args) => runTool(async () => updateMediaRecord(args.id, { alt: args.alt })),
  );

  server.registerTool(
    "media_upload",
    {
      title: "Upload a media asset",
      description:
        "Upload an image or video from a public URL, a data URL or a plain base64 payload. Images are capped at 8 MB and videos at 64 MB, matching the panel upload limits. Returns the tracked MediaAsset id that coverId and galleryIds accept.",
      inputSchema: {
        fileName: z.string().describe("File name, including the extension."),
        mimeType: z
          .string()
          .optional()
          .describe("MIME type; inferred from a data URL or the HTTP response when omitted."),
        url: z.string().url().optional().describe("Public http(s) URL to download."),
        dataUrl: z.string().optional().describe("data:image/…;base64,… payload."),
        base64: z.string().optional().describe("Plain base64 payload."),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        return uploadMediaRecord(args, actor.id);
      }),
  );

  server.registerTool(
    "media_delete",
    {
      title: "Delete a media asset",
      description:
        "Delete a file from UploadThing storage and its MediaAsset record. Gallery rows that used the file are removed and covers are cleared. Images placed inside post or description text (usage.embedded) are not removed from that text and show as broken images — check usage first.",
      inputSchema: {
        id: z.string().optional().describe("MediaAsset id."),
        key: z.string().optional().describe("UploadThing key, for files without a tracked row."),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        if (!args.id && !args.key) throw new ToolError("Provide either id or key.");
        return deleteMediaRecord({ id: args.id, key: args.key });
      }),
  );
}
