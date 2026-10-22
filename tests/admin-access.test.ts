import assert from "node:assert/strict";
import { test } from "node:test";
import { adminLoginPath, internalPanelPath, panelHref, validateAdminAccessSettings } from "../lib/admin-access-shared";
import { ADMIN_ENTRY_COOKIE, ADMIN_ENTRY_TTL, issueAdminEntry, validAdminEntry } from "../lib/admin-entry";

test("private paths reject public routes, encoded separators and external destinations", () => {
  for (const panelPath of ["", "/", "/api", "/auth", "/themes", "/tr", "//evil.example", "https://evil.example", "/team/login", "/team?next=evil", "/%70anel", "/team%2flogin", "/_next", "/..", "/ab"]) {
    assert.ok("error" in validateAdminAccessSettings({ panelPath }), panelPath);
  }
  assert.deepEqual(validateAdminAccessSettings({ panelPath: " Workspace-42 " }), { data: { panelPath: "/workspace-42" } });
});

test("navigation preserves suffixes and never rewrites similarly named public paths", () => {
  assert.equal(panelHref("/panel/blog/one?draft=true#cover", "/work-42"), "/work-42/blog/one?draft=true#cover");
  for (const path of ["/panels", "/panelist", "/themes", "https://example.com/panel"]) assert.equal(panelHref(path, "/work-42"), path);
  assert.equal(internalPanelPath("/work-42/settings", "/work-42"), "/panel/settings");
  assert.equal(internalPanelPath("/work-420/settings", "/work-42"), "/work-420/settings");
  assert.equal(adminLoginPath("/panel"), "/auth/login");
  assert.equal(adminLoginPath("/work-42"), "/work-42/login");
});

test("entry cookies reject tampering, expired tokens and reuse after address changes", () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-only-secret-with-more-than-thirty-two-characters";
  try {
    const now = Date.now();
    const token = issueAdminEntry("/work-42", now);
    const headers = new Headers({ cookie: `${ADMIN_ENTRY_COOKIE}=${token}` });
    assert.ok(validAdminEntry(headers, "/work-42", now));
    assert.ok(!validAdminEntry(headers, "/work-43", now));
    assert.ok(!validAdminEntry(headers, "/work-42", now + (ADMIN_ENTRY_TTL + 1) * 1000));
    assert.ok(!validAdminEntry(headers, "/work-42", now - 2000));
    assert.ok(!validAdminEntry(new Headers({ cookie: `${ADMIN_ENTRY_COOKIE}=${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}` }), "/work-42", now));
    assert.ok(!validAdminEntry(new Headers({ cookie: `${ADMIN_ENTRY_COOKIE}=forged` }), "/work-42", now));
    assert.ok(!validAdminEntry(undefined, "/work-42", now));
    process.env.BETTER_AUTH_SECRET = "too-short";
    assert.ok(!validAdminEntry(headers, "/work-42", now));
    assert.throws(() => issueAdminEntry("/work-42", now));
  } finally {
    if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});
