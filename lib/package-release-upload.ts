import { randomUUID } from "node:crypto";
import { finalPackageKey, issuePackageReceipt, r2FileKey, readPackageReceipt, type PackageUploadRequest } from "./package-upload";
import type { r2PackageStorage } from "./package-storage";
import { auditFailureMessage, type PackageAudit } from "./package-audit";

type Release = { id: string; fileKey: string };
type Dependencies = {
  bucket: string;
  storage: ReturnType<typeof r2PackageStorage>;
  findProduct: (id: string) => Promise<{ id: string; codeLicense: string } | null>;
  findRelease: (productId: string, version: string) => Promise<Release | null>;
  createRelease: (data: { productId: string; version: string; fileName: string; fileKey: string; codeLicense: string; audit?: PackageAudit }) => Promise<{ id: string }>;
  /** Refuses a product's code licence (e.g. not GPL where the store requires it); returns the reason. */
  licenseProblem?: (license: string) => string | null;
  /** Licence audit of the uploaded ZIP; errors refuse the upload, the report is stored with the release. */
  audit?: (bucket: string, key: string, declaredLicense: string) => Promise<PackageAudit>;
};
const reply = (data: Record<string, unknown>, status = 200) => ({ data, status });

/** Store/actor authorization is checked by the route, and again in the signed receipt on completion. */
export async function handlePackageUpload(input: PackageUploadRequest, actor: { userId: string; storeId: string }, deps: Dependencies) {
  const { storage } = deps;
  const receipt = input.action === "complete" ? readPackageReceipt(input.receipt, actor) : null;
  if (input.action === "complete" && (!receipt || receipt.bucket !== deps.bucket)) return reply({ error: "This upload expired or belongs to another account or store. Upload the file again." }, 403);
  const upload = receipt ?? (input as Extract<PackageUploadRequest, { action: "prepare" }>);
  const product = await deps.findProduct(upload.productId);
  if (!product) return reply({ error: "Product not found." }, 404);
  const license = product.codeLicense.trim();
  if (!license) return reply({ error: "Set the code license in the package checklist first." }, 400);
  const licenseProblem = deps.licenseProblem?.(license);
  if (licenseProblem) return reply({ error: licenseProblem }, 400);
  const existing = await deps.findRelease(product.id, upload.version);
  const finalKey = receipt ? finalPackageKey(receipt.key) : null;
  if (existing) {
    if (receipt && existing.fileKey === r2FileKey(receipt.bucket, finalKey!)) return reply({ releaseId: existing.id });
    return reply({ error: "This release version already exists. Upload a new version instead." }, 409);
  }
  if (receipt && receipt.codeLicense !== license) return reply({ error: "The code license changed during upload. Upload the package again." }, 409);

  try {
    if (input.action === "prepare") {
      const key = `staging/${actor.storeId}/${product.id}/${randomUUID()}.zip`;
      const token = issuePackageReceipt({ ...input, ...actor, bucket: deps.bucket, key, codeLicense: license });
      const url = await storage.uploadUrl(deps.bucket, key, input.fileSize);
      return reply({ url, receipt: token });
    }
    const pending = receipt!;
    const object = await storage.inspect(pending.bucket, pending.key);
    if (object.ContentLength !== pending.fileSize || object.ContentType !== "application/zip" || !object.ETag) return reply({ error: "Uploaded file does not match the selected ZIP. Upload it again." }, 400);
    const audit = deps.audit ? await deps.audit(pending.bucket, pending.key, license) : undefined;
    if (audit?.errors.length) {
      await storage.remove(pending.bucket, pending.key).catch(() => console.error("R2 staging cleanup failed."));
      return reply({ error: auditFailureMessage(audit), audit }, 422);
    }
    await storage.promote(pending.bucket, pending.key, finalKey!, object.ETag);
    let release: { id: string };
    try {
      release = await deps.createRelease({
        productId: product.id, version: pending.version, fileName: pending.fileName,
        fileKey: r2FileKey(pending.bucket, finalKey!), codeLicense: license, audit,
      });
    } catch (error) {
      const winner = await deps.findRelease(product.id, pending.version);
      if (winner?.fileKey === r2FileKey(pending.bucket, finalKey!)) return reply({ releaseId: winner.id });
      await storage.remove(pending.bucket, finalKey!).catch(() => undefined);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return reply({ error: "This version was uploaded by another request. Choose a new version." }, 409);
      throw error;
    }
    await storage.remove(pending.bucket, pending.key).catch(() => console.error("R2 staging cleanup failed."));
    return reply({ releaseId: release.id });
  } catch {
    return reply({ error: "Package storage could not complete the request. Check the R2 credentials, bucket permissions and CORS settings, then retry." }, 502);
  }
}
