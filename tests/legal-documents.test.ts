import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LEGAL_SETTINGS } from "../lib/legal-settings-shared";
import {
  DEFAULT_LEGAL_DOCUMENTS, injectLegalFooter, legalDocuments, legalFooterLinks,
  validateLegalDocuments, type LegalDocument,
} from "../lib/legal-documents-shared";
import { sanitizeLegalContent } from "../lib/legal-content";

const page: LegalDocument = { slug: "refund-policy", locale: "en", title: "Refund policy", content: "<h2>Refunds</h2><p>Contact support.</p>", published: true, showInFooter: true };

test("defaults retain translated required pages and escape generated business details", () => {
  const rows = legalDocuments({ ...DEFAULT_LEGAL_SETTINGS, legalName: '<img src=x onerror="alert(1)">' }, DEFAULT_LEGAL_DOCUMENTS, "tr");
  assert.deepEqual(rows.map((d) => d.slug), ["imprint", "privacy", "terms", "cookies"]);
  assert.equal(rows[1].title, "Gizlilik politikası");
  assert.ok(rows.every((d) => d.published));
  assert.ok(rows[0].content.includes("&lt;img"));
  assert.ok(!rows[0].content.includes("<img"));
});

test("an override replaces only its language and reset restores the generated document", () => {
  const override = { ...page, slug: "privacy", title: "Our privacy policy" };
  const saved = { documents: [override] };
  assert.equal(legalDocuments(DEFAULT_LEGAL_SETTINGS, saved, "en").find((d) => d.slug === "privacy")?.content, page.content);
  assert.notEqual(legalDocuments(DEFAULT_LEGAL_SETTINGS, saved, "de").find((d) => d.slug === "privacy")?.content, page.content);
  assert.equal(legalDocuments(DEFAULT_LEGAL_SETTINGS, DEFAULT_LEGAL_DOCUMENTS, "en").find((d) => d.slug === "privacy")?.title, "Privacy policy");
});

test("footer links respect language, publication and visibility", () => {
  const saved = { documents: [page, { ...page, slug: "draft", published: false }, { ...page, slug: "hidden", showInFooter: false }] };
  assert.deepEqual(legalFooterLinks(saved, "en").filter((d) => d.href.includes("/legal/")), [{ title: page.title, href: "/en/legal/refund-policy" }]);
  assert.equal(legalFooterLinks(saved, "de").length, 4);
  assert.equal(legalDocuments(DEFAULT_LEGAL_SETTINGS, saved, "en").find((d) => d.slug === "draft")?.published, false);
});

test("legacy footer receives the same localized links and escapes custom labels", () => {
  for (const locale of ["de", "en", "tr"] as const) {
    const prefix = locale === "de" ? "" : `/${locale}`;
    const html = `<div class="footer-col"><div class="footer-label">Resources</div><a href="/contact">Contact</a></div><div class="footer-col"><div class="footer-label">Legal</div><a href="${prefix}/imprint">Imprint</a><a href="${prefix}/privacy">Privacy</a></div>`;
    const result = injectLegalFooter(html, { documents: [{ ...page, locale, title: 'Refunds & <policy>' }] }, locale);
    assert.ok(result.includes(`href="${prefix}/legal/refund-policy"`));
    assert.ok(result.includes("Refunds &amp; &lt;policy&gt;"));
    assert.ok(result.includes('<a href="/contact">Contact</a>'));
  }
});

test("validation rejects collisions, invalid paths and unpublished or empty required pages", () => {
  const rejected = (documents: unknown) => assert.ok("error" in validateLegalDocuments({ documents }));
  rejected([page, page]);
  rejected([{ ...page, slug: "../privacy" }]);
  rejected([{ ...page, locale: "xx" }]);
  rejected([{ ...page, slug: "privacy", published: false }]);
  rejected([{ ...page, content: "<p>&nbsp;</p>" }]);
  rejected([{ ...page, content: "a".repeat(100_001) }]);
  assert.ok("data" in validateLegalDocuments({ documents: [page, { ...page, locale: "de" }] }));
  assert.ok("data" in validateLegalDocuments({ documents: [{ ...page, content: "", published: false }] }));
});

test("HTML sanitation strips executable markup while preserving editor tables and safe formatting", () => {
  const content = sanitizeLegalContent('<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Bad</a><iframe src="https://example.com"></iframe><table><tbody><tr><th colspan="2">Heading</th></tr><tr><td><p style="text-align:center;position:fixed">Text</p></td><td><a href="https://example.com">Link</a></td></tr></tbody></table>');
  assert.doesNotMatch(content, /script|onerror|javascript|iframe|position/);
  assert.match(content, /<table>/);
  assert.match(content, /colspan="2"/);
  assert.match(content, /text-align:center/);
  assert.match(content, /href="https:\/\/example.com"/);
  assert.ok("error" in validateLegalDocuments({ documents: [{ ...page, content: sanitizeLegalContent("<script>alert(1)</script>") }] }));
});
