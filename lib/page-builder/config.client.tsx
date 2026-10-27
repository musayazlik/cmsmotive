import type { Config } from "@puckeditor/core";
import {
  buttonFields,
  comparisonTableFields,
  contactFields,
  containerFields,
  ctaFields,
  dividerFields,
  faqFields,
  featureGridFields,
  gridFields,
  headingFields,
  heroFields,
  iconFields,
  imageFields,
  latestPostsFields,
  listFields,
  logoCloudFields,
  newsletterFields,
  pricingTableFields,
  productGridFields,
  productSpotlightFields,
  reviewListFields,
  sectionFields,
  spacerFields,
  stackFields,
  statsFields,
  stepsFields,
  testimonialsFields,
  textFields,
  videoFields,
} from "./block-fields";
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
 * Client config for `<Puck>` (plan 5.16). Only the editor imports this file;
 * public routes import config.server.tsx so @puckeditor/core's interactive
 * runtime never reaches the public bundle (Faz 0 acceptance item 4).
 *
 * Field declarations are shared with the server config: the plain fields come
 * from fields.server.ts and block-fields.tsx only adds the interactive
 * StyleField, so `use client`-free server routes can never pull the editor
 * runtime (Faz 0 item 4).
 * Typed as the bare `Config` so it satisfies Puck's `Config` constraint —
 * block-level types live in the renders (`PuckComponent<...Props>`) and in
 * validate.ts. The categories feed the left drawer; labels surface the item chrome.
 */

export const clientConfig: Config = {
  categories: {
    layout: {
      title: "Layout",
      components: [
        "ContainerBlock",
        "GridBlock",
        "SectionBlock",
        "StackBlock",
        "SpacerBlock",
        "DividerBlock",
      ],
      defaultExpanded: true,
    },
    content: {
      title: "Content",
      components: [
        "HeadingBlock",
        "TextBlock",
        "ButtonBlock",
        "ImageBlock",
        "VideoBlock",
        "IconBlock",
        "ListBlock",
      ],
      defaultExpanded: true,
    },
    sections: {
      title: "Sections",
      components: [
        "HeroBlock",
        "FeatureGridBlock",
        "StatsBlock",
        "LogoCloudBlock",
        "TestimonialsBlock",
        "FAQBlock",
        "CTABlock",
        "ComparisonTableBlock",
        "StepsBlock",
      ],
      defaultExpanded: false,
    },
    data: {
      title: "Live Data",
      components: [
        "ProductGridBlock",
        "ProductSpotlightBlock",
        "PricingTableBlock",
        "ReviewListBlock",
        "LatestPostsBlock",
      ],
      defaultExpanded: false,
    },
    forms: {
      title: "Forms",
      components: [
        "NewsletterBlock",
        "ContactBlock",
      ],
      defaultExpanded: false,
    },
  },
  components: {
    ContainerBlock: { label: "Container", fields: containerFields, defaultProps: { ...containerDefaultProps }, render: ContainerRender },
    GridBlock: { label: "Grid", fields: gridFields, defaultProps: { ...gridDefaultProps }, render: GridRender },
    SectionBlock: { label: "Section", fields: sectionFields, defaultProps: { ...sectionDefaultProps }, render: SectionRender },
    StackBlock: { label: "Stack", fields: stackFields, defaultProps: { ...stackDefaultProps }, render: StackRender },
    SpacerBlock: { label: "Spacer", fields: spacerFields, defaultProps: { ...spacerDefaultProps }, render: SpacerRender },
    DividerBlock: { label: "Divider", fields: dividerFields, defaultProps: { ...dividerDefaultProps }, render: DividerRender },
    HeadingBlock: { label: "Heading", fields: headingFields, defaultProps: { ...headingDefaultProps }, render: HeadingRender },
    TextBlock: { label: "Text", fields: textFields, defaultProps: { ...textDefaultProps }, render: TextRender },
    ButtonBlock: { label: "Button", fields: buttonFields, defaultProps: { ...buttonDefaultProps }, render: ButtonRender },
    ImageBlock: { label: "Image", fields: imageFields, defaultProps: { ...imageDefaultProps }, render: ImageRender },
    VideoBlock: { label: "Video", fields: videoFields, defaultProps: { ...videoDefaultProps }, render: VideoRender },
    IconBlock: { label: "Icon", fields: iconFields, defaultProps: { ...iconDefaultProps }, render: IconRender },
    ListBlock: { label: "List", fields: listFields, defaultProps: { ...listDefaultProps }, render: ListRender },

    // Live data blocks (Faz 2)
    ProductGridBlock: { label: "Product Grid", fields: productGridFields, defaultProps: { ...productGridDefaultProps }, render: ProductGridRender },
    ProductSpotlightBlock: { label: "Product Spotlight", fields: productSpotlightFields, defaultProps: { ...productSpotlightDefaultProps }, render: ProductSpotlightRender },
    PricingTableBlock: { label: "Pricing Table", fields: pricingTableFields, defaultProps: { ...pricingTableDefaultProps }, render: PricingTableRender },
    ReviewListBlock: { label: "Review List", fields: reviewListFields, defaultProps: { ...reviewListDefaultProps }, render: ReviewListRender },
    LatestPostsBlock: { label: "Latest Posts", fields: latestPostsFields, defaultProps: { ...latestPostsDefaultProps }, render: LatestPostsRender },

    // Compound section blocks (Faz 2)
    HeroBlock: { label: "Hero", fields: heroFields, defaultProps: { ...heroDefaultProps }, render: HeroRender },
    FeatureGridBlock: { label: "Feature Grid", fields: featureGridFields, defaultProps: { ...featureGridDefaultProps }, render: FeatureGridRender },
    StatsBlock: { label: "Stats", fields: statsFields, defaultProps: { ...statsDefaultProps }, render: StatsRender },
    LogoCloudBlock: { label: "Logo Cloud", fields: logoCloudFields, defaultProps: { ...logoCloudDefaultProps }, render: LogoCloudRender },
    TestimonialsBlock: { label: "Testimonials", fields: testimonialsFields, defaultProps: { ...testimonialsDefaultProps }, render: TestimonialsRender },
    FAQBlock: { label: "FAQ", fields: faqFields, defaultProps: { ...faqDefaultProps }, render: FAQRender },
    CTABlock: { label: "Call to Action", fields: ctaFields, defaultProps: { ...ctaDefaultProps }, render: CTARender },
    ComparisonTableBlock: { label: "Comparison Table", fields: comparisonTableFields, defaultProps: { ...comparisonTableDefaultProps }, render: ComparisonTableRender },
    StepsBlock: { label: "Steps", fields: stepsFields, defaultProps: { ...stepsDefaultProps }, render: StepsRender },
    NewsletterBlock: { label: "Newsletter", fields: newsletterFields, defaultProps: { ...newsletterDefaultProps }, render: NewsletterRender },
    ContactBlock: { label: "Contact", fields: contactFields, defaultProps: { ...contactDefaultProps }, render: ContactRender },
  },
};
