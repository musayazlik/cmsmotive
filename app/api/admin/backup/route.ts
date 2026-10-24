import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { adminEntryConfigured } from "@/lib/admin-entry";
import { auth } from "@/lib/auth";
import { exportBackup, importBackup } from "@/lib/backup";
import { MAX_BACKUP_BYTES } from "@/lib/backup-shared";
import { BackupValidationError, parseBackup, summarizeBackup } from "@/lib/backup-validation";

export const runtime = "nodejs";
export const maxDuration = 120;
const privateHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const error = (message: string, status = 400) => Response.json({ error: message }, { status, headers: privateHeaders });

export async function GET() {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  try {
    const backup = JSON.stringify(await exportBackup());
    if (Buffer.byteLength(backup) > MAX_BACKUP_BYTES) return error("This backup exceeds the 25 MB panel limit. Use a database backup for this installation.", 413);
    return new Response(backup, {
      headers: {
        ...privateHeaders, "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cmsmotive-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json"`,
      },
    });
  } catch (cause) {
    console.error("[backup] export failed", cause instanceof Error ? cause.name : "Unknown error");
    return error("The backup could not be exported. No data was changed.", 500);
  }
}

/** Limit actual bytes even for a chunked request with no Content-Length. */
async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BACKUP_BYTES) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BACKUP_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export async function POST(request: Request) {
  const { failure } = await requireAdmin();
  if (failure) return failure;
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Upload a JSON backup.", 415);
  // JSON requests require a same-origin browser request; cross-site forms cannot restore a backup.
  if (request.headers.get("sec-fetch-site") === "cross-site") return error("Cross-site requests are not allowed.", 403);
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (origin) {
    try { if (new URL(origin).host !== host) return error("Cross-site requests are not allowed.", 403); }
    catch { return error("Invalid request origin.", 403); }
  }
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "preview" && mode !== "restore") return error("Choose preview or restore.");

  let input: unknown;
  try { input = await readBody(request); }
  catch (cause) { return error(cause instanceof RangeError ? "Backup files must be smaller than 25 MB." : "The backup is not valid JSON.", cause instanceof RangeError ? 413 : 400); }
  if (!input || typeof input !== "object" || !("backup" in input)) return error("A backup file is required.");

  let backup;
  try { backup = parseBackup(input.backup); }
  catch (cause) { return error(cause instanceof BackupValidationError ? cause.message : "The backup could not be validated."); }
  const summary = summarizeBackup(backup);
  if (summary.panelPath !== "/panel" && !adminEntryConfigured()) return error("Configure a stable BETTER_AUTH_SECRET of at least 32 characters before restoring this private panel address.");
  if (mode === "preview") return Response.json({ summary }, { headers: privateHeaders });

  if (!("confirmation" in input) || input.confirmation !== "RESTORE") return error("Type RESTORE to confirm replacing the current data.");
  if (!("password" in input) || typeof input.password !== "string" || !input.password || input.password.length > 128) return error("Your current password is required.");
  try { await auth.api.verifyPassword({ body: { password: input.password }, headers: request.headers }); }
  catch { return error("Your password could not be verified. Check it or sign in again.", 403); }

  try { await importBackup(backup); }
  catch (cause) {
    console.error("[backup] restore failed", cause instanceof Error ? cause.name : "Unknown error");
    return error("The backup could not be restored. All changes were rolled back; your current data is intact.", 500);
  }
  // A cache failure after commit must never be reported as a database rollback.
  try { revalidatePath("/", "layout"); } catch { console.error("[backup] cache invalidation failed after restore"); }
  return Response.json({ ok: true, panelPath: summary.panelPath }, { headers: privateHeaders });
}
