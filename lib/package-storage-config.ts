export const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;
export type PackageStorageProvider = "uploadthing" | "r2";

/** Origins of the websites uploading files, not the R2 API or bucket URL. */
export function r2CorsOrigins(raw = process.env.R2_CORS_ORIGINS || "") {
  const entries = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error("Set R2_CORS_ORIGINS to your panel website origins, for example http://global.localhost:9485,https://cmsmotive.com.");
  return [...new Set(entries.map((entry, index) => {
    const label = `R2_CORS_ORIGINS item ${index + 1}`;
    let url: URL;
    try { url = new URL(entry); }
    catch { throw new Error(`${label} is not a valid website origin. Include http:// or https://.`); }
    if (!/^https?:\/\//i.test(entry) || entry.includes("\\") || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error(`${label} must be an HTTP(S) website origin without credentials, query parameters or fragments.`);
    }
    if (url.hostname.endsWith(".r2.cloudflarestorage.com")) throw new Error(`${label} is an R2 storage endpoint. Use the panel website origin (for example https://cmsmotive.com), not the bucket URL.`);
    if (url.pathname !== "/") throw new Error(`${label} contains a path. Use only the scheme, hostname and optional port, for example https://cmsmotive.com.`);
    if (url.hostname.includes("*")) throw new Error(`${label} must name an exact panel website host, without wildcards.`);
    return url.origin;
  }))];
}

export function packageStorageProvider(env: Record<string, string | undefined> = process.env): PackageStorageProvider {
  const provider = env.PACKAGE_STORAGE_PROVIDER?.trim() || "uploadthing";
  if (provider !== "uploadthing" && provider !== "r2") throw new Error("PACKAGE_STORAGE_PROVIDER must be uploadthing or r2.");
  return provider;
}

export function r2Config(env: Record<string, string | undefined> = process.env) {
  const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`R2 is not configured. Set ${missing.join(", ")} on the server.`);
  const accountId = env.R2_ACCOUNT_ID!.trim();
  const bucket = env.R2_BUCKET_NAME!.trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("R2_ACCOUNT_ID must be the Cloudflare account ID (32 hexadecimal characters).");
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error("R2_BUCKET_NAME must contain 3–63 lowercase letters, numbers or hyphens.");
  return {
    accountId, bucket,
    accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
  };
}

export function packageStorageStatus(selected?: PackageStorageProvider) {
  try {
    const provider = selected ?? packageStorageProvider();
    if (provider === "r2") {
      r2Config();
      if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) throw new Error("Set BETTER_AUTH_SECRET to at least 32 characters before uploading packages.");
    }
    else if (!process.env.UPLOADTHING_TOKEN?.trim()) throw new Error("UploadThing is not configured.");
    return { provider, configured: true, error: "" };
  } catch (error) {
    return { provider: "r2" as const, configured: false, error: error instanceof Error ? error.message : "Package storage is not configured." };
  }
}
