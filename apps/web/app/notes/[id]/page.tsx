import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { Markdown } from "@/components/markdown";
import { formatDate, serverApi } from "@/lib/api";
import type { Note } from "@/lib/types";

async function getNote(id: string): Promise<Note | null> {
  const response = await fetch(serverApi(`/notes/${id}`), { next: { revalidate: 30 } });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error("Failed to load note");
  return (await response.json()).data;
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const note = await getNote((await params).id);
  if (!note) notFound();
  return (
    <article className="article-shell">
      <div className="article-toolbar">
        <Link className="back-link" href="/">← Back to Archive</Link>
        <DownloadPdfButton title={note.title} />
      </div>
      <header className="article-header">
        <div className="note-meta">
          <time dateTime={note.created_at}>Created {formatDate(note.created_at)}</time>
          <time dateTime={note.updated_at}>Modified {formatDate(note.updated_at)}</time>
          {note.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}
        </div>
        <h1>{note.title}</h1>
      </header>
      <Markdown content={note.content_markdown ?? ""} assetBaseUrl={note.asset_base_url} />
    </article>
  );
}
