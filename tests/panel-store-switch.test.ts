import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPanelStore } from "../lib/panel-store-selection";
import { storePanelHref, type RequestStore, type Store } from "../lib/stores";

const first: Store = { id: "first", key: "first", name: "First", defaultLocale: "en", locales: ["en"], isDefault: true, hosts: ["first.example"] };
const second: Store = { ...first, id: "second", key: "second", name: "Second", isDefault: false, hosts: ["second.example", "www.second.example"] };
const stores = [first, second];
const environment: Record<string, string | undefined> = process.env;

test("known domains and local aliases override stale selection cookies", () => {
  for (const via of ["domain", "dev-alias"] as const) {
    const match: RequestStore = { store: second, via, origin: "https://second.example" };
    assert.equal(selectPanelStore(match, first.id, stores), second);
    assert.equal(selectPanelStore(match, "missing", stores), second);
  }
  const fallback: RequestStore = { store: first, via: "fallback", origin: "http://localhost" };
  assert.equal(selectPanelStore(fallback, second.id, stores), second);
  assert.equal(selectPanelStore(fallback, "missing", stores), first);
  assert.equal(selectPanelStore(fallback, undefined, stores), first);
});

test("switch destinations use local aliases and preserve the dev server port and private panel path", () => {
  const previous = environment.NODE_ENV;
  environment.NODE_ENV = "development";
  try {
    for (const host of ["localhost:9485", "127.0.0.1:9485", "first.localhost:9485", "[::1]:9485"]) {
      assert.equal(storePanelHref(second, new Headers({ host }), "/panel"), "http://second.localhost:9485/panel");
      assert.equal(storePanelHref(second, new Headers({ host }), "/workspace-42"), "http://second.localhost:9485/workspace-42");
    }
  } finally {
    if (previous === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous;
  }
});

test("production switches target the canonical domain and reject stores with no destination domain", () => {
  const previous = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    const headers = new Headers({ host: "internal:3000", "x-forwarded-host": "first.example", "x-forwarded-proto": "https" });
    assert.equal(storePanelHref(second, headers, "/panel"), "https://second.example/panel");
    assert.equal(storePanelHref(second, headers, "/workspace-42"), "https://second.example/workspace-42");
    assert.equal(storePanelHref({ ...second, hosts: [] }, headers, "/panel"), null);
    assert.equal(storePanelHref({ ...second, hosts: [] }, new Headers({ host: "localhost:3000" }), "/panel"), null);
  } finally {
    if (previous === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous;
  }
});
