export type CommentAiResult = {
  status: "passed" | "flagged" | "error" | "unavailable";
  note: string;
  model: string | null;
};

/** Unknown or malformed model output must never be treated as a pass. */
export function parseCommentAiResult(content: string): Pick<CommentAiResult, "status" | "note"> | null {
  try {
    const value: unknown = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { status, note } = value as Record<string, unknown>;
    if ((status !== "passed" && status !== "flagged") || typeof note !== "string" || !note.trim() || note.length > 600) return null;
    return { status, note: note.trim() };
  } catch { return null; }
}
