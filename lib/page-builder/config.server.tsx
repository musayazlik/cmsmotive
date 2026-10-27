import type { Config } from "@puckeditor/core";
import {
  buttonBaseFields,
  comparisonTableBaseFields,
  contactBaseFields,
  containerBaseFields,
  ctaBaseFields,
  dividerBaseFields,
  faqBaseFields,
  featureGridBaseFields,
  gridBaseFields,
  headingBaseFields,
  heroBaseFields,
  iconBaseFields,
  imageBaseFields,
  latestPostsBaseFields,
  listBaseFields,
  logoCloudBaseFields,
  newsletterBaseFields,
  pricingTableBaseFields,
  productGridBaseFields,
  productSpotlightBaseFields,
  reviewListBaseFields,
  sectionBaseFields,
  spacerBaseFields,
  stackBaseFields,
  statsBaseFields,
  stepsBaseFields,
  testimonialsBaseFields,
  textBaseFields,
  videoBaseFields,
} from "./fields.server";
import { containerDefaultProps } from "./blocks/container/schema";
import { gridDefaultProps } from "./blocks/grid/schema";
import { sectionDefaultProps } from "./blocks/section/schema";
import { stackDefaultProps } from "./blocks/stack/schema";
import { spacerDefaultProps } from "./blocks/spacer/schema";
import { dividerDefaultProps } from "./blocks/divider/schema";
import { headingDefaultProps } from "./blocks/heading/schema";
import { textDefaultProps } from "./blocks/text/schema";
import { buttonDefaultProps } from "./blocks/button/schema";
import { imageDefaultProps } from "./blocks/image/schema";
import { videoDefaultProps } from "./blocks/video/schema";
import { iconDefaultProps } from "./blocks/icon/schema";
import { listDefaultProps } from "./blocks/list/schema";
import { productGridDefaultProps } from "./blocks/product-grid/schema";
import { productSpotlightDefaultProps } from "./blocks/product-spotlight/schema";
import { pricingTableDefaultProps } from "./blocks/pricing-table/schema";
import { reviewListDefaultProps } from "./blocks/review-list/schema";
import { latestPostsDefaultProps } from "./blocks/latest-posts/schema";
import { heroDefaultProps } from "./blocks/hero/schema";
import { featureGridDefaultProps } from "./blocks/feature-grid/schema";
import { statsDefaultProps } from "./blocks/stats/schema";
import { logoCloudDefaultProps } from "./blocks/logo-cloud/schema";
import { testimonialsDefaultProps } from "./blocks/testimonials/schema";
import { faqDefaultProps } from "./blocks/faq/schema";
import { ctaDefaultProps } from "./blocks/cta/schema";
import { comparisonTableDefaultProps } from "./blocks/comparison-table/schema";
import { stepsDefaultProps } from "./blocks/steps/schema";
import { newsletterDefaultProps } from "./blocks/newsletter/schema";
import { contactDefaultProps } from "./blocks/contact/schema";

import { ContainerRender } from "./blocks/container/render";
import { GridRender } from "./blocks/grid/render";
import { SectionRender } from "./blocks/section/render";
import { StackRender } from "./blocks/stack/render";
import { SpacerRender } from "./blocks/spacer/render";
import { DividerRender } from "./blocks/divider/render";
import { HeadingRender } from "./blocks/heading/render";
import { TextRender } from "./blocks/text/render";
import { ButtonRender } from "./blocks/button/render";
import { ImageRender } from "./blocks/image/render";
import { VideoRender } from "./blocks/video/render";
import { IconRender } from "./blocks/icon/render";
import { ListRender } from "./blocks/list/render";
import { ProductGridRender } from "./blocks/product-grid/render";
import { ProductSpotlightRender } from "./blocks/product-spotlight/render";
import { PricingTableRender } from "./blocks/pricing-table/render";
import { ReviewListRender } from "./blocks/review-list/render";
import { LatestPostsRender } from "./blocks/latest-posts/render";
import { HeroRender } from "./blocks/hero/render";
import { FeatureGridRender } from "./blocks/feature-grid/render";
import { StatsRender } from "./blocks/stats/render";
import { LogoCloudRender } from "./blocks/logo-cloud/render";
import { TestimonialsRender } from "./blocks/testimonials/render";
import { FAQRender } from "./blocks/faq/render";
import { CTARender } from "./blocks/cta/render";
import { ComparisonTableRender } from "./blocks/comparison-table/render";
import { StepsRender } from "./blocks/steps/render";
import { NewsletterRender } from "./blocks/newsletter/render";
import { ContactRender } from "./blocks/contact/render";

/**
 * Server config for `<Render>` on the public page (plan 5.16). Field
 * declarations match the editor's (same base fields — see fields.server.ts),
 * same render functions — but NO editor runtime: importing any "use client"
 * module here would put the interactive @puckeditor/core bundle onto public
 * routes (Faz 0 item 4).
 *
 * Typed as the bare `Config` on purpose: Puck's `Render`/`Puck` require a
 * config assignable to their unparameterized `Config` constraint, which the
 * fully generic maps are not (this compiled in Faz 0).
 */

export const serverConfig: Config = {
  components: {
    ContainerBlock: { label: "Container", fields: { ...containerBaseFields }, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { label: "Grid", fields: { ...gridBaseFields }, defaultProps: { ...gridDefaultProps }, render: GridRender },
    SectionBlock: { label: "Section", fields: { ...sectionBaseFields }, defaultProps: { ...sectionDefaultProps }, render: SectionRender },
    StackBlock: { label: "Stack", fields: { ...stackBaseFields }, defaultProps: { ...stackDefaultProps }, render: StackRender },
    SpacerBlock: { label: "Spacer", fields: { ...spacerBaseFields }, defaultProps: { ...spacerDefaultProps }, render: SpacerRender },
    DividerBlock: { label: "Divider", fields: { ...dividerBaseFields }, defaultProps: { ...dividerDefaultProps }, render: DividerRender },
    HeadingBlock: { label: "Heading", fields: { ...headingBaseFields }, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { label: "Text", fields: { ...textBaseFields }, defaultProps: { ...textDefaultProps }, render: TextRender },
    ButtonBlock: { label: "Button", fields: { ...buttonBaseFields }, defaultProps: { ...buttonDefaultProps }, render: ButtonRender },
    ImageBlock: { label: "Image", fields: { ...imageBaseFields }, defaultProps: { ...imageDefaultProps }, render: ImageRender },
    VideoBlock: { label: "Video", fields: { ...videoBaseFields }, defaultProps: { ...videoDefaultProps }, render: VideoRender },
    IconBlock: { label: "Icon", fields: { ...iconBaseFields }, defaultProps: { ...iconDefaultProps }, render: IconRender },
    ListBlock: { label: "List", fields: { ...listBaseFields }, defaultProps: { ...listDefaultProps }, render: ListRender },

    // Live data blocks (Faz 2)
    ProductGridBlock: { label: "Product Grid", fields: { ...productGridBaseFields }, defaultProps: { ...productGridDefaultProps }, render: ProductGridRender },
    ProductSpotlightBlock: { label: "Product Spotlight", fields: { ...productSpotlightBaseFields }, defaultProps: { ...productSpotlightDefaultProps }, render: ProductSpotlightRender },
    PricingTableBlock: { label: "Pricing Table", fields: { ...pricingTableBaseFields }, defaultProps: { ...pricingTableDefaultProps }, render: PricingTableRender },
    ReviewListBlock: { label: "Review List", fields: { ...reviewListBaseFields }, defaultProps: { ...reviewListDefaultProps }, render: ReviewListRender },
    LatestPostsBlock: { label: "Latest Posts", fields: { ...latestPostsBaseFields }, defaultProps: { ...latestPostsDefaultProps }, render: LatestPostsRender },

    // Compound section blocks (Faz 2)
    HeroBlock: { label: "Hero", fields: { ...heroBaseFields }, defaultProps: { ...heroDefaultProps }, render: HeroRender },
    FeatureGridBlock: { label: "Feature Grid", fields: { ...featureGridBaseFields }, defaultProps: { ...featureGridDefaultProps }, render: FeatureGridRender },
    StatsBlock: { label: "Stats", fields: { ...statsBaseFields }, defaultProps: { ...statsDefaultProps }, render: StatsRender },
    LogoCloudBlock: { label: "Logo Cloud", fields: { ...logoCloudBaseFields }, defaultProps: { ...logoCloudDefaultProps }, render: LogoCloudRender },
    TestimonialsBlock: { label: "Testimonials", fields: { ...testimonialsBaseFields }, defaultProps: { ...testimonialsDefaultProps }, render: TestimonialsRender },
    FAQBlock: { label: "FAQ", fields: { ...faqBaseFields }, defaultProps: { ...faqDefaultProps }, render: FAQRender },
    CTABlock: { label: "Call to Action", fields: { ...ctaBaseFields }, defaultProps: { ...ctaDefaultProps }, render: CTARender },
    ComparisonTableBlock: { label: "Comparison Table", fields: { ...comparisonTableBaseFields }, defaultProps: { ...comparisonTableDefaultProps }, render: ComparisonTableRender },
    StepsBlock: { label: "Steps", fields: { ...stepsBaseFields }, defaultProps: { ...stepsDefaultProps }, render: StepsRender },
    NewsletterBlock: { label: "Newsletter", fields: { ...newsletterBaseFields }, defaultProps: { ...newsletterDefaultProps }, render: NewsletterRender },
    ContactBlock: { label: "Contact", fields: { ...contactBaseFields }, defaultProps: { ...contactDefaultProps }, render: ContactRender },
  },
};
