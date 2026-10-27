import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// A separate schema contains every test write; lib modules are imported AFTER
// the shared lib/prisma singleton has been pointed at it (see before()).
const schema = `page_builder_test_${randomUUID().replaceAll("-", "")}`;
const connectionString = process.env.DATABASE_URL!;
const sql = new Client({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
let connected = false;
let created = false;

before(async () => {
  await sql.connect();
  connected = true;
  await sql.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await sql.query(`SET search_path TO "${schema}"`);
  const migrations = await readdir(new URL("../prisma/migrations/", import.meta.url), { withFileTypes: true });
  for (const migration of migrations.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = await readFile(new URL(`../prisma/migrations/${migration.name}/migration.sql`, import.meta.url), "utf8");
    await sql.query(source.replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
  }
  // page-builder modules resolve `prisma` from lib/prisma.ts, which prefers an
  // already existing global — hand it the schema-scoped client (same pattern as
  // tests/store-membership.integration.test.ts).
  (globalThis as unknown as { prisma?: PrismaClient }).prisma = db;
});

after(async () => {
  await db.$disconnect();
  if (created) await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
  if (connected) await sql.end();
});

const h1Document = () => ({
  root: { props: {} },
  content: [
    { type: "HeadingBlock", props: { id: "hero", text: "About us", level: "h1" } },
    { type: "TextBlock", props: { id: "intro", content: "<p>Hello world</p>" } },
  ],
});

test("builder publish flow: draft → publish → revision → registry, per-locale state, isolation, redirects, backup", async (t) => {
  const pages = await import("../lib/page-builder/pages");
  const registry = await import("../lib/page-builder/registry");
  const proxy = await import("../lib/page-builder/proxy-pages");
  const { readBackup, restoreBackup } = await import("../lib/backup");
  const { parseBackup } = await import("../lib/backup-validation");

  const store = await db.store.findFirstOrThrow();
  const defaultLocale = store.defaultLocale;
  // A locale the store did not serve yet — it must stay a draft after publish.
  const secondLocale = ["tr", "en", "fr", "it"].find((candidate) => candidate !== defaultLocale)!;
  const storeLocales = [...new Set([...store.locales, secondLocale])];
  await db.store.update({ where: { id: store.id }, data: { locales: storeLocales } });
  await db.user.create({ data: { id: "pb-admin", name: "Admin", email: "pb-admin@example.test", role: "admin" } });
  const otherStore = await db.store.create({ data: { id: "pb-other-store", key: "pb-other", name: "Other", locales: ["en"] } });

  let pageId = "";
  /** The DB's current PageLocale.version — every later write must send this. */
  let currentVersion = 0;

  await t.test("create → publish refuses an outline without H1 and accepts a valid document", async () => {
    const created = await pages.createPage(store.id, { kind: "landing", slug: "about-us", locale: defaultLocale, title: "About us", userId: "pb-admin" });
    assert.ok("data" in created, "error" in created ? created.error : "");
    if (!("data" in created)) return;
    pageId = created.data.pageId;

    // The draft door validates; a hostile document never reaches the database.
    const invalidSave = await pages.saveDraft(store.id, pageId, defaultLocale, { root: { props: {} }, content: [{ type: "NotABlock", props: {} }] }, 0, "pb-admin");
    assert.equal(invalidSave.ok, false);

    // Publishing without a page title is an accessibility blocker (plan 5.11).
    const noTitle = { root: { props: {} }, content: [{ type: "TextBlock", props: { id: "t", content: "<p>Body</p>" } }] };
    const saved = await pages.saveDraft(store.id, pageId, defaultLocale, noTitle, 0, "pb-admin");
    assert.ok(saved.ok);
    if (!saved.ok) return;
    currentVersion = saved.version;
    const blocked = await pages.publishPage(store.id, pageId, defaultLocale, {}, saved.version);
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.ok(blocked.blockers?.some((message) => message.includes("page title")), JSON.stringify(blocked));

    // The valid draft publishes, writes a revision and lands in the registry.
    const save = await pages.saveDraft(store.id, pageId, defaultLocale, h1Document(), currentVersion, "pb-admin");
    assert.ok(save.ok);
    if (!save.ok) return;
    currentVersion = save.version;

    // Pre-warm the registry cache BEFORE publishing: if invalidation were
    // broken, the 30 s TTL would keep serving exactly this stale snapshot.
    const before = await registry.getStorePageRegistry(store.id);
    assert.ok(!before.pages.some((page) => page.slug === "about-us"));

    const publish = await pages.publishPage(store.id, pageId, defaultLocale, { userId: "pb-admin", note: "First release" }, currentVersion);
    assert.ok(publish.ok, publish.ok ? "" : JSON.stringify(publish));

    const revisions = await pages.listRevisions(store.id, pageId, defaultLocale);
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0]?.note, "First release");

    // The pre-warmed cache was invalidated: the slug is live immediately.
    const list = await registry.getStorePageRegistry(store.id);
    assert.ok(list.pages.some((page) => page.slug === "about-us" && page.locales.includes(defaultLocale)));
    currentVersion = publish.ok ? publish.version : currentVersion;
  });

  await t.test("per-locale state: drafts stay private, published content stays stable, fonts preload", async () => {
    assert.ok(pageId);

    // A second language starts as a draft and is invisible on the public route.
    await pages.ensurePageLocale(store.id, pageId, secondLocale, "About us (2nd)", "pb-admin");
    assert.equal(await pages.findPublishedPageLocale(store.id, "about-us", secondLocale), null);

    // The published snapshot ignores later draft edits (plan 5.7).
    const draftEdit = h1Document();
    (draftEdit.content[1] as { props: { content: string } }).props.content = "<p>Changed draft</p>";
    const saved = await pages.saveDraft(store.id, pageId, defaultLocale, draftEdit, currentVersion, "pb-admin");
    assert.ok(saved.ok);
    if (!saved.ok) return;
    currentVersion = saved.version;

    const view = await pages.findPublishedPageLocale(store.id, "about-us", defaultLocale);
    assert.ok(view);
    assert.equal(view?.locale.title, "About us");
    const text = (view?.locale.published as { content: Array<{ props: { content?: string } }> }).content[1]?.props.content;
    assert.equal(text, "<p>Hello world</p>");
    // Preloads are self-hosted woff2 files only (plan 5.5).
    assert.ok((view?.locale.usedFonts.length ?? 0) >= 1);
    assert.ok(view?.locale.usedFonts.every((file) => file.startsWith("/assets/fonts/") && file.endsWith(".woff2")));
  });

  await t.test("store isolation: another store sees neither the page nor its media", async () => {
    assert.ok(pageId);

    assert.equal(await pages.findPublishedPageLocale(otherStore.id, "about-us", defaultLocale), null);
    assert.equal(await pages.loadPageLocale(otherStore.id, pageId, defaultLocale), null);
    const wrongStoreSave = await pages.saveDraft(otherStore.id, pageId, defaultLocale, h1Document(), currentVersion, "pb-admin");
    assert.equal(wrongStoreSave.ok, false);
    assert.equal(!wrongStoreSave.ok && "status" in wrongStoreSave ? wrongStoreSave.status : 0, 404);

    // An OG image must come from the page's own store media library. The
    // expected version is the CURRENT one, so the only possible failure is
    // the foreign-media rejection.
    const foreignMedia = await db.mediaAsset.create({
      data: { storeId: otherStore.id, key: "foreign", url: "https://example.test/foreign.png", fileName: "foreign.png", fileSize: 1, mimeType: "image/png", uploadedById: "pb-admin" },
    });
    const rejectedSeo = await pages.updatePageSeo(store.id, pageId, defaultLocale, { ogImageId: foreignMedia.id, expectedVersion: currentVersion });
    assert.ok("error" in rejectedSeo, JSON.stringify(rejectedSeo));
    assert.ok(!rejectedSeo.error.toLowerCase().includes("changed elsewhere"), rejectedSeo.error);
  });

  await t.test("versioned writes reject stale optimistic versions", async () => {
    assert.ok(pageId);
    const stale = await pages.saveDraft(store.id, pageId, defaultLocale, h1Document(), 0, "pb-admin");
    assert.ok(!stale.ok && "conflict" in stale && stale.conflict === true, JSON.stringify(stale));
    const staleSeo = await pages.updatePageSeo(store.id, pageId, defaultLocale, { noindex: true, expectedVersion: currentVersion - 1 });
    assert.ok("error" in staleSeo, JSON.stringify(staleSeo));
    // Publishing a stale version aborts instead of shipping old content —
    // both the pre-check and the atomic updateMany guard (plan 5.6/5.7).
    const stalePublish = await pages.publishPage(store.id, pageId, defaultLocale, {}, currentVersion - 1);
    assert.ok(!stalePublish.ok, JSON.stringify(stalePublish));
    assert.ok("error" in stalePublish && stalePublish.error.length > 0);
  });

  await t.test("renaming keeps a 301 redirect through the proxy decision table", async () => {
    assert.ok(pageId);
    // A slug no static-site page or React route claims.
    const preRename = await registry.getStorePageRegistry(store.id);
    assert.ok(preRename.pages.some((page) => page.slug === "about-us"));
    const renamed = await pages.renamePage(store.id, pageId, "pb-about");
    assert.ok("data" in renamed, "error" in renamed ? renamed.error : "");

    // The registry swap is immediate (publish-time invalidation, short TTL).
    const list = await registry.getStorePageRegistry(store.id);
    assert.ok(list.pages.some((page) => page.slug === "pb-about"));
    assert.ok(list.redirects.some((redirect) => redirect.fromSlug === "about-us" && redirect.toSlug === "pb-about"));

    // Unprefixed old address → 301 to the new one (plan 5.8).
    const decision = proxy.decidePagePath({
      pathname: "/about-us",
      method: "GET",
      store: { defaultLocale, locales: storeLocales },
      registry: list,
      legacySlugs: new Set(),
    });
    assert.deepEqual(decision, { action: "redirect", destination: "/pb-about", permanent: true });

    // The default locale's prefixed form shortens to the canonical address.
    const canonical = proxy.decidePagePath({
      pathname: `/${defaultLocale}/pb-about`,
      method: "GET",
      store: { defaultLocale, locales: storeLocales },
      registry: list,
      legacySlugs: new Set(),
    });
    assert.deepEqual(canonical, { action: "redirect", destination: "/pb-about", permanent: true });
  });

  await t.test("unpublish returns the URL to the previous flow immediately", async () => {
    assert.ok(pageId);
    const preOff = await registry.getStorePageRegistry(store.id);
    assert.ok(preOff.pages.some((page) => page.slug === "pb-about"));
    const off = await pages.unpublishPage(store.id, pageId, defaultLocale, "pb-admin");
    assert.ok("data" in off, "error" in off ? off.error : "");
    assert.equal(await pages.findPublishedPageLocale(store.id, "pb-about", defaultLocale), null);
    const list = await registry.getStorePageRegistry(store.id);
    assert.ok(!list.pages.some((page) => page.slug === "pb-about"));
  });

  await t.test("backups round-trip builder pages, locales, revisions and redirects", async () => {
    assert.ok(pageId);
    const raw = await db.$transaction(readBackup, { isolationLevel: "RepeatableRead" });
    const backup = parseBackup(JSON.parse(JSON.stringify(raw)));
    assert.ok(backup.data.pages.some((page) => page.id === pageId && page.slug === "pb-about"));
    assert.ok(backup.data.pageLocales.some((row) => row.pageId === pageId && row.locale === secondLocale));
    assert.ok(backup.data.pageRevisions.length >= 1);
    assert.ok(backup.data.pageRedirects.some((row) => row.fromSlug === "about-us"));

    await db.$transaction((tx) => restoreBackup(tx, backup), { timeout: 30_000 });
    const restored = await db.pageLocale.findUnique({ where: { pageId_locale: { pageId, locale: secondLocale } }, select: { title: true } });
    assert.equal(restored?.title, "About us (2nd)");
    assert.ok(await db.pageRedirect.findFirst({ where: { storeId: store.id, fromSlug: "about-us" } }));
  });
});

test("page creation derives optional addresses and returns an editable language draft", async () => {
  const pages = await import("../lib/page-builder/pages");
  const store = await db.store.findFirstOrThrow();
  const created = await pages.createPage(store.id, { kind: "page", title: "Our new page", locale: store.defaultLocale });
  assert.ok("data" in created, "error" in created ? created.error : "");
  if (!("data" in created)) return;
  const loaded = await pages.loadPageLocale(store.id, created.data.pageId, store.defaultLocale);
  assert.equal(loaded?.page.slug, "our-new-page");
  assert.equal(loaded?.locale?.title, "Our new page");
  assert.equal(loaded?.locale?.status, "draft");
  assert.deepEqual(loaded?.locale?.draft, { content: [], root: {} });
  const duplicate = await pages.createPage(store.id, { kind: "page", title: "Our new page", slug: "   ", locale: store.defaultLocale });
  assert.ok("error" in duplicate);
  const reserved = await pages.createPage(store.id, { kind: "page", title: "Panel", locale: store.defaultLocale });
  assert.ok("error" in reserved);
});

/* ------------------------------------------------------------------ home page inheritance (Faz 3, plan 8) */

test("the home page inherits the root address while published and falls back to legacy after unpublish", async () => {
  const pages = await import("../lib/page-builder/pages");
  const registry = await import("../lib/page-builder/registry");
  const proxy = await import("../lib/page-builder/proxy-pages");

  const store = await db.store.findFirstOrThrow();
  const defaultLocale = store.defaultLocale;
  const secondLocale = ["en", "tr", "fr"].find((candidate) => candidate !== defaultLocale)!;
  await db.user.create({ data: { id: "pb-home-admin", name: "Home Admin", email: "pb-home@example.test", role: "admin" } });

  const created = await pages.createPage(store.id, { kind: "home", locale: defaultLocale, title: "Home", userId: "pb-home-admin" });
  assert.ok("data" in created, "error" in created ? created.error : "");
  if (!("data" in created)) return;
  const pageId = created.data.pageId;

  // A second language starts unpublished: only the default locale inherits.
  await pages.ensurePageLocale(store.id, pageId, secondLocale, "Home (2nd)", "pb-home-admin");
  const draft = await pages.saveDraft(store.id, pageId, defaultLocale, h1Document(), 0, "pb-home-admin");
  assert.ok(draft.ok);
  if (!draft.ok) return;
  const publish = await pages.publishPage(store.id, pageId, defaultLocale, { userId: "pb-home-admin" });
  assert.ok(publish.ok, publish.ok ? "" : JSON.stringify(publish));

  const live = await registry.getStorePageRegistry(store.id);
  const homeRow = live.pages.find((page) => page.slug === "");
  assert.ok(homeRow?.locales.includes(defaultLocale));

  const decide = (pathname: string, list = live) =>
    proxy.decidePagePath({
      pathname,
      method: "GET",
      store: { defaultLocale, locales: [...new Set([defaultLocale, secondLocale])] },
      registry: list,
      legacySlugs: new Set<string>(),
    });

  // Published: the builder inherits the root address (plan 5.9).
  assert.deepEqual(decide("/"), { action: "rewrite", destination: `/${defaultLocale}`, locale: defaultLocale, builder: true });
  assert.deepEqual(decide(`/${secondLocale}`), { action: "rewrite", destination: "/legacy/" + secondLocale + "/index", locale: secondLocale });

  // The newsletter consent version follows the store's legal settings at
  // request time (plan 5.9), whatever the document stored.
  const { resolveLivePageData } = await import("../lib/page-builder/live-data");
  const resolved = await resolveLivePageData(
    { root: { props: {} }, content: [{ type: "NewsletterBlock", props: { id: "home-news", title: "Newsletter", privacyVersion: "0.0" } }] },
    store.id,
    defaultLocale,
  );
  const version = (resolved.content[0] as { props: { privacyVersion?: string } }).props.privacyVersion;
  assert.ok(version && version !== "0.0", `privacyVersion not resolved: ${version}`);

  // Unpublished: the legacy index takes the root back immediately.
  const off = await pages.unpublishPage(store.id, pageId, defaultLocale, "pb-home-admin");
  assert.ok("data" in off, "error" in off ? off.error : "");
  const after = await registry.getStorePageRegistry(store.id);
  assert.deepEqual(decide("/", after), { action: "rewrite", destination: `/legacy/${defaultLocale}/index`, locale: defaultLocale });
});

/* ------------------------------------------------------------------ Faz 4: snippets, scheduling, rollback */

test("snippets, scheduled publishing and revision rollback (Faz 4)", async (t) => {
  const pages = await import("../lib/page-builder/pages");
  const snippets = await import("../lib/page-builder/snippets");
  const otherStore = await db.store.findFirstOrThrow({ where: { id: "pb-other-store" } });

  const store = await db.store.findFirstOrThrow();
  const locale = store.defaultLocale;
  await db.user.create({ data: { id: "pb-faz4-admin", name: "Faz4 Admin", email: "pb-faz4@example.test", role: "admin" } });
  const created = await pages.createPage(store.id, { kind: "landing", slug: "faz-4", locale, title: "Faz 4", userId: "pb-faz4-admin" });
  assert.ok("data" in created, "error" in created ? created.error : "");
  if (!("data" in created)) return;
  const pageId = created.data.pageId;

  await t.test("snippets: save, list, apply helpers, delete and store isolation", async () => {
    const saved = await snippets.saveSnippet(store.id, {
      name: "Hero section",
      kind: "section",
      data: h1Document(),
    });
    assert.ok("data" in saved, "error" in saved ? saved.error : "");

    // Invalid snippets never reach the database.
    const junk = await snippets.saveSnippet(store.id, { name: "Junk", kind: "section", data: { content: [{ type: "Nope", props: {} }] } });
    assert.ok("error" in junk);

    // Another store can neither list nor delete this store's snippets.
    assert.equal((await snippets.listSnippets(otherStore.id)).length, 0);
    const mine = await snippets.listSnippets(store.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].name, "Hero section");
    assert.equal((mine[0].data.content[0] as { type: string }).type, "HeadingBlock");

    const wrongStore = await snippets.deleteSnippet(otherStore.id, mine[0].id);
    assert.ok("error" in wrongStore);
    assert.ok("data" in (await snippets.deleteSnippet(store.id, mine[0].id)));
  });

  await t.test("scheduling: refuses the past, publishes on the sweep, fails gracefully", async () => {
    const draft = await pages.saveDraft(store.id, pageId, locale, h1Document(), 0, "pb-faz4-admin");
    assert.ok(draft.ok && draft.ok === true);
    if (!draft.ok) return;
    const version = draft.version;

    // Future date → scheduled; the sweep leaves it alone.
    const future = await pages.schedulePage(store.id, pageId, locale, new Date(Date.now() + 3_600_000).toISOString(), version, "pb-faz4-admin");
    assert.ok("data" in future, "error" in future ? future.error : "");
    assert.equal((await pages.publishScheduledPages()).published.length, 0);
    let row = await db.pageLocale.findUniqueOrThrow({ where: { pageId_locale: { pageId, locale } } });
    assert.equal(row.status, "scheduled");

    // Stale version rejected; so is a time in the past.
    const stale = await pages.schedulePage(store.id, pageId, locale, new Date().toISOString(), 999);
    assert.ok("error" in stale && stale.error.includes("changed elsewhere"));
    const past = await pages.schedulePage(store.id, pageId, locale, new Date(Date.now() - 1000).toISOString(), version);
    assert.ok("error" in past && past.error.includes("future"));

    // The sweep runs with an explicit clock: two hours later, the future
    // schedule above is due and publishes.
    const sweep = await pages.publishScheduledPages(new Date(Date.now() + 7_200_000));
    assert.deepEqual(sweep.published, [{ pageId, locale }]);
    row = await db.pageLocale.findUniqueOrThrow({ where: { pageId_locale: { pageId, locale } } });
    assert.equal(row.status, "published");

    // A published page cannot be scheduled again.
    const busy = await pages.schedulePage(store.id, pageId, locale, new Date().toISOString(), row.version);
    assert.ok("error" in busy);

    // Cancel returns the language version to draft.
    const off = await pages.unpublishPage(store.id, pageId, locale, "pb-faz4-admin");
    assert.ok("data" in off);
    const cancelled = await pages.schedulePage(store.id, pageId, locale, null, (await db.pageLocale.findUniqueOrThrow({ where: { pageId_locale: { pageId, locale } } })).version);
    assert.ok("data" in cancelled);
    assert.equal((await db.pageLocale.findUniqueOrThrow({ where: { pageId_locale: { pageId, locale } } })).status, "draft");
  });

  await t.test("rollback: a revision becomes the draft through the normal door", async () => {
    const first = await pages.publishPage(store.id, pageId, locale, { userId: "pb-faz4-admin", note: "first" });
    assert.ok(first.ok, first.ok ? "" : JSON.stringify(first));
    if (!first.ok) return;

    const altDocument = {
      root: { props: {} },
      content: [
        { type: "HeadingBlock", props: { id: "h1", text: "Rolled back", level: "h1" } },
      ],
    };
    const secondDraft = await pages.saveDraft(store.id, pageId, locale, altDocument, first.version, "pb-faz4-admin");
    assert.ok(secondDraft.ok);
    const second = await pages.publishPage(store.id, pageId, locale, { userId: "pb-faz4-admin", note: "second" });
    assert.ok(second.ok);

    const revisions = await pages.listRevisions(store.id, pageId, locale);
    const firstRevision = revisions.find((revision) => revision.note === "first");
    assert.ok(firstRevision);
    const stored = await db.pageRevision.findUniqueOrThrow({ where: { id: firstRevision.id } });

    // The editor path: revision data through saveDraft at the current version.
    const rollback = await pages.saveDraft(store.id, pageId, locale, stored.data, second.version, "pb-faz4-admin");
    assert.ok(rollback.ok);
    const row = await db.pageLocale.findUniqueOrThrow({ where: { pageId_locale: { pageId, locale } } });
    assert.equal((row.draft as { content: Array<{ props: { text?: string } }> }).content[0].props.text, "About us");
  });
});
