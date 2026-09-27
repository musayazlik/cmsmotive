# CMSMotive static site

An English-language, product-first website concept for CMSMotive. It uses semantic HTML, custom CSS and vanilla JavaScript. There is no framework, package install or build step required to view the generated pages.

## Open and edit

- Open `index.html` in a browser, or serve this folder with any static file server.
- Edit page content in `build.py`, then run `python3 build.py` from this folder to regenerate the HTML files.
- Edit styling in `assets/css/site.css` and interactions in `assets/js/site.js`.
- All internal navigation uses relative URLs, so the folder can be deployed under a subpath.

## Pages

Home, themes catalogue, Nordform product detail and visual demo, Foundation and Campus concept details, extensions, headless, pricing, documentation, journal index and three articles, about, contact, imprint, privacy, terms and cookie information. The `auth/` folder contains sign in, registration, forgotten password, password reset and email verification previews.

The auth pages share the site's branding and use `assets/css/auth.css` and `assets/js/auth.js`. Forms validate locally and show a clear preview message; they do not create accounts, send email, store credentials or change passwords. Connect them to a real authentication service before publication.

Journal detail pages use the full site container with a popular-articles sidebar and a threaded comment preview. New comments and replies are stored in the visitor's own browser with `localStorage`; they are not shared between visitors or sent to a server. The typography article includes a clearly labelled example exchange. Connect the forms to a moderated comment service before publication if public discussion is needed.

The theme catalogue has working client-side search, filters and a reset action. The Nordform licence selector updates the indicative price. All four selects use branded dropdown menus with keyboard controls when JavaScript is available; native selects remain as the no-script fallback. The site includes custom button and field styles, a responsive menu, a two-column FAQ with native accordions, a closing CTA, copy buttons and scroll-triggered reveals with reduced-motion support. The home hero fills at least the available viewport height, with gentle CSS motion on its preview elements; reduced-motion preferences disable that motion.

## Before publication

- Confirm the legal entity, registered address, jurisdiction and contact email. The legal pages are marked as drafts and contain visible placeholders.
- Replace `hello@cmsmotive.com` if it is not the approved contact mailbox.
- Verify product availability, package names, compatibility, final features, accessibility claims, pricing, licence grants and policies before enabling purchases. This concept does not take payment.
- Choose whether to self-host Manrope and DM Mono. The current CSS loads them from Google Fonts, and the draft privacy page calls this out.
- Replace concept imagery with verified product screenshots when packages are ready. The current architecture photographs are original generated editorial assets and are labelled as concept visuals.
- Add real business and privacy policies after legal review for the applicable jurisdiction.

## Visual assets

The updated CMSMotive mark began as a built-in ImageGen logo exploration. Its original transparent PNG is saved at `assets/images/logo-concept-v2.png` and appears in the closing CTA. A clean, flat SVG adaptation at `assets/icons/logo-mark-v2.svg` is paired with the CMSMotive wordmark in the header and footer and used alone as the favicon. The previous SVG is retained as `assets/icons/logo-mark.svg`. The mark is separate from the TYPO3 logo.

Final logo prompt: "Create a distinctive geometric CMSMotive M monogram from interlocking folded ribbon forms with a small modular aperture; premium European developer-product identity; deep cobalt indigo #4353E8 with a small acid-lime #C6F36A accent; centered, transparent background, no typography, container, gradient, glow or shadow." ImageGen provided the form; the SVG removes the glow that persisted in the raster generation.

The photographs were created with the built-in image generation tool and optimized to WebP for this project:

| File | Generation prompt |
| --- | --- |
| `assets/images/hero-nordform-v2.webp` | High-end natural architectural photograph of a contemporary European cultural building with interlocking pale limestone and concrete volumes, broad glass openings, one person for scale and a calm landscaped forecourt; wide composition with darker lower-left foreground for a browser-preview headline, soft early morning sunlight, no text, logo or UI. |
| `assets/images/hero-typo3-template-v1.webp` | Built-in ImageGen mockup canvas for the current home hero: a premium architecture website template preview with a dark editorial left panel for real HTML copy and a warm limestone-and-glass building on the right; no rendered text, logos or browser frame. |
| `assets/images/nordform-architecture.webp` | Premium editorial architectural photograph of a contemporary European design studio building, sculptural pale concrete facade, broad windows and quiet plaza; horizontal composition, bright overcast light, warm limestone and charcoal, no text, logo or UI. |
| `assets/images/campus-library.webp` | Premium editorial architectural photograph of a contemporary European university campus library with brick and glass facade, landscaped courtyard and a few students; horizontal composition, warm late afternoon light, no text, logo or UI. |
| `assets/images/foundation-studio.webp` | Premium editorial photograph of a serene modern creative studio workspace with open desk, architectural model and large window; horizontal composition, pale oak and graphite, no text, logo or UI. |

Two earlier transparent ImageGen explorations remain in `assets/images/` for reference. They are not rendered in the current home hero.

| File | Final ImageGen prompt |
| --- | --- |
| `assets/images/hero-ribbon-3d.webp` | One abstract interlocking folded-ribbon loop with a clear central opening, rendered as a premium 3D studio object in satin cobalt indigo with a restrained acid-lime inner edge; isolated three-quarter view, transparent background, no text, logo, UI or scenery. |
| `assets/images/hero-burst-2d.webp` | One flat modular six-armed starburst with rounded geometric arms and a small negative-space center; precise 2D cut-paper style, acid-lime fill and narrow cobalt contour, isolated on a transparent background, no text, logo, UI or shadow. |

## Design basis

The product-first structure follows the supplied CMSMotive brief. TYPO3 v14's modernized visual direction and the TYPO3 brand distinction were checked against [TYPO3 v14 materials](https://typo3.com/typo3-cms/release-materials/v14) and [official TYPO3 brand guidelines](https://typo3.com/typo3-cms/the-brand/brand-guidelines). TYPO3 orange is used only in compatibility badges; CMSMotive's primary brand color is indigo.
