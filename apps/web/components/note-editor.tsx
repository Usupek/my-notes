"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "./markdown";
import { request } from "@/lib/api";
import type { Note } from "@/lib/types";

export function NoteEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("# Catatan baru\n\nMulai menulis di sini.");
  const [tags, setTags] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    request<Note>(`/admin/notes/${id}`)
      .then((note) => {
        setTitle(note.title);
        setContent(note.content_markdown ?? "");
        setTags(note.tags.map((tag) => tag.name).join(", "));
        setPublished(note.is_published);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const note = await request<Note>(id ? `/admin/notes/${id}` : "/admin/notes", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content_markdown: content,
          is_published: published,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      setMessage("Perubahan tersimpan.");
      router.refresh();
      if (!id) router.replace(`/admin/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan catatan");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    const data = new FormData();
    data.append("file", file);
    setBusy(true);
    setError("");
    try {
      const asset = await request<{ markdown: string }>(`/admin/notes/${id}/assets`, { method: "POST", body: data });
      setContent((current) => `${current}\n\n${asset.markdown}`);
      setMessage("Gambar ditambahkan ke editor. Simpan catatan untuk mempertahankan perubahan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah gambar");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  if (loading) return <div className="center-card"><p>Memuat editor…</p></div>;

  return (
    <div className="editor-shell">
      <form className="editor-form" onSubmit={save}>
        <div className="editor-toolbar">
          <Link className="back-link" href="/admin">← Dashboard</Link>
          <div className="actions">
            {id && <label className="button secondary file-button">Tambah gambar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadImage} disabled={busy} /></label>}
            <button className="button primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </div>
        <div className="editor-fields">
          <label>Judul<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Judul catatan" required autoFocus /></label>
          <label>Topik<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="belajar, devops" /><small>Pisahkan dengan koma. Gunakan huruf kecil, angka, - atau _.</small></label>
          <label className="switch-row"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span>Publikasikan catatan</span></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <div className="editor-grid">
          <div className="editor-pane"><div className="pane-label">MARKDOWN</div><textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} required /></div>
          <div className="preview-pane"><div className="pane-label">PRATINJAU</div><Markdown content={content} assetBaseUrl={id ? `/api/v1/notes/${id}/assets` : undefined} /></div>
        </div>
      </form>
    </div>
  );
}
