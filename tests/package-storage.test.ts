import assert from "node:assert/strict";
import { test } from "node:test";
import { PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";
import { MAX_PACKAGE_BYTES, packageStorageProvider, r2Config, r2CorsOrigins } from "../lib/package-storage-config";
import { finalPackageKey, issuePackageReceipt, PACKAGE_UPLOAD_TTL, packageUploadSchema, parseR2FileKey, r2FileKey, readPackageReceipt } from "../lib/package-upload";
import { r2Client, r2PackageStorage } from "../lib/package-storage";
import { handlePackageUpload } from "../lib/package-release-upload";

test("CORS accepts website origins and explains mistaken R2 endpoints and paths", () => {
  assert.deepEqual(r2CorsOrigins(" https://CMSMOTIVE.com/,http://global.localhost:9485/,https://cmsmotive.com,https://cmsmotive.com:443 "), ["https://cmsmotive.com", "http://global.localhost:9485"]);
  assert.throws(() => r2CorsOrigins(""), /panel website origins/);
  assert.throws(() => r2CorsOrigins("https://account.r2.cloudflarestorage.com/cmsmotive"), /R2 storage endpoint/);
  assert.throws(() => r2CorsOrigins("https://cmsmotive.com/panel"), /contains a path/);
  assert.throws(() => r2CorsOrigins("cmsmotive.com"), /Include http/);
  assert.throws(() => r2CorsOrigins("https://user:password@cmsmotive.com"), /without credentials/);
  assert.throws(() => r2CorsOrigins("https://cmsmotive.com?test=1"), /query parameters/);
  assert.throws(() => r2CorsOrigins("https://cmsmotive.com#panel"), /fragments/);
  assert.throws(() => r2CorsOrigins("https://*.cmsmotive.com"), /wildcards/);
});

test("storage selection never silently falls back from incomplete R2 to public uploads", () => {
  assert.equal(packageStorageProvider({}), "uploadthing");
  assert.equal(packageStorageProvider({ PACKAGE_STORAGE_PROVIDER: "r2" }), "r2");
  assert.throws(() => packageStorageProvider({ PACKAGE_STORAGE_PROVIDER: "public" }));
  assert.throws(() => r2Config({}), /R2_ACCOUNT_ID.*R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_BUCKET_NAME/);
  assert.throws(() => r2Config({ R2_ACCOUNT_ID: "bad", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET_NAME: "packages" }), /account ID/);
  assert.throws(() => r2Config({ R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET_NAME: "Bad/bucket" }), /R2_BUCKET_NAME/);
});

test("packages reject empty, oversized, non-ZIP and path-bearing filenames", () => {
  const good = { productId: "product", version: "v1.0.0+build-1", fileName: "Forma Theme.ZIP", fileSize: 123 };
  assert.ok(packageUploadSchema.safeParse(good).success);
  assert.ok(packageUploadSchema.safeParse({ ...good, fileSize: MAX_PACKAGE_BYTES }).success);
  for (const fileName of ["app.exe", "../app.zip", "folder/app.zip", "folder\\app.zip", "app\n.zip"]) {
    assert.ok(!packageUploadSchema.safeParse({ ...good, fileName }).success, fileName);
  }
  for (const fileSize of [0, -1, 1.5, MAX_PACKAGE_BYTES + 1]) assert.ok(!packageUploadSchema.safeParse({ ...good, fileSize }).success);
  for (const version of ["", "../v1", "a".repeat(41)]) assert.ok(!packageUploadSchema.safeParse({ ...good, version }).success);
});

test("upload receipts bind object, version and license to one admin and store, rejecting edits and expiry", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-only-receipt-secret-with-over-32-characters";
  try {
    const now = Date.now();
    const actor = { userId: "admin", storeId: "global" };
    const input = { ...actor, productId: "product", version: "v1.0.0", fileName: "forma.zip", fileSize: 12, bucket: "private-packages", key: "staging/global/product/1234-abcd.zip", codeLicense: "Commercial" };
    const token = issuePackageReceipt(input, now);
    assert.deepEqual(readPackageReceipt(token, actor, now), { ...input, expiresAt: now + PACKAGE_UPLOAD_TTL * 1000 });
    assert.equal(readPackageReceipt(token, { ...actor, storeId: "typo3" }, now), null);
    assert.equal(readPackageReceipt(token, { ...actor, userId: "another-admin" }, now), null);
    assert.equal(readPackageReceipt(token, actor, now + PACKAGE_UPLOAD_TTL * 1000), null);
    assert.equal(readPackageReceipt(token, actor, now - 1000), null);
    const [body, signature] = token.split(".");
    const edited = Buffer.from(JSON.stringify({ ...input, fileSize: 500, key: "packages/victim.zip", expiresAt: now + PACKAGE_UPLOAD_TTL * 1000 })).toString("base64url");
    assert.equal(readPackageReceipt(`${edited}.${signature}`, actor, now), null);
    assert.equal(readPackageReceipt(`${body}.invalid`, actor, now), null);
    assert.equal(readPackageReceipt(`${token}.suffix`, actor, now), null);
    process.env.BETTER_AUTH_SECRET = "different-test-only-secret-with-32-characters";
    assert.equal(readPackageReceipt(token, actor, now), null);
    process.env.BETTER_AUTH_SECRET = "short";
    assert.throws(() => issuePackageReceipt(input), /BETTER_AUTH_SECRET/);
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});

test("storage references preserve the original R2 bucket and distinguish legacy UploadThing keys", () => {
  const key = finalPackageKey("staging/global/product/1234-abcd.zip");
  assert.equal(key, "packages/global/product/1234-abcd.zip");
  assert.deepEqual(parseR2FileKey(r2FileKey("old-bucket", key)), { bucket: "old-bucket", key });
  assert.equal(parseR2FileKey("legacy-uploadthing-file-key"), null);
  assert.throws(() => parseR2FileKey("r2://bucket/staging/not-a-release.zip"));
  assert.throws(() => parseR2FileKey("r2://bucket"));
  assert.throws(() => finalPackageKey("staging/../product/1234.zip"));
  assert.throws(() => finalPackageKey("packages/global/product/1234.zip"));
});

test("bucket setup sends R2-compatible MD5 integrity headers instead of unsupported SDK checksum headers", async () => {
  const requests: Record<string, string>[] = [];
  const client = r2Client({ accountId: "a".repeat(32), bucket: "private-packages", accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" }, {
    handle: async (request: { headers: Record<string, string> }) => {
      requests.push(request.headers);
      return { response: { statusCode: 200, headers: {}, body: new Uint8Array() } };
    },
  });
  try {
    await client.send(new PutBucketCorsCommand({ Bucket: "private-packages", CORSConfiguration: { CORSRules: [{ AllowedOrigins: ["https://example.com"], AllowedMethods: ["PUT"] }] } }));
    await client.send(new PutBucketLifecycleConfigurationCommand({ Bucket: "private-packages", LifecycleConfiguration: { Rules: [{ ID: "staging", Status: "Enabled", Filter: { Prefix: "staging/" }, Expiration: { Days: 1 } }] } }));
    assert.equal(requests.length, 2);
    for (const headers of requests) {
      assert.ok(headers["content-md5"]);
      assert.ok(!Object.keys(headers).some((name) => name.startsWith("x-amz-checksum-") || name === "x-amz-sdk-checksum-algorithm"));
    }
  } finally { client.destroy(); }
});

test("R2 signs size/type-limited staging uploads and 60-second attachment downloads without network requests", async () => {
  const client = new S3Client({
    region: "auto", endpoint: "https://fixture.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    requestHandler: { handle: async () => { throw new Error("Signing must not make a network request"); } },
  });
  try {
    const storage = r2PackageStorage(client);
    const put = new URL(await storage.uploadUrl("private-packages", "staging/store/product/abcd.zip", 12));
    assert.equal(put.searchParams.get("X-Amz-Expires"), String(PACKAGE_UPLOAD_TTL));
    assert.equal(put.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
    assert.ok(put.pathname.includes("staging/store/product/abcd.zip"));
    assert.equal(put.searchParams.get("x-amz-acl"), null);
    const get = new URL(await storage.downloadUrl("private-packages", "packages/store/product/abcd.zip", "Forma Theme.zip"));
    assert.equal(get.searchParams.get("X-Amz-Expires"), "60");
    assert.equal(get.searchParams.get("response-content-disposition"), "attachment; filename*=UTF-8''Forma%20Theme.zip");
    assert.ok(get.pathname.includes("packages/store/product/abcd.zip"));
  } finally { client.destroy(); }
});

test("R2 verifies uploaded metadata and copies only the inspected ETag into a separate release object", async () => {
  const requests: { method: string; path: string; headers: Record<string, string> }[] = [];
  const client = new S3Client({
    region: "auto", endpoint: "https://fixture.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    requestHandler: { handle: async (request: { method: string; path: string; headers: Record<string, string> }) => {
      requests.push({ method: request.method, path: request.path, headers: request.headers });
      return { response: {
        statusCode: request.method === "DELETE" ? 204 : 200,
        headers: { "content-length": "12", "content-type": "application/zip", etag: '"fixture-etag"' },
        body: request.method === "PUT" ? Buffer.from('<CopyObjectResult><ETag>"fixture-etag"</ETag><LastModified>2026-10-25T00:00:00Z</LastModified></CopyObjectResult>') : new Uint8Array(),
      } };
    } },
  });
  try {
    const storage = r2PackageStorage(client);
    const inspected = await storage.inspect("private-packages", "staging/store/product/abcd.zip");
    assert.equal(inspected.ContentLength, 12);
    assert.equal(inspected.ContentType, "application/zip");
    await storage.promote("private-packages", "staging/store/product/abcd.zip", "packages/store/product/abcd.zip", inspected.ETag!);
    await storage.remove("private-packages", "staging/store/product/abcd.zip");
    assert.deepEqual(requests.map((request) => request.method), ["HEAD", "PUT", "DELETE"]);
    assert.ok(requests[1].path.includes("packages/store/product/abcd.zip"));
    assert.equal(requests[1].headers["x-amz-copy-source-if-match"], '"fixture-etag"');
    assert.equal(requests[1].headers["x-amz-copy-source"], "private-packages/staging/store/product/abcd.zip");
    assert.ok(requests.every((request) => !("x-amz-acl" in request.headers)));
  } finally { client.destroy(); }
});

test("package registration checks metadata and scope, preserves existing versions and recovers duplicate completion", async (t) => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-only-receipt-secret-with-over-32-characters";
  const actor = { userId: "admin", storeId: "store" };
  const upload = { action: "prepare" as const, productId: "product", version: "1.0.0", fileName: "forma.zip", fileSize: 12 };
  function fixture() {
    const events: string[] = [];
    let saved: { id: string; fileKey: string } | null = null;
    const storage: ReturnType<typeof r2PackageStorage> = {
      uploadUrl: async () => "https://fixture.example/signed-upload",
      inspect: async () => { events.push("inspect"); return { ContentLength: 12, ContentType: "application/zip", ETag: '"etag"', $metadata: {} }; },
      promote: async () => { events.push("promote"); return { $metadata: {} }; },
      remove: async (_bucket, key) => { events.push(`delete:${key.split("/")[0]}`); return { $metadata: {} }; },
      downloadUrl: async () => "https://fixture.example/signed-download",
      read: async () => { events.push("read"); return Buffer.from("zip"); },
    };
    const deps = {
      bucket: "private-packages", storage,
      findProduct: async (_id: string): Promise<{ id: string; codeLicense: string } | null> => ({ id: "product", codeLicense: "Commercial" }),
      findRelease: async (_productId: string, _version: string) => saved,
      createRelease: async (data: { fileKey: string }) => { events.push("register"); saved = { id: "release", fileKey: data.fileKey }; return { id: saved.id }; },
    };
    return { deps, events };
  }
  async function prepared(deps: ReturnType<typeof fixture>["deps"]) {
    const result = await handlePackageUpload(upload, actor, deps);
    assert.equal(result.status, 200);
    return { action: "complete" as const, receipt: result.data.receipt as string };
  }
  try {
    await t.test("successful registration happens after inspection and promotion; retry does not copy or register again", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      assert.deepEqual(await handlePackageUpload(complete, actor, deps), { status: 200, data: { releaseId: "release" } });
      assert.deepEqual(events, ["inspect", "promote", "register", "delete:staging"]);
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 200);
      assert.equal(events.length, 4);
    });
    await t.test("another store or administrator cannot register the upload", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      assert.equal((await handlePackageUpload(complete, { ...actor, storeId: "another-store" }, deps)).status, 403);
      assert.equal((await handlePackageUpload(complete, { ...actor, userId: "another-admin" }, deps)).status, 403);
      assert.deepEqual(events, []);
    });
    await t.test("deleted/cross-store products and missing licenses fail before storage writes", async () => {
      const { deps, events } = fixture();
      deps.findProduct = async () => null;
      assert.equal((await handlePackageUpload(upload, actor, deps)).status, 404);
      deps.findProduct = async () => ({ id: "product", codeLicense: "  " });
      assert.equal((await handlePackageUpload(upload, actor, deps)).status, 400);
      assert.deepEqual(events, []);
    });
    await t.test("a changed license or an existing version prevents completion", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      deps.findProduct = async () => ({ id: "product", codeLicense: "MIT" });
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 409);
      deps.findRelease = async () => ({ id: "another", fileKey: "legacy-uploadthing-key" });
      assert.equal((await handlePackageUpload(upload, actor, deps)).status, 409);
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 409);
      assert.deepEqual(events, []);
    });
    await t.test("wrong content type or size is rejected before promotion", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      deps.storage.inspect = async () => ({ ContentLength: 13, ContentType: "application/zip", ETag: '"etag"', $metadata: {} });
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 400);
      deps.storage.inspect = async () => ({ ContentLength: 12, ContentType: "application/octet-stream", ETag: '"etag"', $metadata: {} });
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 400);
      assert.deepEqual(events, []);
    });
    await t.test("storage errors do not register a release or expose provider credentials", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      deps.storage.promote = async () => { throw new Error("fixture-private-secret"); };
      const result = await handlePackageUpload(complete, actor, deps);
      assert.equal(result.status, 502);
      assert.ok(!JSON.stringify(result).includes("fixture-private-secret"));
      assert.deepEqual(events, ["inspect"]);
    });
    await t.test("a package failing the licence audit is removed from staging and never registered", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      const audit = (errors: { code: string; message: string }[]) => ({
        checkedAt: "", gplRequired: true, errors, warnings: [], licenseFile: null, licenseKind: null, noticesFile: null, sourceFiles: 0, dependencies: [],
      });
      let audited = "";
      const refused = await handlePackageUpload(complete, actor, {
        ...deps,
        audit: async (_bucket, _key, license) => { audited = license; return audit([{ code: "license-missing", message: "Add the licence text." }]); },
      });
      assert.equal(refused.status, 422);
      assert.match(String(refused.data.error), /licence check: Add the licence text\./);
      assert.equal(audited, "Commercial", "the audit sees the declared licence");
      assert.deepEqual(events, ["inspect", "delete:staging"]);

      const passed = fixture();
      const again = await prepared(passed.deps);
      let stored: unknown;
      passed.deps.createRelease = async (data: { fileKey: string; audit?: unknown }) => { stored = data.audit; return { id: "release" }; };
      const ok = await handlePackageUpload(again, actor, { ...passed.deps, audit: async () => audit([]) });
      assert.equal(ok.status, 200);
      assert.deepEqual((stored as { errors: unknown[] }).errors, [], "the report is stored with the release");
    });
    await t.test("a store that requires GPL refuses other code licences before any upload", async () => {
      const { deps, events } = fixture();
      const result = await handlePackageUpload(upload, actor, { ...deps, licenseProblem: (license) => (license === "Commercial" ? "Use GPL-2.0-or-later." : null) });
      assert.deepEqual(result, { status: 400, data: { error: "Use GPL-2.0-or-later." } });
      assert.deepEqual(events, []);
    });
    await t.test("a version race removes only the losing final object", async () => {
      const { deps, events } = fixture();
      const complete = await prepared(deps);
      deps.createRelease = async () => { deps.findRelease = async () => ({ id: "winner", fileKey: "another-upload-key" }); throw Object.assign(new Error("duplicate"), { code: "P2002" }); };
      assert.equal((await handlePackageUpload(complete, actor, deps)).status, 409);
      assert.deepEqual(events, ["inspect", "promote", "delete:packages"]);
    });
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});
