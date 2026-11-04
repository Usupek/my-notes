"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, request } from "@/lib/api";
import type { Note } from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request<{ authenticated: boolean }>("/admin/me")
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    request<Note[]>("/admin/notes")
      .then(setNotes)
      .catch((err: Error) => setError(err.message));
  }, [authenticated]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await request("/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setNotes([]);
  }

  async function removeNote(note: Note) {
    if (!window.confirm(`Delete “${note.title}”? This action cannot be reversed.`)) return;
    try {
      await request(`/admin/notes/${note.id}`, { method: "DELETE" });
      setNotes((current) => current.filter((item) => item.id !== note.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  async function togglePin(note: Note) {
    try {
      const updated = await request<Note>(`/admin/notes/${note.id}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      setNotes((current) =>
        current
          .map((item) => (item.id === note.id ? { ...item, is_pinned: updated.is_pinned } : item))
          .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pin note");
    }
  }

  if (authenticated === null) return <div className="center-card"><p>Checking Session…</p></div>;

  if (!authenticated) {
    return (
      <div className="login-shell">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">AREA 54</p>
          <h1>Welcome back King</h1>
          <p>Enter yo bro code</p>
          <label htmlFor="password">Bro Code:</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="shell admin-shell">
      <div className="admin-heading">
        <div><p className="eyebrow">DASHBOARD</p><h1>Manage notes</h1></div>
        <div className="actions">
          <Link className="button secondary" href="/admin/notes/import">Impor .md</Link>
          <Link className="button primary" href="/admin/notes/new">New note</Link>
          <button className="text-button" onClick={logout}>Log Out</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table">
        <div className="table-head"><span>Title</span><span>Status</span><span>Created</span><span>Modified</span><span /></div>
        {notes.map((note) => (
          <div className="table-row" key={note.id}>
            <div><Link href={`/admin/notes/${note.id}`}>{note.title}</Link><small>{note.tags.map((tag) => `#${tag.name}`).join(" ") || "No topic"}</small></div>
            <span className={`status ${note.is_published ? "published" : "draft"}`}>{note.is_published ? "Public" : "Draft"}</span>
            <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
            <time dateTime={note.updated_at}>{formatDate(note.updated_at)}</time>
            <div className="row-actions">
              <button className="icon-button danger" onClick={() => removeNote(note)} title="Delete" aria-label={`Delete ${note.title}`}>
                <TrashIcon />
              </button>
              <button className={`icon-button${note.is_pinned ? " active" : ""}`} onClick={() => togglePin(note)} title={note.is_pinned ? "Unpin" : "Pin"} aria-label={`${note.is_pinned ? "Unpin" : "Pin"} ${note.title}`} aria-pressed={note.is_pinned}>
                <PinIcon filled={note.is_pinned} />
              </button>
            </div>
          </div>
        ))}
        {notes.length === 0 && <div className="empty">Nothing to see here. Create a new one.</div>}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
