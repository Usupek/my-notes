"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/api";
import type { Note } from "@/lib/types";

const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif";
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

// The API only accepts names like "foo-bar.png" (one dot, lowercase); markdown links also break on spaces.
function safeImageName(name: string, taken: Set<string>) {
  const ext = (name.match(IMAGE_EXT)?.[1] ?? "png").toLowerCase();
  const stem = name.replace(IMAGE_EXT, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  let candidate = `${stem}.${ext}`;
  for (let i = 2; taken.has(candidate); i++) candidate = `${stem}-${i}.${ext}`;
  taken.add(candidate);
  return candidate;
}

function basename(path: string) {
  let value = path.trim().replace(/^<|>$/g, "").split(/[?#]/)[0];
  try {
    value = decodeURIComponent(value);
  } catch {}
  return value.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}

// Points image references at the uploaded assets, matching on the original file name.
// Handles standard `![alt](path "title")` and Obsidian-style `![[name.png|alt]]`.
function linkImages(markdown: string, urls: Map<string, string>) {
  return markdown
    .replace(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?)\s*\)/g, (match, alt: string, path: string, title: string) => {
      const url = urls.get(basename(path));
      return url ? `![${alt}](${url}${title})` : match;
    })
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, path: string, alt?: string) => {
      const url = urls.get(basename(path));
      return url ? `![${alt ?? path.replace(IMAGE_EXT, "")}](${url})` : match;
    });
}

export default function ImportNotePage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<{ note: Note; errors: string[] } | null>(null);

  useEffect(() => {
    request("/admin/me")
      .then(() => setAuthenticated(true))
      .catch(() => router.replace("/admin"));
  }, [router]);

  function addImages(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    setImages((current) => [...current, ...picked.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))]);
    event.target.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!markdownFile) return;
    setBusy(true);
    setError("");
    setFailed(null);
    try {
      setProgress("Mengimpor markdown…");
      const data = new FormData();
      data.append("file", markdownFile);
      data.append("is_published", "false");
      const note = await request<Note>("/admin/notes/import", { method: "POST", body: data });

      const urls = new Map<string, string>();
      const errors: string[] = [];
      const taken = new Set<string>();
      for (const [index, image] of images.entries()) {
        setProgress(`Mengunggah gambar ${index + 1}/${images.length}…`);
        const body = new FormData();
        body.append("file", image, safeImageName(image.name, taken));
        try {
          const asset = await request<{ url: string }>(`/admin/notes/${note.id}/assets`, { method: "POST", body });
          urls.set(image.name.toLowerCase(), asset.url);
        } catch (err) {
          errors.push(`${image.name}: ${err instanceof Error ? err.message : "gagal diunggah"}`);
        }
      }

      const original = note.content_markdown ?? (await markdownFile.text());
      const linked = linkImages(original, urls);
      if (linked !== original) {
        setProgress("Menautkan gambar…");
        await request<Note>(`/admin/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: note.title,
            content_markdown: linked,
            is_published: note.is_published,
            tags: note.tags.map((tag) => tag.name),
          }),
        });
      }

      if (errors.length) {
        setFailed({ note, errors });
        return;
      }
      router.push(`/admin/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor note");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  if (authenticated === null) return <div className="center-card"><p>Checking Session…</p></div>;

  return (
    <div className="shell admin-shell">
      <div className="admin-heading">
        <div><p className="eyebrow">IMPOR</p><h1>Import note</h1></div>
        <div className="actions"><Link className="text-button" href="/admin">← Back</Link></div>
      </div>
      <form className="import-form" onSubmit={submit}>
        <label>
          File markdown (.md)
          <input type="file" accept=".md,text/markdown" required disabled={busy} onChange={(event) => setMarkdownFile(event.target.files?.[0] ?? null)} />
        </label>
        <label>
          Gambar (opsional, bisa lebih dari satu)
          <input type="file" accept={IMAGE_ACCEPT} multiple disabled={busy} onChange={addImages} />
          <small>Gambar yang direferensikan di markdown (mis. <code>![](images/foto.png)</code> atau <code>![[foto.png]]</code>) akan ditautkan otomatis berdasarkan nama file.</small>
        </label>
        {images.length > 0 && (
          <ul className="import-files">
            {images.map((image) => (
              <li key={`${image.name}-${image.size}`}>
                <span>{image.name}</span>
                <button type="button" className="danger-link" disabled={busy} onClick={() => setImages((current) => current.filter((item) => item !== image))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="form-error">{error}</p>}
        {failed && (
          <div className="form-error">
            <p>Note berhasil diimpor, tetapi beberapa gambar gagal diunggah:</p>
            <ul>{failed.errors.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link href={`/admin/notes/${failed.note.id}`}>Buka note →</Link>
          </div>
        )}
        <button className="button primary" disabled={busy || !markdownFile}>{busy ? progress || "Mengimpor…" : "Impor"}</button>
      </form>
    </div>
  );
}
