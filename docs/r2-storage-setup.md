# Private product packages with Cloudflare R2

In **Settings → Media**, each store selects UploadThing or Cloudflare R2
independently for **Product files (ZIP)**, **Images** and **Videos**. The choices
apply to product/blog uploads, editor embeds, the media library, AI images,
MCP and Telegram. Image optimization is retained for either provider.
`PACKAGE_STORAGE_PROVIDER` is only the default for ZIPs in stores without a
saved choice. Images and videos default to UploadThing until a choice is saved.
The existing 128 MB package limit, code-license requirement, store admin
permissions and customer purchase/entitlement checks still apply.
Provider changes apply to new uploads; existing files stay at their original
provider and continue to render and support deletion. Missing server
credentials are shown in settings and rejected on save/upload.

## Environment

The following placeholders are in `.env.example` and were added to local
`.env` without replacing existing values:

```dotenv
PACKAGE_STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="cmsmotive-packages"
R2_CORS_ORIGINS="http://localhost:9485,http://global.localhost:9485,http://typo3.localhost:9485,https://cmsmotive.com,https://www.cmsmotive.com,https://cmsmotive.de,https://www.cmsmotive.de"
```

Use your actual local port and exact panel origins.
These are the websites where the admin panel opens, not the
`<account>.r2.cloudflarestorage.com` endpoint or a bucket URL. For example,
`https://cmsmotive.com` is valid; `https://cmsmotive.com/panel` is not.
An optional trailing slash is normalized automatically.
`R2_ACCOUNT_ID` is the 32-character Cloudflare account ID. The access key ID
and secret come from an **R2 S3 API token**, not the general Cloudflare API token.
The existing `BETTER_AUTH_SECRET` must contain at least 32 characters; upload
receipts are signed with this secret. None of these secrets are browser variables.

## Create the storage structures

1. Enable R2 in your Cloudflare account. R2 has usage-based billing and a free
   allowance; account activation may require payment details.
2. For the setup command, create a temporary R2 token with **Admin Read & Write**
   permission and put its S3 credentials in the environment fields above.
   Bucket creation, CORS and lifecycle management need bucket administration.
3. Preview the setup (no network calls or mutations):

   ```powershell
   pnpm storage:r2:setup
   ```

4. Apply it:

   ```powershell
   pnpm storage:r2:setup --apply
   ```

   This creates the named bucket if absent, adds the required browser CORS
   rule, and installs a one-day expiration rule for abandoned `staging/`
   objects. Other CORS and lifecycle rules are preserved. Use a dedicated
   package bucket. On an existing bucket, verify that neither an existing
   expiration rule nor public access applies to the `packages/` prefix.

5. Keep the bucket's **Public Development URL** and **Custom Domains** disabled.
   The setup command does not enable public access.
6. Replace the setup credentials with a token granting **Object Read & Write**
   scoped to this bucket, and revoke the temporary admin token. The running
   application only needs object operations.
7. Restart the app. Add the same server environment variables to your deployed
   environment. No database migration is required.

Alternatively, create the bucket and configure CORS/lifecycle in the Cloudflare
dashboard; then only bucket-scoped Object Read & Write credentials are needed.

Minimal bucket CORS (replace origins with your actual panel origins):

```json
[
  {
    "AllowedOrigins": ["http://global.localhost:9485", "https://cmsmotive.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Upload and download flow

In the product's Packages tab, save a code license, select a ZIP, enter a new
version, and upload. The app issues a 15-minute signed PUT URL and an upload
receipt bound to the administrator, store, product, version, filename, size,
license and object key. The browser sends the bytes directly to R2.

Completion rechecks admin/store access, receipt integrity, current license,
version uniqueness, and the uploaded object's size and content type. The
server conditionally copies the inspected staging object to a separate
`packages/` key before registering the release. The browser's temporary PUT
URL cannot overwrite the registered package. Successful completion requests
can be retried without creating duplicate releases. Staging cleanup failures
are handled by the one-day lifecycle rule.

The database stores `r2://<bucket>/packages/...` in `ProductRelease.fileKey`.
The bucket is part of the reference so changing the upload bucket does not
redirect older releases. Do not change the R2 account or revoke access to old
buckets while releases still reference them. Existing plain UploadThing keys
continue to use UploadThing for download and deletion, independently of the
currently selected upload provider.

`/api/downloads/:id` checks the verified customer's purchase entitlement before
issuing a 60-second signed GET link. The link can be used by its holder until
expiry. No package URL is published in the media library.

## Images and videos

R2 media uses the same configured private bucket with separate `media/` keys.
Browser uploads first enter `staging/media/`; completion verifies size and
MIME type, copies the inspected object to its final key and registers it in
the store's media library. Image uploads are limited to 8 MB and videos to
64 MB. Server uploads from AI/MCP/Telegram use the same saved choices.

The media library stores a stable `/api/media/r2/<bucket>/media/...` URL.
This public route serves registered images and videos and supports byte
ranges for video playback; it never serves `packages/` or `staging/` keys.
The bucket itself remains private. Media bytes pass through the application,
so deployment bandwidth/function limits also apply. SVG responses are
sandboxed and cannot run scripts on the site's origin.

## Verification

```powershell
pnpm test:package-storage
pnpm test:media-storage
pnpm typecheck
```

Offline tests cover validation, upload receipt tampering/expiry/store binding,
signed URLs, and the storage promotion/delete operations. A live Cloudflare
upload requires real credentials. After setup, test an upload, customer
download, unauthenticated download rejection and package deletion with a
disposable product release.

Official references: [R2 tokens](https://developers.cloudflare.com/r2/api/tokens/),
[signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
