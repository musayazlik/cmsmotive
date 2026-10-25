import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_GALLERY, MAX_LIST_PRICE, PRODUCT_STATUSES } from "@/lib/catalog-guard";
import { BILLING_INTERVALS, BILLING_TYPES, CURRENCIES, PRICE_LIMITS, TAX_MODES } from "@/lib/prices";
import {
  createProduct,
  deletePriceRecord,
  deleteProductRecord,
  getProduct,
  listPrices,
  listProductTypes,
  listProducts,
  savePriceRecord,
  updateProduct,
} from "../lib/catalog";
import { runTool } from "../lib/result";

const compatibilitySchema = z.object({
  area: z.string(),
  target: z.string().default(""),
  status: z.string().default(""),
});

const complianceSchema = z
  .object({
    codeLicense: z.string().max(2000).optional(),
    noticesUrl: z.string().max(2000).optional(),
    releaseVersion: z.string().max(2000).optional(),
    testedVersions: z.string().max(2000).optional(),
    serviceScope: z.string().max(2000).optional(),
    reviewed: z.boolean().optional(),
  })
  .describe("Release checklist; publishing a product requires every field to be filled in.");

const detailFields = {
  tagline: z.string().max(80).optional(),
  intro: z.string().max(400).optional(),
  highlights: z.array(z.string().max(120)).max(8).optional(),
  compatibility: z.array(compatibilitySchema).max(20).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(300).optional(),
  demoUrl: z.string().max(300).optional(),
};

const productFields = {
  status: z.enum(PRODUCT_STATUSES).optional(),
  typeId: z.string().optional().describe("ProductType id; typeKey is usually easier."),
  typeKey: z.string().optional().describe("Product type key, e.g. theme (see product_types_list)."),
  category: z.string().max(80).optional().describe("Card kicker such as an industry; empty = the type name."),
  technologies: z.array(z.string().max(40)).max(12).optional().describe("Stacks and versions it targets."),
  listPrice: z.number().int().min(0).max(MAX_LIST_PRICE).nullable().optional()
    .describe("Indicative whole-unit price before real prices exist: 0 = free, null = not set."),
  position: z.number().int().min(0).max(9999).optional().describe("Sort order in this store's catalogue."),
  compliance: complianceSchema.optional(),
  storeIds: z.array(z.string()).optional().describe("Stores to list the product in; the owning store is always kept."),
};

export function registerProductTools(server: McpServer) {
  server.registerTool(
    "product_types_list",
    {
      title: "List product types",
      description:
        "List the kinds of products the catalogue sells (theme, extension, …) with their keys, needed as typeKey or typeId when creating products.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runTool(async () => listProductTypes()),
  );

  server.registerTool(
    "products_list",
    {
      title: "List products",
      description:
        "List the products of this store with catalogue filters. Ordered like the public catalogue (this store's sort position, then creation date).",
      inputSchema: {
        q: z.string().optional().describe("Search in name, slug, summary and category."),
        status: z.array(z.enum(PRODUCT_STATUSES)).optional(),
        typeKey: z.string().optional().describe("Filter by product type key, e.g. theme."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
        orderBy: z.enum(["position", "createdAt", "updatedAt", "name"]).default("position"),
        order: z.enum(["asc", "desc"]).default("asc"),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => runTool(async () => listProducts(args)),
  );

  server.registerTool(
    "products_get",
    {
      title: "Get a product",
      description:
        "Return one product by id or slug, including its detail fields, compliance checklist, gallery, prices, releases, changelog/review counts and pending review count.",
      inputSchema: {
        id: z.string().optional(),
        slug: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => runTool(async () => getProduct(args)),
  );

  server.registerTool(
    "products_create",
    {
      title: "Create a product",
      description:
        "Create a product owned and listed by this store. name, summary, description and a product type are required. The slug is generated from the name when omitted; new products start as concept.",
      inputSchema: {
        name: z.string().min(2).max(80),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300),
        description: z.string().min(10).describe("Tiptap HTML output."),
        ...productFields,
        ...detailFields,
        coverId: z.string().nullable().optional(),
        galleryIds: z.array(z.string()).max(MAX_GALLERY).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) => runTool(async () => createProduct(args)),
  );

  server.registerTool(
    "products_update",
    {
      title: "Update a product",
      description:
        "Update any subset of a product's fields. Omitted fields keep their stored values. Pass null for listPrice or coverId to clear them; pass galleryIds to replace the gallery order and contents. Products this store only lists can be edited too, but the media library stays with the owning store.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(2).max(80).optional(),
        slug: z.string().optional(),
        summary: z.string().min(10).max(300).optional(),
        description: z.string().min(10).optional(),
        ...productFields,
        ...detailFields,
        coverId: z.string().nullable().optional(),
        galleryIds: z.array(z.string()).max(MAX_GALLERY).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const { id, ...input } = args;
        return updateProduct(id, input);
      }),
  );

  server.registerTool(
    "products_delete",
    {
      title: "Delete a product",
      description:
        "Permanently delete a product. Only the owning store can delete it, and products with orders or subscriptions are kept — set those back to concept instead. Gallery, changelog entries and reviews are removed by cascade; uploaded media stays in the library.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => runTool(async () => deleteProductRecord(args.id)),
  );

  server.registerTool(
    "prices_list",
    {
      title: "List the prices of a product",
      description:
        "List this store's prices for one product, including their Creem product ids. Prices map 1:1 to Creem products: one amount, currency and billing period each.",
      inputSchema: { productId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) => runTool(async () => listPrices(args.productId)),
  );

  server.registerTool(
    "prices_create",
    {
      title: "Create a price",
      description:
        "Add a way to buy a product in this store. amountCents is the amount in cents. Enabling a price requires a Creem product id for the current payment mode whose amount, currency, billing type and period match exactly.",
      inputSchema: {
        productId: z.string(),
        name: z.string().min(1).max(PRICE_LIMITS.name).describe("Buy panel label, e.g. \"Single site\"."),
        billingType: z.enum(BILLING_TYPES),
        interval: z.enum(BILLING_INTERVALS).optional().describe("Renewal period; required for recurring prices."),
        amountCents: z.number().int().min(0).max(PRICE_LIMITS.amountCents),
        currency: z.enum(CURRENCIES).default("EUR"),
        taxMode: z.enum(TAX_MODES).default("inclusive"),
        updatesMonths: z.number().int().min(1).max(PRICE_LIMITS.updatesMonths).nullable().optional()
          .describe("One-time purchases: months of new releases included; null = lifetime. Ignored for subscriptions."),
        seats: z.number().int().min(1).max(PRICE_LIMITS.seats).default(1).describe("Installations covered."),
        features: z.array(z.string().max(PRICE_LIMITS.feature)).max(PRICE_LIMITS.features).optional().describe("Bullet lines shown with the price."),
        creemTestProductId: z.string().optional().describe("Creem product id (prod_…) for test mode."),
        creemLiveProductId: z.string().optional().describe("Creem product id (prod_…) for live mode."),
        enabled: z.boolean().default(false).describe("Disabled prices are shown as indicative concept prices and cannot be bought."),
        position: z.number().int().min(0).max(9999).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const { productId, ...body } = args;
        return savePriceRecord(productId, null, body);
      }),
  );

  server.registerTool(
    "prices_update",
    {
      title: "Update a price",
      description:
        "Update a price of a product. Omitted fields keep their stored values. A price that has been sold cannot change its amount, currency or billing terms — create a new price instead.",
      inputSchema: {
        priceId: z.string(),
        productId: z.string().describe("The product the price belongs to."),
        name: z.string().min(1).max(PRICE_LIMITS.name).optional(),
        billingType: z.enum(BILLING_TYPES).optional(),
        interval: z.enum(BILLING_INTERVALS).nullable().optional(),
        amountCents: z.number().int().min(0).max(PRICE_LIMITS.amountCents).optional(),
        currency: z.enum(CURRENCIES).optional(),
        taxMode: z.enum(TAX_MODES).optional(),
        updatesMonths: z.number().int().min(1).max(PRICE_LIMITS.updatesMonths).nullable().optional(),
        seats: z.number().int().min(1).max(PRICE_LIMITS.seats).optional(),
        features: z.array(z.string().max(PRICE_LIMITS.feature)).max(PRICE_LIMITS.features).optional(),
        creemTestProductId: z.string().nullable().optional(),
        creemLiveProductId: z.string().nullable().optional(),
        enabled: z.boolean().optional(),
        position: z.number().int().min(0).max(9999).optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const { priceId, productId, ...body } = args;
        return savePriceRecord(productId, priceId, body);
      }),
  );

  server.registerTool(
    "prices_delete",
    {
      title: "Delete a price",
      description:
        "Delete a price. Prices that have been sold cannot be deleted; disable them instead.",
      inputSchema: { priceId: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => runTool(async () => deletePriceRecord(args.priceId)),
  );
}
