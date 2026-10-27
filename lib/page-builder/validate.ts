import { z } from "zod";
import { containerPropsSchema, type ContainerProps } from "./blocks/container/schema";
import { gridPropsSchema, type GridProps } from "./blocks/grid/schema";
import { sectionPropsSchema, type SectionProps } from "./blocks/section/schema";
import { stackPropsSchema, type StackProps } from "./blocks/stack/schema";
import { spacerPropsSchema, type SpacerProps } from "./blocks/spacer/schema";
import { dividerPropsSchema, type DividerProps } from "./blocks/divider/schema";
import { headingPropsSchema, type HeadingProps } from "./blocks/heading/schema";
import { textPropsSchema, type TextProps } from "./blocks/text/schema";
import { buttonPropsSchema, type ButtonProps } from "./blocks/button/schema";
import { imagePropsSchema, type ImageProps } from "./blocks/image/schema";
import { videoPropsSchema, type VideoProps } from "./blocks/video/schema";
import { iconPropsSchema, type IconProps } from "./blocks/icon/schema";
import { listPropsSchema, type ListProps } from "./blocks/list/schema";
import { productGridPropsSchema, type ProductGridProps } from "./blocks/product-grid/schema";
import { productSpotlightPropsSchema, type ProductSpotlightProps } from "./blocks/product-spotlight/schema";
import { pricingTablePropsSchema, type PricingTableProps } from "./blocks/pricing-table/schema";
import { reviewListPropsSchema, type ReviewListProps } from "./blocks/review-list/schema";
import { latestPostsPropsSchema, type LatestPostsProps } from "./blocks/latest-posts/schema";
import { heroPropsSchema, type HeroProps } from "./blocks/hero/schema";
import { featureGridPropsSchema, type FeatureGridProps } from "./blocks/feature-grid/schema";
import { statsPropsSchema, type StatsProps } from "./blocks/stats/schema";
import { logoCloudPropsSchema, type LogoCloudProps } from "./blocks/logo-cloud/schema";
import { testimonialsPropsSchema, type TestimonialsProps } from "./blocks/testimonials/schema";
import { faqPropsSchema, type FAQProps } from "./blocks/faq/schema";
import { ctaPropsSchema, type CTAProps } from "./blocks/cta/schema";
import { comparisonTablePropsSchema, type ComparisonTableProps } from "./blocks/comparison-table/schema";
import { stepsPropsSchema, type StepsProps } from "./blocks/steps/schema";
import { newsletterPropsSchema, type NewsletterProps } from "./blocks/newsletter/schema";
import { contactPropsSchema, type ContactProps } from "./blocks/contact/schema";
import { PAGE_BUILDER_BLOCK_TYPES, isPageBuilderBlockType, slotFieldsOf, type PageBuilderBlockType } from "./slots";

/**
 * Document validation (plan 5.13): every block — including blocks nested in
 * the slot props declared in slots.ts — must carry a known type and props
 * that match its schema. Unknown keys, unknown block types, hostile style
 * values, duplicate block ids, unexpected root props and legacy DropZone data
 * are refused. Content cleaning is sanitize.ts's job (see document.ts).
 */

export { PAGE_BUILDER_BLOCK_TYPES, type PageBuilderBlockType };

export type UserBlocks = {
  ContainerBlock: ContainerProps;
  GridBlock: GridProps;
  SectionBlock: SectionProps;
  StackBlock: StackProps;
  SpacerBlock: SpacerProps;
  DividerBlock: DividerProps;
  HeadingBlock: HeadingProps;
  TextBlock: TextProps;
  ButtonBlock: ButtonProps;
  ImageBlock: ImageProps;
  VideoBlock: VideoProps;
  IconBlock: IconProps;
  ListBlock: ListProps;
  ProductGridBlock: ProductGridProps;
  ProductSpotlightBlock: ProductSpotlightProps;
  PricingTableBlock: PricingTableProps;
  ReviewListBlock: ReviewListProps;
  LatestPostsBlock: LatestPostsProps;
  HeroBlock: HeroProps;
  FeatureGridBlock: FeatureGridProps;
  StatsBlock: StatsProps;
  LogoCloudBlock: LogoCloudProps;
  TestimonialsBlock: TestimonialsProps;
  FAQBlock: FAQProps;
  CTABlock: CTAProps;
  ComparisonTableBlock: ComparisonTableProps;
  StepsBlock: StepsProps;
  NewsletterBlock: NewsletterProps;
  ContactBlock: ContactProps;
};

const PROPS_SCHEMAS: Record<PageBuilderBlockType, z.ZodType> = {
  ContainerBlock: containerPropsSchema,
  GridBlock: gridPropsSchema,
  SectionBlock: sectionPropsSchema,
  StackBlock: stackPropsSchema,
  SpacerBlock: spacerPropsSchema,
  DividerBlock: dividerPropsSchema,
  HeadingBlock: headingPropsSchema,
  TextBlock: textPropsSchema,
  ButtonBlock: buttonPropsSchema,
  ImageBlock: imagePropsSchema,
  VideoBlock: videoPropsSchema,
  IconBlock: iconPropsSchema,
  ListBlock: listPropsSchema,
  ProductGridBlock: productGridPropsSchema,
  ProductSpotlightBlock: productSpotlightPropsSchema,
  PricingTableBlock: pricingTablePropsSchema,
  ReviewListBlock: reviewListPropsSchema,
  LatestPostsBlock: latestPostsPropsSchema,
  HeroBlock: heroPropsSchema,
  FeatureGridBlock: featureGridPropsSchema,
  StatsBlock: statsPropsSchema,
  LogoCloudBlock: logoCloudPropsSchema,
  TestimonialsBlock: testimonialsPropsSchema,
  FAQBlock: faqPropsSchema,
  CTABlock: ctaPropsSchema,
  ComparisonTableBlock: comparisonTablePropsSchema,
  StepsBlock: stepsPropsSchema,
  NewsletterBlock: newsletterPropsSchema,
  ContactBlock: contactPropsSchema,
};

/**
 * The block envelope (type/props/id) stays permissive — Puck may add editor
 * housekeeping fields between versions — but every prop set validated by
 * PROPS_SCHEMAS is strict.
 */
const blockSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  id: z.string().optional(),
});

/**
 * Root data. The config defines no root fields yet, so only Puck's default
 * `title` may appear; page settings (SEO, slug) live outside the document.
 */
const rootSchema = z.strictObject({
  props: z.strictObject({ title: z.string().max(200).optional() }).optional(),
});

const documentSchema = z.object({
  content: z.array(blockSchema),
  root: rootSchema,
  // Slots replaced DropZones; Puck still sends an empty object.
  zones: z.record(z.string(), z.array(blockSchema).max(0)).optional(),
});

export type DocumentValidation =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export function validateDocument(input: unknown): DocumentValidation {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Not a document." };
  const doc = input as { content?: unknown; zones?: unknown };
  const seen = new Set<string>();

  const parseBlock = (value: unknown, path: string): string[] => {
    if (typeof value !== "object" || value === null) return [`${path}: block is not an object`];
    const { type, props } = value as Record<string, unknown>;
    if (typeof type !== "string" || !isPageBuilderBlockType(type)) {
      return [`${path}: unknown block type ${String(type)}`];
    }
    const result = PROPS_SCHEMAS[type].safeParse(props);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join(".") ?? type;
      return [`${path} ${type}: ${field} — ${result.error.issues[0]?.message ?? "invalid props"}`];
    }
    const record = (props ?? {}) as Record<string, unknown>;
    // Two blocks with one id would share a scoped CSS rule (plan 5.1).
    if (typeof record.id === "string") {
      if (seen.has(record.id)) return [`${path} ${type}: duplicate block id ${record.id}`];
      seen.add(record.id);
    }
    const childErrors: string[] = [];
    for (const slot of slotFieldsOf(type)) {
      const slotValue = record[slot];
      if (!Array.isArray(slotValue)) continue; // the props schema already requires the array
      slotValue.forEach((nested, index) => childErrors.push(...parseBlock(nested, `${path} ${type} ${slot}[${index}]`)));
    }
    return childErrors;
  };

  const content = Array.isArray(doc.content) ? doc.content : [];
  const errors = content.flatMap((block, index) => parseBlock(block, `content[${index}]`));
  if (errors.length) return { ok: false, error: errors.slice(0, 3).join("; ") };

  const result = documentSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".") || "document"}: ${issue.message}` : "Invalid document." };
  }
  return { ok: true, data: result.data };
}
