import type { PageBuilderData } from "./data";

/**
 * First document for the Phase 0 prototype: two containers, a heading with
 * responsive overrides and a 2-column grid — enough to see the style layer,
 * base blocks and iframe shipping in one screen.
 */
export const DEFAULT_PROTOTYPE_DOCUMENT: PageBuilderData = {
  root: {},
  zones: {},
  content: [
    {
      type: "ContainerBlock",
      props: {
        id: "container-hero",
        width: "narrow",
        children: [
          {
            type: "HeadingBlock",
            props: {
              id: "heading-hero",
              text: "Design pages with the blocks of your own site",
              level: "h1",
              style: {
                typography: {
                  base: { fontSize: { value: 56, unit: "px" }, lineHeight: 1.06, letterSpacing: { value: -0.03, unit: "em" } },
                  mobile: { fontSize: { value: 34, unit: "px" } },
                },
                spacing: {
                  base: { marginTop: { value: 48, unit: "px" }, marginBottom: { value: 20, unit: "px" } },
                },
              },
            },
          },
          {
            type: "TextBlock",
            props: {
              id: "text-hero",
              content:
                "<p>This prototype renders through the same blocks that later ship in production: Container, Grid, Heading and Text. Push the style values on the right, switch the viewport in the toolbar and watch scoped CSS follow suit.</p>",
              style: {
                typography: {
                  base: { fontSize: { value: 19, unit: "px" } },
                },
                spacing: {
                  base: { marginBottom: { value: 32, unit: "px" } },
                },
              },
            },
          },
        ],
      },
    },
    {
      type: "ContainerBlock",
      props: {
        id: "container-grid",
        width: "default",
        children: [
          {
            type: "GridBlock",
            props: {
              id: "grid-features",
              variant: "2",
              gap: "lg",
              col1: [
                {
                  type: "HeadingBlock",
                  props: {
                    id: "heading-features",
                    text: "Blocks reuse your site",
                    level: "h2",
                  },
                },
                {
                  type: "TextBlock",
                  props: {
                    id: "text-features",
                    content:
                      "<p>Each block renders the classes of <code>site.css</code> inside the iframe, so the editor canvas looks exactly like the finished page — the typography below is your own server-hosted Manrope.</p>",
                  },
                },
              ],
              col2: [
                {
                  type: "HeadingBlock",
                  props: {
                    id: "heading-responsive",
                    text: "Responsive by layers",
                    level: "h2",
                  },
                },
                {
                  type: "TextBlock",
                  props: {
                    id: "text-responsive",
                    content:
                      "<p>The style panel writes structured values: desktop first, tablet and mobile as optional overrides. The compiler turns them into one scoped stylesheet per page.</p>",
                  },
                },
              ],
              col3: [],
              col4: [],
            },
          },
        ],
      },
    },
  ],
};

/** Initial root data when a draft has no document yet (`{ content: [], root: {} }`). */
export function emptyPrototypeDocument(): PageBuilderData {
  return { content: [], root: {}, zones: {} };
}
