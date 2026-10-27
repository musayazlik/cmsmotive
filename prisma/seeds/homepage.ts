import { loadCatalog } from "@/lib/i18n/catalog";
import { localizePath, type Locale } from "@/lib/i18n/config";
import type { PageBuilderData } from "@/lib/page-builder/data";
import { createPage, ensurePageLocale, publishPage, saveDraft } from "@/lib/page-builder/pages";
import { prisma } from "@/lib/prisma";

/**
 * The builder home page (plan Faz 3, equivalence list 5.9): one document per
 * store language, composed from the legacy index page's content. Text comes
 * from the same catalogs the legacy route translates with
 * (`loadCatalog`), so de/en/tr start exactly as translated today; strings the
 * catalogs do not have stay English there too. Live blocks (ProductGrid,
 * ReviewList, LatestPosts) take over `injectCatalog`/`injectTestimonials`;
 * the newsletter consent version resolves per request (live-data.ts).
 *
 * Adds content only while the store has no home page — panel edits survive a
 * re-run. Each language publishes immediately: the proxy then inherits the
 * root address for that locale, and unpublishing returns it to the legacy
 * flow (Faz 1 criterion).
 */

/** English source text → catalog translation, identity when untranslated. */
function translator(locale: string) {
  const catalog = loadCatalog(locale as Locale);
  return (key: string) => catalog.get(key) ?? key;
}

function homeDocument(locale: string, defaultLocale: string): PageBuilderData {
  const t = translator(locale);
  /** Links follow the store's prefix rules, like localizeLegacyHtml. */
  const href = (path: string) => localizePath(path, locale as Locale, defaultLocale as Locale);
  const block = (id: string, type: string, props: Record<string, unknown>) => ({ type, props: { ...props, id } });

  return {
    root: { props: { title: t("TYPO3 themes built for real projects — CMSMotive") } },
    content: [
      block("home-hero", "HeroBlock", {
        kicker: t("Independent TYPO3 product studio"),
        title: `${t("Distinctive TYPO3 themes,")} ${t("built for agency workflows.")}`,
        subtitle: t("CMSMotive creates considered TYPO3 themes, extensions and headless solutions for professional teams."),
        primaryButtonText: t("Explore Nordform preview"),
        primaryButtonHref: href("/demo-nordform"),
        secondaryButtonText: t("Request early access"),
        secondaryButtonHref: href("/contact"),
      }),
      block("home-catalog-h", "HeadingBlock", { text: t("Start with the product."), level: "h2" }),
      block("home-catalog-p", "TextBlock", {
        content: `<p>${t("A focused set of product directions, with one detailed theme preview and a free starter pathway.")}</p>`,
      }),
      // injectCatalog: live product cards with the industry filter.
      block("home-products", "ProductGridBlock", { limit: 6, columns: 3, showFilter: true, showPrice: true }),
      block("home-ext", "FeatureGridBlock", {
        kicker: t("Extensions"),
        title: t("Focused by design."),
        columns: 3,
        items: [
          {
            title: t("Editorial Workflow"),
            description: t("Make review states, handoffs and publishing responsibilities easier to understand across a content team."),
            href: href("/extensions"),
          },
          {
            title: t("Structured SEO"),
            description: t("Practical defaults for metadata, page previews and structured content without an overloaded control panel."),
            href: href("/extensions"),
          },
          {
            title: t("Content Utilities"),
            description: t("Small, documented tools for the repetitive details that slow real TYPO3 projects down."),
            href: href("/extensions"),
          },
        ],
      }),
      block("home-eng", "FeatureGridBlock", {
        title: `${t("Clean on the surface.")} ${t("Considered underneath.")}`,
        subtitle: t("Product quality means more than a polished screenshot. These are the engineering principles shaping CMSMotive."),
        columns: 3,
        items: [
          {
            title: t("Composer-first from day one."),
            description: t("A familiar delivery path for modern TYPO3 projects."),
          },
          {
            title: t("Made to be understood."),
            description: t("Readable Fluid structures, intentional content blocks and documentation your next developer can actually use."),
          },
          {
            title: t("Stay useful after launch."),
            description: t("Version clarity, planned LTS support and licensing built around real agency workflows."),
          },
        ],
      }),
      block("home-a11y", "FeatureGridBlock", {
        title: `${t("Better by design.")} ${t("Open to everyone.")}`,
        subtitle: t("Accessibility starts with the first component, not the final audit. We make it part of how every theme is planned, built and reviewed."),
        columns: 3,
        items: [
          { title: t("Keyboard journeys"), description: t("Clear focus and navigation from start to finish.") },
          { title: t("Content that makes sense"), description: t("Useful hierarchy for visitors and editors alike.") },
          { title: t("Repeatable reviews"), description: t("Practical checks the team can use as a site grows.") },
        ],
      }),
      // injectTestimonials: live quotes from approved product reviews.
      block("home-voices-h", "HeadingBlock", { text: t("Shaped with the teams who will use it."), level: "h2" }),
      block("home-voices", "ReviewListBlock", { limit: 3, columns: 3 }),
      block("home-foundation", "CTABlock", {
        variant: "plain",
        title: t("Good foundations make room for better work."),
        description: t("Explore the free Foundation direction and see how a thoughtful TYPO3 starter can be organized."),
        buttonText: t("Explore Foundation"),
        buttonHref: href("/products/foundation"),
      }),
      block("home-pricing", "PricingTableBlock", {
        title: t("One product. Three service plans."),
        subtitle: t("Choose an annual support and updates plan. Each paid plan includes 12 months and renews automatically every year until cancelled. Concept products are not available to purchase yet."),
        plans: [
          {
            name: t("Single Site"),
            price: "€269",
            period: t("/ year · concept price"),
            description: t("Updates and support for one installation."),
            features: [t("Standard updates"), t("Community support")],
            ctaLabel: "",
            ctaHref: "",
            featured: false,
          },
          {
            name: t("Agency"),
            price: "€419",
            period: t("/ year · concept price"),
            description: t("For teams applying the theme across client work."),
            features: [t("Agency licensing"), t("Priority support")],
            ctaLabel: "",
            ctaHref: "",
            featured: true,
          },
          {
            name: t("Enterprise"),
            price: "€659",
            period: t("/ year · concept price"),
            description: t("For broad organizational requirements."),
            features: [t("Dedicated SLA"), t("Direct engineering contact")],
            ctaLabel: "",
            ctaHref: "",
            featured: false,
          },
        ],
      }),
      block("home-notes-h", "HeadingBlock", { text: t("Notes from the build."), level: "h2" }),
      block("home-notes-p", "TextBlock", {
        content: `<p>${t("Practical thinking on TYPO3 architecture, accessibility and product design.")}</p>`,
      }),
      block("home-posts", "LatestPostsBlock", { limit: 3, columns: 3 }),
      block("home-faq", "FAQBlock", {
        title: t("Frequently asked questions"),
        subtitle: t("Good decisions start with clear answers."),
        items: [
          {
            question: t("Can I buy Nordform today?"),
            answer: t("Nordform is presented here as a visual and product concept. Request availability to receive verified specifications, a launch date and a purchase link when ready."),
          },
          {
            question: t("Will themes support TYPO3 13 and 14 LTS?"),
            answer: t("That is the planned compatibility target. Exact supported versions will be listed on each released product and checked against its changelog."),
          },
          {
            question: t("Can agencies use a theme for multiple clients?"),
            answer: t("The proposed Agency licence is intended for repeat client work. Final usage terms will be published before sales open."),
          },
          {
            question: t("Is the site affiliated with TYPO3?"),
            answer: t("No. CMSMotive is an independent product brand. TYPO3 is a registered trademark of the TYPO3 Association."),
          },
          {
            question: t("How do I request early access?"),
            answer: t("Use the contact form and share your email, agency or company, TYPO3 version and the licence you are interested in. We reply within one business day."),
          },
        ],
      }),
      block("home-cta", "CTABlock", {
        variant: "brand",
        title: t("Make the next TYPO3 project feel like progress."),
        description: t("Explore a considered theme direction, or tell us what your team needs from a product built for real delivery."),
        buttonText: t("Explore themes"),
        buttonHref: href("/themes"),
        secondaryText: t("Talk about your project"),
        secondaryHref: href("/contact"),
      }),
      block("home-news", "NewsletterBlock", {
        title: t("One email a month, like a good paper."),
        description: t("New themes, extension releases and build notes from the CMSMotive workbench — pressed, folded and delivered to your inbox. No spam, unsubscribe any time."),
        buttonText: t("Subscribe"),
        privacyNote: `${t("We store your name and email only to send the newsletter. See the")} ${t("privacy policy")}.`,
      }),
    ],
  };
}

/**
 * Creates and publishes the home page in every store language. Fails loudly:
 * a half-seeded home page would silently keep the legacy flow.
 */
export async function seedHomepage(storeId: string): Promise<void> {
  if (await prisma.page.findFirst({ where: { storeId, kind: "home" }, select: { id: true } })) return;
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultLocale: true, locales: true } });
  const title = (locale: string) => translator(locale)("TYPO3 themes built for real projects — CMSMotive");

  const created = await createPage(storeId, { kind: "home", locale: store.defaultLocale, title: title(store.defaultLocale) });
  if ("error" in created) throw new Error(`home page create failed: ${created.error}`);
  const pageId = created.data.pageId;

  for (const locale of store.locales) {
    const ensured = await ensurePageLocale(storeId, pageId, locale, title(locale));
    if ("error" in ensured) throw new Error(`home locale ${locale} failed: ${ensured.error}`);
    const row = await prisma.pageLocale.findUniqueOrThrow({
      where: { pageId_locale: { pageId, locale } },
      select: { version: true },
    });
    const saved = await saveDraft(storeId, pageId, locale, homeDocument(locale, store.defaultLocale), row.version);
    if (!saved.ok) throw new Error(`home draft ${locale} failed: ${JSON.stringify(saved)}`);
    const published = await publishPage(storeId, pageId, locale);
    if (!published.ok) throw new Error(`home publish ${locale} failed: ${JSON.stringify(published)}`);
  }
  console.log(`  home       published in ${store.locales.join(", ")}`);
}
