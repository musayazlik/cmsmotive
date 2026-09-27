import { statfs } from "node:fs/promises";
import os from "node:os";
import { prisma } from "@/lib/prisma";
import { utapi } from "@/lib/utapi";

/**
 * Status snapshot for the panel overview: host resources, mail delivery
 * (Plunk + local database), UploadThing storage and daily content reads.
 * Every external source degrades to null instead of failing the page.
 */

export type SystemStatus = {
  cores: number;
  /** 1-minute load average normalized to all cores, 0–100. */
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
};

export type MailStatus = {
  /** PLUNK_SECRET_KEY / PLUNK_FROM_EMAIL are both present. */
  plunkConfigured: boolean;
  /** Contacts reported by the Plunk API; null when unreachable. */
  plunkContacts: number | null;
  inquiriesTotal: number;
  inquiriesUnread: number;
  emailsSent: number;
  emailsFailed: number;
  subscribers: number;
};

export type StorageStatus = {
  filesUploaded: number;
  totalBytes: number;
  limitBytes: number;
};

export type DailyReads = {
  /** Newest first, always a continuous range of `days` entries. */
  days: { date: string; views: number; topSlug: string | null; topViews: number }[];
  totalAllTime: number;
};

const PLUNK_BASE = "https://next-api.useplunk.com";

export async function getSystemStatus(): Promise<SystemStatus> {
  const cores = os.cpus().length || 1;
  const [load1] = os.loadavg();
  let ramTotal = os.totalmem();
  let ramUsed = ramTotal - os.freemem();
  let diskTotal = 0;
  let diskUsed = 0;
  try {
    const fs = await statfs(process.cwd());
    diskTotal = fs.blocks * fs.bsize;
    diskUsed = (fs.blocks - fs.bfree) * fs.bsize;
  } catch (error) {
    console.error("status: statfs failed", error);
  }
  return {
    cores,
    cpuPercent: Math.min(100, Math.round((load1 / cores) * 100)),
    ramUsed,
    ramTotal,
    diskUsed,
    diskTotal,
  };
}

/** Contacts total from the Plunk dashboard API; the documented first-page shape. */
async function plunkContactsTotal(key: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${PLUNK_BASE}/contacts?limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const total = (data as { total?: unknown } | null)?.total;
    return typeof total === "number" ? total : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMailStatus(): Promise<MailStatus> {
  const key = process.env.PLUNK_SECRET_KEY;
  const plunkConfigured = Boolean(key && process.env.PLUNK_FROM_EMAIL);
  const [plunkContacts, inquiriesTotal, inquiriesUnread, emailsSent, subscribers] = await Promise.all([
    plunkConfigured && key ? plunkContactsTotal(key) : Promise.resolve(null),
    prisma.contactInquiry.count(),
    prisma.contactInquiry.count({ where: { readAt: null } }),
    prisma.contactInquiry.count({ where: { emailSent: true } }),
    prisma.newsletterSubscriber.count(),
  ]);
  return {
    plunkConfigured,
    plunkContacts,
    inquiriesTotal,
    inquiriesUnread,
    emailsSent,
    emailsFailed: inquiriesTotal - emailsSent,
    subscribers,
  };
}

export async function getStorageStatus(): Promise<StorageStatus | null> {
  try {
    const usage = await utapi.getUsageInfo();
    return { filesUploaded: usage.filesUploaded, totalBytes: usage.totalBytes, limitBytes: usage.limitBytes };
  } catch (error) {
    console.error("status: UploadThing usage failed", error);
    return null;
  }
}

export async function getDailyReads(days = 14): Promise<DailyReads> {
  const today = new Date();
  const first = new Date(today);
  first.setUTCDate(first.getUTCDate() - (days - 1));
  first.setUTCHours(0, 0, 0, 0);

  const [rows, allTime] = await Promise.all([
    prisma.pageViewDaily.findMany({
      where: { date: { gte: first } },
      orderBy: [{ date: "desc" }, { views: "desc" }],
    }),
    prisma.pageViewDaily.aggregate({ _sum: { views: true } }),
  ]);

  // Bucket by day keeps the top slug per day; the loop below fills quiet
  // days so the table always shows a continuous range.
  const byDay = new Map<string, { views: number; topSlug: string | null; topViews: number }>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.views += row.views;
    } else {
      byDay.set(key, { views: row.views, topSlug: row.slug, topViews: row.views });
    }
  }

  const out: DailyReads["days"] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(first);
    day.setUTCDate(day.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    out.push({ date: key, views: bucket?.views ?? 0, topSlug: bucket?.topSlug ?? null, topViews: bucket?.topViews ?? 0 });
  }

  return { days: out, totalAllTime: allTime._sum.views ?? 0 };
}
