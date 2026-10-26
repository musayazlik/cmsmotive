import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { createProduct, getProduct, savePriceRecord, updateProduct } from "@/mcp/lib/catalog";
import { uploadMediaRecord, updateMediaRecord } from "@/mcp/lib/media";
import { resolveMcpActor, runInStore } from "@/mcp/context";
import spec from "@/content/products/forma-saas-starter-kit/product.json";

// Explicit opt-in: this imports catalogue content into the configured database.
// It uses the same store scoping, validation and uploads as the panel/MCP.
const apply = process.argv.includes("--apply");
const root = process.cwd();
const checkpointPath = path.join(root, ".temp_files/forma-import.json");

async function main() {
  const store = await prisma.store.findUniqueOrThrow({ where: { key: spec.storeKey } });
  await runInStore(store.id, async () => {
    const actor = await resolveMcpActor();
    let product = await prisma.product.findUnique({
      where: { storeId_slug: { storeId: store.id, slug: spec.slug } },
    });
    if (!apply) {
      console.log(JSON.stringify(product ? await getProduct({ id: product.id }) : {
        store: store.key, product: spec.name, status: "not imported", instruction: "Run with --apply to create the preview.",
      }, null, 2));
      return;
    }
    // A completed import is read-only on subsequent invocations.
    if (product?.status === "preview" && product.coverId &&
        await prisma.productGallery.count({ where: { productId: product.id } }) === 6) {
      console.log(JSON.stringify(await getProduct({ id: product.id }), null, 2));
      return;
    }
    assert(!product || product.status === "draft", "Existing non-draft product will not be overwritten.");
    assert.equal(spec.images.filter((image) => image.role === "cover").length, 1);
    assert.equal(spec.images.filter((image) => image.role === "gallery").length, 6);
    const files = await Promise.all(spec.images.map(async (image) => {
      const bytes = await readFile(path.join(root, "public/products", spec.slug, image.file));
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Expected a PNG image");
      assert(bytes.length < 8 * 1024 * 1024, "Image exceeds the upload limit");
      return { ...image, bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }));
    type Checkpoint = { storeId: string; assets: Record<string, string> };
    let checkpoint: Checkpoint = { storeId: store.id, assets: {} };
    try {
      checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
      assert.equal(checkpoint.storeId, store.id, "Checkpoint belongs to another store");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(path.dirname(checkpointPath), { recursive: true });
    const assets: string[] = [];
    for (const file of files) {
      let id = checkpoint.assets[file.file];
      if (id && !await prisma.mediaAsset.findFirst({ where: { id, storeId: store.id } })) id = "";
      if (!id) {
        const uploaded = await uploadMediaRecord({
          fileName: `forma-${file.file}`, mimeType: "image/png", base64: file.bytes.toString("base64"),
        }, actor.id);
        id = uploaded.id;
        checkpoint.assets[file.file] = id;
        await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
      }
      await updateMediaRecord(id, { alt: file.alt });
      await prisma.mediaAsset.update({ where: { id }, data: { width: file.width, height: file.height } });
      assets.push(id);
      console.log(`Media ready: ${file.file} (${file.width}x${file.height})`);
    }
    const { storeKey: _store, images: _images, prices, status: _status, ...content } = spec;
    const input = { ...content, coverId: assets[0], galleryIds: assets.slice(1) };
    if (product) await updateProduct(product.id, input);
    else {
      const created = await createProduct(input);
      product = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    }
    for (const price of prices) {
      const existing = await prisma.price.findFirst({ where: { productId: product.id, name: price.name } });
      if (!existing) await savePriceRecord(product.id, null, price);
    }
    await updateProduct(product.id, { status: spec.status });
    const saved = await getProduct({ id: product.id });
    await writeFile(path.join(root, ".temp_files/forma-product-result.json"), JSON.stringify(saved, null, 2));
    console.log(JSON.stringify(saved, null, 2));
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
