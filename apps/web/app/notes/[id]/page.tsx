import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { formatDate, serverApi } from "@/lib/api";
import type { Note } from "@/lib/types";

async function getNote(id: string): Promise<Note | null> {
  const response = await fetch(serverApi(`/notes/${id}`), { next: { revalidate: 30 } });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error("Gagal memuat catatan");
  return (await response.json()).data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const note = await getNote((await params).id);
  return { title: note?.title ?? "Catatan tidak ditemukan" };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const note = await getNote((await params).id);
  if (!note) notFound();
  return (
    <article className="article-shell">
      <Link className="back-link" href="/">← Kembali ke arsip</Link>
      <header className="article-header">
        <div className="note-meta">
          <time>{formatDate(note.updated_at)}</time>
          {note.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}
        </div>
        <h1>{note.title}</h1>
      </header>
      <Markdown content={note.content_markdown ?? ""} assetBaseUrl={note.asset_base_url} />
    </article>
  );
}
