import { UTApi } from "uploadthing/server";

/**
 * Server-side UploadThing client shared across the panel. Reads the
 * UPLOADTHING_TOKEN env var; one instance per server process keeps the
 * API calls (listFiles, getUsageInfo, deleteFiles) in a single place.
 */
export const utapi = new UTApi();

/**
 * UploadThing caps listFiles at 500 per call, so the media library pages
 * through the whole bucket. 5 pages (2500 files) is a generous ceiling —
 * past that the storage stats from getUsageInfo stay accurate while the
 * table shows the newest slice.
 */
export const UT_PAGE_SIZE = 500;
export const UT_MAX_FILES = 2500;
