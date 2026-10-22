import { DEFAULT_RESEARCH_MODEL, NATIVE_RESEARCH, type InlineCitations } from "@/lib/ai-settings-shared";
import { chatCompletion, type ChatCitation } from "@/lib/openrouter";
import { DEPTH_WORDS, type Research, type Source, type WriteRequest } from "./ai-writer-shared";

/**
 * Web research and citation plumbing for the AI writer: gathering notes
 * with numbered sources, linking and renumbering the markers in the
 * finished text, and rendering the bibliography.
 */

function researchModelFor(request: WriteRequest): string {
  if (!request.researchModel) return DEFAULT_RESEARCH_MODEL;
  return request.researchModel === NATIVE_RESEARCH ? request.model : request.researchModel;
}

/**
 * Web research ahead of writing. The research model's own [n] markers point
 * at its raw source list (duplicates included); they are renumbered here so
 * the bibliography lists each URL once, in the order it is first cited.
 */
export async function research(request: WriteRequest, signal?: AbortSignal): Promise<Research> {
  const model = researchModelFor(request);
  const subject = request.current
    ? `Research for revising the article "${request.current.title}". What the editor wants: ${request.topic}`
    : `Research this blog topic: ${request.topic}`;
  const result = await chatCompletion({
    model,
    system: [
      "You are a meticulous research assistant preparing notes for a blog article.",
      `Today is ${new Date().toISOString().slice(0, 10)}. Search the web and gather current, verifiable information.`,
      "Write detailed research notes in English: key facts, figures, dates, names, short quotes, background, and differing viewpoints.",
      "Put a source marker like [1] directly after every fact. Prefer primary and authoritative sources: official sites, documentation, security advisories, reputable news outlets.",
      "If something cannot be verified, say so explicitly instead of guessing.",
    ].join(" "),
    user: `${subject}\nAudience: agencies, developers and marketing teams working with TYPO3. Depth of the planned article: ${DEPTH_WORDS[request.depth]}.`,
    webSearch: true,
    maxResults: 10,
    // Deep-research models run many searches and can take several minutes.
    timeoutMs: /deep-research/.test(model) ? 600_000 : 240_000,
    signal,
  });

  const sources: Source[] = [];
  const numbers = new Map<string, number>();
  const numberOf = (source: ChatCitation | undefined) => {
    if (!source?.url) return null;
    let n = numbers.get(source.url);
    if (!n) {
      n = sources.length + 1;
      numbers.set(source.url, n);
      sources.push({ n, url: source.url, title: source.title });
    }
    return n;
  };
  const notes = result.content.replace(/\[(\d+)\]/g, (_match, digits: string) => {
    const n = numberOf(result.sources[Number(digits) - 1]);
    return n ? `[${n}]` : "";
  });
  // Web-plugin answers often link instead of numbering; their sources still count.
  for (const citation of result.citations) numberOf(citation);
  return { notes, sources, model };
}

/** [3], [2, 5], [1-3] or [1–3]: one marker group as written by the model. */
const MARKER_GROUP = /\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g;

function expandGroup(group: string): number[] {
  return group.split(/\s*,\s*/).flatMap((part) => {
    const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(part);
    if (!range) return [Number(part)];
    const [from, to] = [Number(range[1]), Number(range[2])];
    return to >= from && to - from < 10 ? Array.from({ length: to - from + 1 }, (_, index) => from + index) : [from, to];
  });
}

/**
 * Links every marker to its source and renumbers by first citation in the
 * post, so the bibliography lists only what the text actually cites.
 */
export function citeSources(markdown: string, sources: Source[]): { markdown: string; cited: Source[] } {
  const cited: Source[] = [];
  const renumbered = new Map<number, number>();
  // Runs like [3][7][8][9] hurt readability; the first two carry the claim.
  const capped = markdown.replace(/((?:\[\d+\]){2})(?:\[\d+\])+/g, "$1");
  const linked = capped.replace(MARKER_GROUP, (_match, group: string) =>
    expandGroup(group)
      .map((old) => {
        const source = sources[old - 1];
        if (!source) return "";
        let n = renumbered.get(old);
        if (!n) {
          n = cited.length + 1;
          renumbered.set(old, n);
          cited.push({ ...source, n });
        }
        return `[[${n}]](${source.url})`;
      })
      .join(""),
  );
  return { markdown: linked, cited };
}

/** A linked marker as citeSources() writes it, with the space before it. */
const LINKED_MARKER = / ?\[\[\d+\]\]\([^)\s]+\)/g;

/**
 * The writer cites every claim so the bibliography lists exactly what the
 * post rests on; readers get either no numbers at all ("none") or one per
 * paragraph at most ("light"), so the text stays easy to read.
 */
export function shapeCitations(markdown: string, style: InlineCitations): string {
  if (style === "none") return markdown.replace(LINKED_MARKER, "");
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => {
      let kept = false;
      return paragraph.replace(LINKED_MARKER, (marker) => {
        if (kept) return "";
        kept = true;
        return marker;
      });
    })
    .join("\n\n");
}

/**
 * Perplexity titles can start with a breadcrumb of the URL glued to the real
 * title ("typo3.com · typo3-v14TYPO3 v14: …"); the breadcrumb is dropped.
 */
function cleanTitle(title: string | null, url: string): string | null {
  if (!title) return null;
  let clean = title;
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (clean.includes(" · ")) {
    if (lastSegment && clean.includes(lastSegment)) {
      clean = clean.slice(clean.lastIndexOf(lastSegment) + lastSegment.length);
    } else {
      // "host · de · artikelReal title": keep the last crumb and drop the path segment glued to it.
      clean = clean.split(" · ").at(-1) ?? clean;
      const glued = segments.find((segment) => clean.startsWith(segment) && clean.length > segment.length);
      if (glued) clean = clean.slice(glued.length);
    }
  }
  clean = clean.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
  return clean.length >= 3 ? clean.slice(0, 140) : null;
}

export function bibliography(sources: Source[], heading: string): string {
  const lines = sources.map(({ n, url, title }) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = cleanTitle(title, url);
    return `${n}. [${label ?? host}](${url})${label ? ` — ${host}` : ""}`;
  });
  return `## ${heading}\n\n${lines.join("\n")}`;
}
