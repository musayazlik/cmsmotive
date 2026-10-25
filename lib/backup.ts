import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/backup-shared";
import { parseBackup, type Backup } from "@/lib/backup-validation";

/** One database snapshot prevents a concurrent edit from leaving dangling references in an export. */
export async function readBackup(tx: Prisma.TransactionClient) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    users: await tx.user.findMany({ select: { id: true, email: true } }),
    data: {
      stores: await tx.store.findMany(),
      storeDomains: await tx.storeDomain.findMany(),
      storeSettings: await tx.storeSetting.findMany(),
      themes: await tx.theme.findMany(),
      extensions: await tx.extension.findMany(),
      themeGallery: await tx.themeGallery.findMany(),
      extensionGallery: await tx.extensionGallery.findMany(),
      changelog: await tx.changelogEntry.findMany(),
      media: await tx.mediaAsset.findMany(),
      posts: await tx.post.findMany(),
      categories: await tx.category.findMany(),
      tags: await tx.tag.findMany(),
      postTags: await tx.postTag.findMany(),
      comments: await tx.postComment.findMany(),
      reviews: await tx.productReview.findMany(),
      inquiries: await tx.contactInquiry.findMany(),
      subscribers: await tx.newsletterSubscriber.findMany(),
      pageViews: await tx.pageViewDaily.findMany(),
      settings: await tx.setting.findMany({ where: { key: { startsWith: "security." } } }),
    },
  };
}

export async function exportBackup() {
  const backup = await prisma.$transaction(readBackup, { isolationLevel: "RepeatableRead", timeout: 60_000 });
  // The same contract validates both directions, so an unsupported export never reaches the user.
  parseBackup(JSON.parse(JSON.stringify(backup)));
  return backup;
}

/** Bound statement parameters for large installations. */
async function insert<T>(records: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < records.length; offset += 500) await create(records.slice(offset, offset + 500));
}

const json = (value: Prisma.JsonValue) => value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;

/** Exposed for integration tests inside a transaction that is always rolled back. */
export async function restoreBackup(tx: Prisma.TransactionClient, backup: Backup) {
  const d = backup.data;
  const users = await tx.user.findMany({ select: { id: true, email: true, role: true } });
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const mapped = new Map(backup.users.map((user) => [user.id, byEmail.get(user.email.toLowerCase())]));
  const userId = (source: string | null) => source ? mapped.get(source)?.id ?? null : null;
  const adminId = (source: string) => {
    const user = mapped.get(source);
    return user && (user.role === "admin" || user.role === "superadmin") ? user.id : null;
  };
  // Stores are matched by key, so a backup restores onto another installation's stores too.
  const storeIds = new Map<string, string>();
  for (const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...store } of d.stores) {
    const row = await tx.store.upsert({ where: { key: store.key }, create: store, update: store, select: { id: true } });
    storeIds.set(id, row.id);
  }
  const storeId = (source: string) => storeIds.get(source)!;
  const owned = <T extends { storeId: string }>(rows: T[]) => rows.map((row) => ({ ...row, storeId: storeId(row.storeId) }));

  const storeSettings = owned(d.storeSettings).filter((row) => row.key !== "telegram.pairing").map((row) => {
    if (row.key === "mcp.actor.userId") {
      const actor = adminId(row.value);
      // An unmapped explicit actor must not silently fall back to another administrator.
      if (row.value && !actor) return { ...row, value: "" };
      return { ...row, value: actor ?? "" };
    }
    if (row.key === "telegram.links") {
      const links: unknown = JSON.parse(row.value);
      if (!Array.isArray(links)) throw new Error("Invalid Telegram account links.");
      return { ...row, value: JSON.stringify(links.flatMap((link: unknown) => {
        if (!link || typeof link !== "object" || !("userId" in link) || typeof link.userId !== "string") throw new Error("Invalid Telegram account link.");
        const actor = adminId(link.userId);
        return actor ? [{ ...link, userId: actor }] : [];
      })) };
    }
    return row;
  });
  for (const source of d.storeSettings.filter((row) => row.key === "mcp.actor.userId")) {
    if (!source.value || adminId(source.value)) continue;
    const enabled = storeSettings.find((row) => row.storeId === storeId(source.storeId) && row.key === "mcp.http.enabled");
    if (enabled) enabled.value = "false";
  }

  // Delete children before parents. Authentication and storage objects are never deleted.
  await tx.postComment.deleteMany();
  await tx.postTag.deleteMany();
  await tx.productReview.deleteMany();
  await tx.changelogEntry.deleteMany();
  await tx.themeGallery.deleteMany();
  await tx.extensionGallery.deleteMany();
  await tx.post.deleteMany();
  await tx.theme.deleteMany();
  await tx.extension.deleteMany();
  await tx.category.deleteMany();
  await tx.tag.deleteMany();
  await tx.mediaAsset.deleteMany();
  await tx.contactInquiry.deleteMany();
  // Consent and withdrawals are not replaceable content. Never delete them during a restore.
  await tx.pageViewDaily.deleteMany();
  await tx.setting.deleteMany({ where: { key: { startsWith: "security." } } });
  await tx.storeSetting.deleteMany({ where: { storeId: { in: [...storeIds.values()] } } });
  // Domains are replaced only for the stores the backup carries; other stores keep theirs.
  await tx.storeDomain.deleteMany({ where: { storeId: { in: [...storeIds.values()] } } });

  await insert(d.storeDomains.map((row) => ({ ...row, storeId: storeId(row.storeId) })), (data) => tx.storeDomain.createMany({ data }));
  await insert(owned(d.media).map((row) => ({ ...row, uploadedById: userId(row.uploadedById) })), (data) => tx.mediaAsset.createMany({ data }));
  await insert(owned(d.categories), (data) => tx.category.createMany({ data }));
  await insert(owned(d.tags), (data) => tx.tag.createMany({ data }));
  await insert(owned(d.themes).map((row) => ({ ...row, compliance: json(row.compliance), compatibility: json(row.compatibility), licences: json(row.licences) })), (data) => tx.theme.createMany({ data }));
  await insert(owned(d.extensions).map((row) => ({ ...row, compliance: json(row.compliance), compatibility: json(row.compatibility) })), (data) => tx.extension.createMany({ data }));
  await insert(d.themeGallery, (data) => tx.themeGallery.createMany({ data }));
  await insert(d.extensionGallery, (data) => tx.extensionGallery.createMany({ data }));
  await insert(d.changelog.map((row) => ({ ...row, changes: json(row.changes) })), (data) => tx.changelogEntry.createMany({ data }));
  await insert(owned(d.posts).map((row) => ({ ...row, authorId: userId(row.authorId) })), (data) => tx.post.createMany({ data }));
  await insert(d.postTags, (data) => tx.postTag.createMany({ data }));
  // Insert replies without parents first; a second pass reconnects them in any source order.
  await insert(d.comments.map((row) => ({
    ...row, parentId: null, aiReviewToken: null,
    aiStatus: row.aiStatus === "checking" ? "pending" : row.aiStatus,
  })), (data) => tx.postComment.createMany({ data }));
  for (const row of d.comments) {
    if (row.parentId) await tx.postComment.update({ where: { id: row.id }, data: { parentId: row.parentId } });
  }
  await insert(owned(d.reviews), (data) => tx.productReview.createMany({ data }));
  await insert(owned(d.inquiries), (data) => tx.contactInquiry.createMany({ data }));
  for (const row of owned(d.subscribers)) {
    await tx.newsletterSubscriber.upsert({
      where: { storeId_email_source: { storeId: row.storeId, email: row.email.toLowerCase(), source: row.source } },
      update: {},
      create: { ...row, email: row.email.toLowerCase(), confirmedAt: null, confirmationTokenHash: null, confirmationExpiresAt: null, unsubscribeTokenHash: null },
    });
  }
  await insert(owned(d.pageViews), (data) => tx.pageViewDaily.createMany({ data }));
  await insert(d.settings, (data) => tx.setting.createMany({ data }));
  await insert(storeSettings, (data) => tx.storeSetting.createMany({ data }));
}

export async function importBackup(backup: Backup) {
  await prisma.$transaction((tx) => restoreBackup(tx, backup), { isolationLevel: "Serializable", timeout: 60_000, maxWait: 10_000 });
}
