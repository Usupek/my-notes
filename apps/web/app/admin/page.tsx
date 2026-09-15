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
      setError(err instanceof Error ? err.message : "Login gagal");
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
    if (!window.confirm(`Hapus “${note.title}”? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await request(`/admin/notes/${note.id}`, { method: "DELETE" });
      setNotes((current) => current.filter((item) => item.id !== note.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus catatan");
    }
  }

  async function importMarkdown(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    data.append("is_published", "false");
    setBusy(true);
    try {
      const note = await request<Note>("/admin/notes/import", { method: "POST", body: data });
      router.push(`/admin/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor Markdown");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  if (authenticated === null) return <div className="center-card"><p>Memeriksa sesi…</p></div>;

  if (!authenticated) {
    return (
      <div className="login-shell">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">AREA ADMIN</p>
          <h1>Selamat datang kembali.</h1>
          <p>Masukkan password untuk mengelola catatan.</p>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
          {error && <p className="form-error">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="shell admin-shell">
      <div className="admin-heading">
        <div><p className="eyebrow">DASHBOARD</p><h1>Kelola catatan</h1></div>
        <div className="actions">
          <label className="button secondary file-button">{busy ? "Mengimpor…" : "Impor .md"}<input type="file" accept=".md,text/markdown" onChange={importMarkdown} disabled={busy} /></label>
          <Link className="button primary" href="/admin/notes/new">Catatan baru</Link>
          <button className="text-button" onClick={logout}>Keluar</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table">
        <div className="table-head"><span>Judul</span><span>Status</span><span>Diperbarui</span><span /></div>
        {notes.map((note) => (
          <div className="table-row" key={note.id}>
            <div><Link href={`/admin/notes/${note.id}`}>{note.title}</Link><small>{note.tags.map((tag) => `#${tag.name}`).join(" ") || "Tanpa topik"}</small></div>
            <span className={`status ${note.is_published ? "published" : "draft"}`}>{note.is_published ? "Publik" : "Draf"}</span>
            <time>{formatDate(note.updated_at)}</time>
            <button className="danger-link" onClick={() => removeNote(note)}>Hapus</button>
          </div>
        ))}
        {notes.length === 0 && <div className="empty">Belum ada catatan. Mulai dengan membuat satu.</div>}
      </div>
    </div>
  );
}
