"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DatePicker, Select, TextField } from "../_components/ui";

type Role = "admin" | "user";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
};

type DialogKind = "create" | "edit" | "delete" | null;

const PAGE_SIZES = [20, 50, 100];
const ROLES: Role[] = ["admin", "user"];

const EMPTY_FORM = { name: "", email: "", role: "user" as Role, password: "" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Fixed header and footer, scrollable body: the middle row is the only one that scrolls. */
function Dialog({
  open,
  kind,
  user,
  busy,
  error,
  form,
  onFormChange,
  onClose,
  onSubmit,
  onConfirmDelete,
}: {
  open: boolean;
  kind: DialogKind;
  user: UserRow | null;
  busy: boolean;
  error: string;
  form: typeof EMPTY_FORM;
  onFormChange: (next: typeof EMPTY_FORM) => void;
  onClose: () => void;
  onSubmit: () => void;
  onConfirmDelete: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const titles: Record<string, string> = {
    create: "Add user",
    edit: "Edit user",
    delete: "Delete user",
  };

  return (
    <dialog ref={ref} className="wdialog" onClose={onClose} onCancel={onClose}>
      <header className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">{kind === "delete" ? "Confirm" : "Users"}</span>
          <h2 id="wdialog-title">{titles[kind ?? "create"]}</h2>
        </div>
        <button className="wdialog-close" type="button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="wdialog-body">
        {kind === "delete" ? (
          <p className="wdialog-text">
            <strong>{user?.name}</strong> ({user?.email}) will be permanently removed, including their sessions and
            password. This cannot be undone.
          </p>
        ) : (
          <div className="wform">
            <TextField
              id="w-user-name"
              label="Name"
              value={form.name}
              onChange={(name) => onFormChange({ ...form, name })}
              placeholder="Full name"
              autoComplete="off"
            />
            <TextField
              id="w-user-email"
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(email) => onFormChange({ ...form, email })}
              placeholder="name@company.com"
              autoComplete="off"
            />
            <Select
              id="w-user-role"
              label="Role"
              value={form.role}
              onChange={(role) => onFormChange({ ...form, role: role as Role })}
              options={ROLES.map((role) => ({ value: role, label: role === "admin" ? "Admin" : "User" }))}
            />
            <TextField
              id="w-user-password"
              label="Password"
              hint={kind === "edit" ? "leave empty to keep current" : undefined}
              type="password"
              value={form.password}
              onChange={(password) => onFormChange({ ...form, password })}
              placeholder={kind === "edit" ? "••••••••" : "At least 8 characters"}
              autoComplete="new-password"
            />
          </div>
        )}

        {error ? (
          <p className="wdialog-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="wdialog-foot">
        <button className="wbtn wbtn-ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {kind === "delete" ? (
          <button className="wbtn wbtn-danger" type="button" onClick={onConfirmDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete user"}
          </button>
        ) : (
          <button className="wbtn wbtn-primary" type="button" onClick={onSubmit} disabled={busy}>
            {busy ? "Saving…" : kind === "edit" ? "Save changes" : "Create user"}
          </button>
        )}
      </footer>
    </dialog>
  );
}

export default function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [kind, setKind] = useState<DialogKind>(null);
  const [active, setActive] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);

  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const hasFilters = roleFilter !== "" || joinedFrom !== "";

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (joinedFrom) params.set("joinedFrom", joinedFrom);
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setListError(payload.error ?? "Could not load users.");
        setUsers([]);
        return;
      }
      setUsers(payload.users);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      if (payload.totalPages > 0 && page > payload.totalPages) setPage(payload.totalPages);
    } catch {
      setListError("Could not reach the server.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, roleFilter, joinedFrom]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const openCreate = () => {
    setActive(null);
    setForm(EMPTY_FORM);
    setDialogError("");
    setKind("create");
  };

  const openEdit = (user: UserRow) => {
    setActive(user);
    setForm({ name: user.name, email: user.email, role: user.role, password: "" });
    setDialogError("");
    setKind("edit");
  };

  const openDelete = (user: UserRow) => {
    setActive(user);
    setDialogError("");
    setKind("delete");
  };

  const closeDialog = () => {
    if (busy) return;
    setKind(null);
    setActive(null);
    setDialogError("");
  };

  const submit = async () => {
    setBusy(true);
    setDialogError("");
    try {
      const isEdit = kind === "edit";
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      if (!isEdit) body.emailVerified = true;

      const response = await fetch(isEdit ? `/api/admin/users/${active?.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setDialogError(payload.error ?? "The change could not be saved.");
        return;
      }
      setKind(null);
      setActive(null);
      await load();
    } catch {
      setDialogError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!active) return;
    setBusy(true);
    setDialogError("");
    try {
      const response = await fetch(`/api/admin/users/${active.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDialogError(payload.error ?? "The user could not be deleted.");
        return;
      }
      setKind(null);
      setActive(null);
      await load();
    } catch {
      setDialogError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <>
      <div className="wtable-card">
        <div className="wtable-toolbar">
          <div className="wtable-search">
            <label className="visually-hidden" htmlFor="w-user-search">
              Search users
            </label>
            <input
              id="w-user-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or e-mail…"
            />
          </div>
          <div className="wtable-filters">
            <Select
              label="Role"
              hideLabel
              placeholder="All roles"
              emptyLabel="All roles"
              value={roleFilter}
              onChange={(next) => {
                setRoleFilter(next as Role | "");
                setPage(1);
              }}
              options={ROLES.map((role) => ({ value: role, label: role === "admin" ? "Admin" : "User" }))}
            />
            <DatePicker
              label="Joined from"
              hideLabel
              placeholder="Joined from"
              value={joinedFrom}
              onChange={(next) => {
                setJoinedFrom(next);
                setPage(1);
              }}
            />
            {hasFilters ? (
              <button
                className="wbtn wbtn-ghost wbtn-sm"
                type="button"
                onClick={() => {
                  setRoleFilter("");
                  setJoinedFrom("");
                  setPage(1);
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
          <div className="wtable-tools">
            <span className="wtable-size">
              <span>Show</span>
              <Select
                label="Rows per page"
                hideLabel
                value={String(pageSize)}
                onChange={(next) => {
                  setPageSize(Number(next));
                  setPage(1);
                }}
                options={PAGE_SIZES.map(String)}
              />
              <span>per page</span>
            </span>
            <button className="wbtn wbtn-primary wbtn-add" type="button" onClick={openCreate}>
              <span aria-hidden="true">+</span> Add user
            </button>
          </div>
        </div>

        <div className="wtable-scroll">
          <table className="wtable">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col" className="wtable-actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="wtable-state">
                    Loading users…
                  </td>
                </tr>
              ) : listError ? (
                <tr>
                  <td colSpan={5} className="wtable-state wtable-state-error">
                    {listError}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wtable-state">
                    {query || hasFilters ? "No users match the current search or filters." : "No users yet."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="wtable-user">
                        <span className="wtable-avatar" aria-hidden="true">
                          {initials(user.name)}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`wbadge wbadge-${user.role}`}>{user.role}</span>
                    </td>
                    <td>
                      <span className={`wbadge ${user.emailVerified ? "wbadge-verified" : "wbadge-pending"}`}>
                        {user.emailVerified ? "verified" : "pending"}
                      </span>
                    </td>
                    <td>
                      <span className="wtable-date">{formatDate(user.createdAt)}</span>
                    </td>
                    <td className="wtable-actions-col">
                      <div className="wtable-actions">
                        <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => openEdit(user)}>
                          Edit
                        </button>
                        <button className="wbtn wbtn-ghost wbtn-sm wbtn-danger-ghost" type="button" onClick={() => openDelete(user)}>
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
            {total === 0 ? "No users" : `${from}–${to} of ${total}`}
          </p>
          <nav className="wpager" aria-label="Pagination">
            <button className="wbtn wbtn-ghost wbtn-sm" type="button" onClick={() => setPage(1)} disabled={page <= 1 || loading}>
              «
            </button>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
            >
              ‹
            </button>
            <span className="wpager-state">
              Page {page} / {totalPages}
            </span>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || loading}
            >
              ›
            </button>
            <button
              className="wbtn wbtn-ghost wbtn-sm"
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
            >
              »
            </button>
          </nav>
        </div>
      </div>

      <Dialog
        open={kind !== null}
        kind={kind}
        user={active}
        busy={busy}
        error={dialogError}
        form={form}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
        onConfirmDelete={confirmDelete}
      />
    </>
  );
}
