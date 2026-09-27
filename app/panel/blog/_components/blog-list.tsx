"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ConfirmDialog from "./confirm-dialog";
import { deletePost, setPostStatus } from "../_actions";
import { STATUS_LABELS, type PostRow, type PostStatus } from "../_lib";
import Select from "@/app/panel/_components/ui/select";

const STATUS_BADGE: Record<PostStatus, string> = {
  draft: "wbadge wbadge-user",
  scheduled: "wbadge wbadge-pending",
  published: "wbadge wbadge-verified",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function BlogList({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PostRow | null>(null);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const post of posts) {
      if (post.categoryId && post.categoryName && !seen.has(post.categoryId)) {
        seen.set(post.categoryId, post.categoryName);
      }
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [posts]);

  const counts = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === "published").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      drafts: posts.filter((post) => post.status === "draft").length,
    }),
    [posts],
  );

  const visible = posts.filter((post) => {
    if (statusFilter !== "all" && post.status !== statusFilter) return false;
    if (categoryFilter !== "all" && post.categoryId !== categoryFilter) return false;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const haystack = `${post.title} ${post.slug} ${post.excerpt}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  async function togglePublish(post: PostRow) {
    setBusyId(post.id);
    setError("");
    const result = await setPostStatus(post.id, post.status === "published" ? "draft" : "published");
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function confirmDeletePost() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    const result = await deletePost(pendingDelete.id);
    setBusyId(null);
    setPendingDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="wpage-stats">
        <div>
          <span>Total posts</span>
          <strong>{counts.total}</strong>
        </div>
        <div>
          <span>Published</span>
          <strong>{counts.published}</strong>
        </div>
        <div>
          <span>Scheduled</span>
          <strong>{counts.scheduled}</strong>
        </div>
        <div>
          <span>Drafts</span>
          <strong>{counts.drafts}</strong>
        </div>
      </div>

      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, slug or description"
              aria-label="Search posts"
            />
          </div>
          <div className="wtable-filters">
            <Select
              id="filter-status"
              label="Status"
              hideLabel
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "published", label: "Published" },
                { value: "scheduled", label: "Scheduled" },
                { value: "draft", label: "Draft" },
              ]}
            />
            <Select
              id="filter-category"
              label="Category"
              hideLabel
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: "all", label: "All categories" }, ...categoryOptions]}
            />
          </div>
          <div className="wtable-tools">
            <Link className="wbtn wbtn-primary wbtn-add" href="/panel/blog/new">
              New post
            </Link>
          </div>
        </div>

        {error ? (
          <p className="wdialog-error" role="alert" style={{ margin: "14px 19px 0" }}>
            {error}
          </p>
        ) : null}

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th>Post</th>
                <th>Category</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="wtable-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className="wtable-state" colSpan={6}>
                    No posts match the current filters.
                  </td>
                </tr>
              ) : (
                visible.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="wtable-user">
                        {post.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- UploadThing returns arbitrary remote hosts
                          <img className="wtable-avatar wtable-avatar-img" src={post.cover.url} alt="" />
                        ) : (
                          <span className="wtable-avatar" aria-hidden="true">
                            {(post.title[0] ?? "?").toUpperCase()}
                          </span>
                        )}
                        <div>
                          <strong>{post.title}</strong>
                          <small>/blog/{post.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {post.categoryName ? (
                        <span className="wtable-user">
                          <i className="wdot" style={{ background: post.categoryColor ?? "#4353e8" }} />
                          {post.categoryName}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td>
                      {post.tags.length === 0 ? (
                        <span>—</span>
                      ) : (
                        <span className="wchip-row">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span className="wchip" key={tag.id}>
                              {tag.name}
                            </span>
                          ))}
                          {post.tags.length > 3 ? <span className="wchip">+{post.tags.length - 3}</span> : null}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={STATUS_BADGE[post.status]}>{STATUS_LABELS[post.status]}</span>
                      {post.status === "published" && post.featured ? <span className="wbadge wbadge-admin">Featured</span> : null}
                    </td>
                    <td className="wtable-date">{formatDate(post.updatedAt)}</td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <Link className="wbtn wbtn-ghost wbtn-sm" href={`/panel/blog/${post.id}`}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="wbtn wbtn-ghost wbtn-sm"
                          disabled={busyId === post.id}
                          onClick={() => togglePublish(post)}
                        >
                          {post.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          className="wbtn wbtn-danger-ghost wbtn-sm"
                          disabled={busyId === post.id}
                          onClick={() => setPendingDelete(post)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="wtable-foot">
          <p className="wtable-count">
            {visible.length} of {posts.length} posts
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this post?"
        body={pendingDelete ? `"${pendingDelete.title}" and its tag links are removed permanently. This cannot be undone.` : ""}
        confirmLabel="Delete post"
        busy={busyId !== null}
        onConfirm={confirmDeletePost}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
