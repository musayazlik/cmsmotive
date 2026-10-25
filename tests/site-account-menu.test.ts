import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { accountMenuHtml, injectAccountMenu } from "../lib/site-account-menu";
test("avatar markup escapes profile data and replaces both legacy promotional buttons", () => {
  const user = {
    name: "<script>bad</script>",
    email: '" onmouseover="bad',
    image: "javascript:bad",
  };
  const menu = accountMenuHtml(user, "tr");
  assert.ok(!menu.includes("<script>"));
  assert.ok(!menu.includes('src="javascript:'));
  assert.ok(menu.includes("&lt;script&gt;"));
  assert.ok(!menu.includes("Yönetici paneli"));
  const html =
    '<html><head></head><body><div class="header-actions"><a class="btn btn-primary" href="/themes"><span>Themes entdecken</span></a><button>Menu</button></div><nav class="mobile-nav"><a class="btn btn-primary" href="/themes">Explore themes</a></nav></body></html>';
  const result = injectAccountMenu(html, user, "tr");
  assert.ok(result.includes("site-account-menu"));
  assert.ok(result.includes("site-account.css"));
  assert.ok(!result.includes("Themes entdecken"));
  assert.ok(!result.includes("Explore themes"));
  assert.ok(result.includes("/account?lang=tr"));
});
test("formatted legacy HTML keeps the mobile navigation and menu toggle intact", () => {
  const source = readFileSync(
    new URL("../static-site/contact.html", import.meta.url),
    "utf8",
  );
  const html = injectAccountMenu(
    source,
    { name: "Test User", email: "buyer@example.test", image: null },
    "de",
  );
  const header =
    html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.ok(header.includes("site-account-menu"));
  assert.ok(header.includes('class="menu-toggle"'));
  assert.ok(header.includes('class="mobile-nav"'));
  assert.ok(!header.includes("Explore themes"));
});
