import "dotenv/config";
import { CreateBucketCommand, GetBucketCorsCommand, GetBucketLifecycleConfigurationCommand, HeadBucketCommand, PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import { r2Config, r2CorsOrigins } from "@/lib/package-storage-config";
import { r2Client } from "@/lib/package-storage";

async function main() {
  const config = r2Config();
  const origins = r2CorsOrigins();
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ bucket: config.bucket, origins, steps: ["Create bucket if absent (private by default)", "Add browser upload CORS", "Expire abandoned staging objects after one day"], instruction: "Run pnpm storage:r2:setup --apply to apply these settings. Other existing CORS and lifecycle rules are preserved." }, null, 2));
    return;
  }
  const client = r2Client(config);
  try { await client.send(new HeadBucketCommand({ Bucket: config.bucket })); }
  catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket })).catch((error) => {
    if (error.$metadata?.httpStatusCode === 404) return { CORSRules: [] };
    throw error;
  });
  const rule = {
    AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["content-type", "content-length"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600,
  };
  const rules = cors.CORSRules ?? [];
  if (!rules.some((existing) => JSON.stringify(existing.AllowedOrigins?.toSorted()) === JSON.stringify(origins.toSorted()) && ["PUT", "GET", "HEAD"].every((method) => existing.AllowedMethods?.includes(method)) && rule.AllowedHeaders.every((header) => existing.AllowedHeaders?.includes(header) || existing.AllowedHeaders?.includes("*")))) {
    await client.send(new PutBucketCorsCommand({ Bucket: config.bucket, CORSConfiguration: { CORSRules: [...rules, rule] } }));
  }
  const lifecycle = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket })).catch((error) => {
    if (error.$metadata?.httpStatusCode === 404) return { Rules: [] };
    throw error;
  });
  const id = "expire-abandoned-package-uploads";
  await client.send(new PutBucketLifecycleConfigurationCommand({ Bucket: config.bucket, LifecycleConfiguration: { Rules: [
    ...(lifecycle.Rules ?? []).filter((rule) => rule.ID !== id),
    { ID: id, Status: "Enabled", Filter: { Prefix: "staging/" }, Expiration: { Days: 1 } },
  ] } }));
  console.log(`R2 bucket ${config.bucket} is ready. Keep public access disabled. Restart the app after changing environment variables.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "R2 setup failed."); process.exitCode = 1; });
