"use client";

import Link from "@/app/panel/_components/panel-navigation";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import CoverField from "./cover-field";
import AiDialog, { type AiApplyPayload } from "./ai-dialog";
import { CategoryQuickDialog, TagQuickDialog } from "./taxonomy-quick-dialogs";
import { deletePost, savePost } from "../_actions";
import {
  EXCERPT_MAX,
  TITLE_MAX,
  type ActionResult,
  type CoverRef,
  type PostFormInitial,
  type PostStatus,
} from "../_lib";
import MultiSelect from "@/app/panel/_components/ui/multi-select";
import Select, { type SelectOption } from "@/app/panel/_components/ui/select";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import DatePicker, { toISO } from "@/app/panel/_components/ui/date-picker";
import TextArea from "@/app/panel/_components/ui/text-area";
import TextField from "@/app/panel/_components/ui/text-field";
import { useToast } from "@/app/panel/_components/ui/toast";
import RichTextField from "@/app/panel/_components/editor/rich-text-field";
import { slugify } from "@/lib/slug";
import ConfirmDialog from "@/app/panel/_components/confirm-dialog";

type Props = {
  initial: PostFormInitial;
  categories: SelectOption[];
  tags: SelectOption[];
  /** Uploaded image assets for the cover picker dialog, newest first. */
  media: CoverRef[];
};

const PUBLISH_OPTIONS: SelectOption[] = [
  { value: "draft", label: "Save as draft" },
  { value: "published", label: "Publish now" },
  { value: "scheduled", label: "Schedule publication" },
];
const PUBLISH_HELP: Record<PostStatus, string> = {
  draft: "Keep this post private while you work on it.",
  published: "Make this post visible on the blog immediately.",
  scheduled: "Choose when this post should go live.",
};

function initialSchedule(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const value = new Date(iso);
  return {
    date: toISO(value),
    time: `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`,
  };
}

function CharCounter({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;
  return (
    <p className="wfield-hint-block" style={{ textAlign: "right" }}>
      <span style={near ? { color: "#995200" } : undefined}>
        {value}/{max}
      </span>
    </p>
  );
}

/** Rough preview of how the post appears in search results. */
function SearchPreview({ title, slug, excerpt }: { title: string; slug: string; excerpt: string }) {
  return (
    <div className="wserp">
      <span className="wserp-label">Search result preview</span>
      <p className="wserp-url">cmsmotive.com › blog › {slug || "your-slug"}</p>
      <p className="wserp-title">{title.trim() || "Your post title appears here"}</p>
      <p className="wserp-desc">
        {excerpt.trim() || "Add a description so search engines and social cards have something to show."}
      </p>
    </div>
  );
}

export default function PostForm({ initial, categories, tags, media }: Props) {
  const router = useRouter();
  const originalSchedule = initialSchedule(initial.scheduledAt);

  const [postId, setPostId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [cover, setCover] = useState<CoverRef | null>(initial.cover);
  const [status, setStatus] = useState<PostStatus>(initial.status);
  const [savedStatus, setSavedStatus] = useState<PostStatus>(initial.status);
  const [scheduleDate, setScheduleDate] = useState(originalSchedule.date);
  const [scheduleTime, setScheduleTime] = useState(originalSchedule.time);
  const scheduledAt = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : "";
  const [featured, setFeatured] = useState(initial.featured);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [tagIds, setTagIds] = useState(initial.tagIds);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [tagOptions, setTagOptions] = useState(tags);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { toast, showToast } = useToast();

  // quick-create dialogs own their form state; the form only mounts them while open
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  function handleTitleChange(next: string) {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
  }

  /** Apply the generated fields and persist the complete post as a draft. */
  async function handleAiApply(payload: AiApplyPayload): Promise<void> {
    const nextTitle = (payload.title ?? title).trim() || payload.fallbackTitle.slice(0, TITLE_MAX);
    const nextSlug = !slugTouched ? slugify(nextTitle) : slug;
    const nextExcerpt = payload.description ?? excerpt;
    const nextContent = payload.contentHtml ?? content;
    const nextCover = payload.cover !== undefined ? payload.cover : cover;
    const nextCategoryId = payload.categoryId ?? categoryId;
    const nextTagIds = payload.tagIds ? Array.from(new Set([...tagIds, ...payload.tagIds])) : tagIds;

    setBusy(true);
    setError("");
    setNotice("");
    let result: ActionResult;
    try {
      result = await savePost({
        id: postId,
        title: nextTitle,
        slug: nextSlug,
        excerpt: nextExcerpt,
        content: nextContent,
        coverId: nextCover?.assetId || null,
        status: "draft",
        scheduledAt: null,
        featured,
        categoryId: nextCategoryId || null,
        tagIds: nextTagIds,
      });
    } catch {
      setError("The generated draft could not be saved. Try again.");
      throw new Error("The generated draft could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error);
      throw new Error(result.error);
    }

    setPostId(result.id);
    setTitle(nextTitle);
    setSlug(nextSlug);
    setExcerpt(nextExcerpt);
    setContent(nextContent);
    setCover(nextCover);
    setCategoryId(nextCategoryId);
    setTagIds(nextTagIds);
    setStatus("draft");
    setSavedStatus("draft");
    setScheduleDate("");
    setScheduleTime("");
    if (payload.newCategoryOption) {
      const option = payload.newCategoryOption;
      setCategoryOptions((prev) => (prev.some((existing) => existing.value === option.value) ? prev : [...prev, option]));
    }
    if (payload.newTagOptions && payload.newTagOptions.length > 0) {
      setTagOptions((prev) => [
        ...prev,
        ...payload.newTagOptions!.filter((option) => !prev.some((existing) => existing.value === option.value)),
      ]);
    }
    setNotice("AI content was saved automatically as a draft.");
    setAiOpen(false);
    if (!postId && result.id) router.replace(`/panel/blog/${result.id}`);
    else router.refresh();
  }

  async function submit() {
    // Publishing rule (enforced again in _actions.ts): a post cannot go live
    // or be scheduled without a category and at least one tag.
    if (status !== "draft" && (!categoryId || tagIds.length === 0)) {
      showToast("Add a category and at least one tag before publishing this post.");
      return;
    }
    let publishAt: Date | null = null;
    if (status === "scheduled") {
      publishAt = scheduledAt ? new Date(scheduledAt) : null;
      if (!publishAt || Number.isNaN(publishAt.getTime()) || publishAt <= new Date()) {
        setError("Choose a future date and time to schedule this post.");
        return;
      }
    }
    setBusy(true);
    setError("");
    setNotice("");
    let result: ActionResult;
    try {
      result = await savePost({
        id: postId,
        title,
        slug,
        excerpt,
        content,
        coverId: cover?.assetId || null,
        status,
        scheduledAt: publishAt?.toISOString() ?? null,
        featured,
        categoryId: categoryId || null,
        tagIds,
      });
    } catch {
      setError("The post could not be saved. Try again.");
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSavedStatus(status);
    router.push("/panel/blog");
    router.refresh();
  }

  async function handleDelete() {
    if (!postId) return;
    setBusy(true);
    const result = await deletePost(postId);
    setBusy(false);
    setConfirmDelete(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/panel/blog");
    router.refresh();
  }

  const publishLabel = status === "published" ? "Publish now" : status === "scheduled" ? "Schedule post" : "Save draft";

  return (
    <form
      className="wform-card"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="wpost-toolbar">
        <Link className="wbtn wbtn-ghost" href="/panel/blog">← Back to posts</Link>
        <div className="wpost-toolbar-actions">
          <button type="button" className="wbtn wbtn-primary" onClick={() => setAiOpen(true)} disabled={busy}>
            <span aria-hidden="true">✦</span> Generate with AI
          </button>
          {postId ? (
            <button type="button" className="wbtn wbtn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete post
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="wdialog-error wpost-feedback" role="alert">{error}</p> : null}
      {notice ? <p className="wpost-notice" role="status">{notice}</p> : null}
      <div className="wform-grid">
        <div className="wform-main">
          <div className="wfield-card">
            <p className="wsection-label">Content &amp; SEO</p>
            <TextField
              id="post-title"
              label="Title"
              hint={`max ${TITLE_MAX}`}
              value={title}
              onChange={handleTitleChange}
              maxLength={TITLE_MAX}
              placeholder="Post title"
              required
            />
            <CharCounter value={title.length} max={TITLE_MAX} />

            <TextArea
              id="post-excerpt"
              label="Description"
              hint="meta description"
              note="Shown in search engines and as the teaser on listings. The counter reflects the 160 character limit."
              value={excerpt}
              onChange={setExcerpt}
              maxLength={EXCERPT_MAX}
              rows={3}
              placeholder="Short description of the post"
            />

            <SearchPreview title={title} slug={slug} excerpt={excerpt} />
          </div>

          <RichTextField
            id="post-content"
            label="Post content"
            value={content}
            onChange={setContent}
            placeholder="Write the post…"
            endpoint="blogMedia"
          />
        </div>

        <div className="wform-side">
          <div className="wfield-card">
            <p className="wsection-label">Publishing</p>
            <Select
              id="post-publish-status"
              label="Publishing status"
              value={status}
              onChange={(next) => {
                setStatus(next as PostStatus);
                setError("");
              }}
              options={PUBLISH_OPTIONS}
            />
            <p className="wpub-description">{PUBLISH_HELP[status]}</p>

            {status === "scheduled" ? (
              <div className="wpub-when">
                <span className="wfield-label-like">Publish on</span>
                <div className="wpub-when-row">
                  <DatePicker
                    id="post-schedule-date"
                    label="Schedule date"
                    hideLabel
                    value={scheduleDate}
                    onChange={(next) => { setScheduleDate(next); setError(""); }}
                    placeholder="YYYY-MM-DD"
                  />
                  <div className="wfield">
                    <label className="visually-hidden" htmlFor="post-schedule-time">Schedule time</label>
                    <input
                      id="post-schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(event) => { setScheduleTime(event.target.value); setError(""); }}
                    />
                  </div>
                </div>
                <p className="wpub-timezone">Time is shown in your local timezone.</p>
              </div>
            ) : null}

            <div className="wpub-actions">
              <button type="button" className="wbtn wbtn-primary wbtn-block" onClick={submit} disabled={busy}>
                {busy ? "Saving…" : publishLabel}
              </button>
            </div>

            <dl className="wpub-status">
              <div>
                <dt>Current status</dt>
                <dd>{savedStatus === "published" ? "Published" : savedStatus === "scheduled" ? "Scheduled" : "Draft"}</dd>
              </div>
              {savedStatus === "scheduled" && initial.scheduledAt ? (
                <div>
                  <dt>Scheduled for</dt>
                  <dd>{new Date(initial.scheduledAt).toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <CoverField value={cover} onChange={setCover} library={media} />

          <div className="wfield-card">
            <p className="wsection-label">Organization</p>

            <div className="wfield">
              <div className="wfield-inline-head">
                <label htmlFor="post-category">Category</label>
              </div>
              <Select
                id="post-category"
                label="Category"
                hideLabel
                value={categoryId}
                onChange={setCategoryId}
                options={categoryOptions}
                emptyLabel="No category"
                placeholder="No category"
              />
              <button type="button" className="wbtn wbtn-primary wbtn-sm wbtn-block worg-action" onClick={() => setCategoryDialogOpen(true)}>
                New category
              </button>
            </div>

            <MultiSelect
              id="post-tags"
              label="Tags"
              value={tagIds}
              onChange={setTagIds}
              options={tagOptions}
              placeholder="No tags"
              emptyLabel="No tags yet — create one below."
              maxChips={4}
            />
            <button type="button" className="wbtn wbtn-primary wbtn-sm wbtn-block worg-action" onClick={() => setTagDialogOpen(true)}>
              New tag
            </button>

            <CheckBox
              id="post-featured"
              className="wcheck-sep"
              label="Mark as featured post"
              note="Highlights the post in the featured spot on the blog."
              checked={featured}
              onChange={setFeatured}
            />
          </div>

          <div className="wfield-card">
            <p className="wsection-label">URL</p>
            <TextField
              id="post-slug"
              label="Slug"
              value={slug}
              onChange={(next) => {
                setSlugTouched(true);
                setSlug(next);
              }}
              placeholder="post-url"
              note="Left alone, the slug follows the title. Edit it for full SEO control."
            />
          </div>
        </div>
      </div>

      {categoryDialogOpen ? (
        <CategoryQuickDialog
          onClose={() => setCategoryDialogOpen(false)}
          onCreated={(id, name) => {
            setCategoryOptions((prev) =>
              prev.some((option) => option.value === id) ? prev : [...prev, { value: id, label: name }],
            );
            setCategoryId(id);
          }}
        />
      ) : null}

      {tagDialogOpen ? (
        <TagQuickDialog
          onClose={() => setTagDialogOpen(false)}
          onCreated={(id, name) => {
            setTagOptions((prev) =>
              prev.some((option) => option.value === id) ? prev : [...prev, { value: id, label: name }],
            );
            setTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        body="The post and its tag links are removed permanently. This cannot be undone."
        confirmLabel="Delete post"
        busy={busy}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />

      <AiDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialTopic={title}
        categoryOptions={categoryOptions}
        tagOptions={tagOptions}
        onApply={handleAiApply}
      />

      {toast}
    </form>
  );
}
