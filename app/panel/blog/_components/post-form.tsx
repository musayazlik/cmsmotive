"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CoverField from "./cover-field";
import BlogEditor from "./blog-editor";
import { deletePost, quickCreateCategory, quickCreateTag, savePost } from "../_actions";
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
import DatePicker from "@/app/panel/_components/ui/date-picker";
import TextArea from "@/app/panel/_components/ui/text-area";
import TextField from "@/app/panel/_components/ui/text-field";
import { slugify } from "@/lib/slug";
import ConfirmDialog from "./confirm-dialog";

type Props = {
  initial: PostFormInitial;
  categories: SelectOption[];
  tags: SelectOption[];
};

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

export default function PostForm({ initial, categories, tags }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [cover, setCover] = useState<CoverRef | null>(initial.cover);
  const [status, setStatus] = useState<PostStatus>(initial.status);
  const [scheduleDate, setScheduleDate] = useState(initial.scheduledAt ? initial.scheduledAt.slice(0, 10) : "");
  const [scheduleTime, setScheduleTime] = useState(initial.scheduledAt ? initial.scheduledAt.slice(11, 16) : "");
  const scheduledAt = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : "";
  const [featured, setFeatured] = useState(initial.featured);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [tagIds, setTagIds] = useState(initial.tagIds);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [tagOptions, setTagOptions] = useState(tags);
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleTitleChange(next: string) {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
  }

  async function handleQuickCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setBusy(true);
    const result = await quickCreateCategory(name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCategoryOptions((prev) =>
      prev.some((option) => option.value === result.id) ? prev : [...prev, { value: result.id, label: result.name }],
    );
    setCategoryId(result.id);
    setNewCategory("");
    setError("");
  }

  async function handleQuickTag() {
    const name = newTag.trim();
    if (!name) return;
    setBusy(true);
    const result = await quickCreateTag(name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTagOptions((prev) =>
      prev.some((option) => option.value === result.id) ? prev : [...prev, { value: result.id, label: result.name }],
    );
    setTagIds((prev) => (prev.includes(result.id) ? prev : [...prev, result.id]));
    setNewTag("");
    setError("");
  }

  async function submit(nextStatus: PostStatus) {
    if (nextStatus === "scheduled" && !scheduledAt) {
      setError("Pick a date and time to schedule this post.");
      return;
    }
    setBusy(true);
    setError("");
    const result: ActionResult = await savePost({
      id: initial.id,
      title,
      slug,
      excerpt,
      content,
      coverId: cover?.assetId || null,
      status: nextStatus,
      scheduledAt: nextStatus === "scheduled" ? new Date(scheduledAt).toISOString() : null,
      featured,
      categoryId: categoryId || null,
      tagIds,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(nextStatus);
    router.push("/panel/blog");
    router.refresh();
  }

  async function handleDelete() {
    if (!initial.id) return;
    setBusy(true);
    const result = await deletePost(initial.id);
    setBusy(false);
    setConfirmDelete(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/panel/blog");
    router.refresh();
  }

  const publishLabel = initial.id
    ? initial.status === "published"
      ? "Update published post"
      : "Publish"
    : "Publish";

  return (
    <form
      className="wform-card"
      onSubmit={(event) => event.preventDefault()}
    >
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

          <div className="wfield-editor">
            <p className="wsection-label">Post content</p>
            <BlogEditor value={content} onChange={setContent} placeholder="Write the post…" />
          </div>
        </div>

        <div className="wform-side">
          <div className="wfield-card">
            <p className="wsection-label">Publishing</p>
            <button type="button" className="wbtn wbtn-primary wbtn-block" onClick={() => submit("published")} disabled={busy}>
              {busy ? "Working…" : publishLabel}
            </button>

            <div className="wpub-when">
              <span className="wfield-label-like">Schedule</span>
              <div className="wpub-when-row">
                <DatePicker
                  label="Schedule date"
                  hideLabel
                  value={scheduleDate}
                  onChange={setScheduleDate}
                  placeholder="YYYY-MM-DD"
                />
                <div className="wfield">
                  <input
                    type="time"
                    aria-label="Schedule time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="wpub-actions">
              <button
                type="button"
                className="wbtn wbtn-ghost wbtn-block"
                onClick={() => submit("scheduled")}
                disabled={busy || !scheduledAt}
                title={scheduledAt ? `Publish automatically on ${scheduledAt.replace("T", " ")}` : "Pick a date and time first"}
              >
                Schedule publish
              </button>
              <button type="button" className="wbtn wbtn-ghost wbtn-block" onClick={() => submit("draft")} disabled={busy}>
                Save as draft
              </button>
            </div>

            <dl className="wpub-status">
              <div>
                <dt>Current status</dt>
                <dd>{status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Draft"}</dd>
              </div>
              {scheduledAt ? (
                <div>
                  <dt>Scheduled for</dt>
                  <dd>{scheduledAt.replace("T", " ")}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <CoverField value={cover} onChange={setCover} />

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
              <div className="wquick-add">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleQuickCategory();
                    }
                  }}
                  placeholder="New category name"
                  aria-label="New category name"
                />
                <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={handleQuickCategory} disabled={busy || !newCategory.trim()}>
                  Add
                </button>
              </div>
            </div>

            <MultiSelect
              id="post-tags"
              label="Tags"
              value={tagIds}
              onChange={setTagIds}
              options={tagOptions}
              placeholder="No tags"
              maxChips={4}
            />
            <div className="wquick-add">
              <input
                type="text"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleQuickTag();
                  }
                }}
                placeholder="New tag name"
                aria-label="New tag name"
              />
              <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={handleQuickTag} disabled={busy || !newTag.trim()}>
                Add
              </button>
            </div>

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

      <div className="wform-foot">
        {error ? (
          <p className="wdialog-error" role="alert" style={{ marginRight: "auto" }}>
            {error}
          </p>
        ) : null}
        <Link className="wbtn wbtn-ghost" href="/panel/blog">
          Back to posts
        </Link>
        {initial.id ? (
          <button type="button" className="wbtn wbtn-danger-ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
            Delete post
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        body="The post and its tag links are removed permanently. This cannot be undone."
        confirmLabel="Delete post"
        busy={busy}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  );
}
