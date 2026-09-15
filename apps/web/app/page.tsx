import Link from "next/link";
import { formatDate, serverApi } from "@/lib/api";
import type { Note, Tag } from "@/lib/types";

async function loadData(tag?: string) {
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  const [notesResponse, tagsResponse] = await Promise.all([
    fetch(serverApi(`/notes${query}`), { next: { revalidate: 30 } }),
    fetch(serverApi("/tags"), { next: { revalidate: 60 } }),
  ]);
  if (!notesResponse.ok || !tagsResponse.ok) return { notes: [], tags: [] };
  const [{ data: notes }, { data: tags }] = await Promise.all([notesResponse.json(), tagsResponse.json()]) as [{ data: Note[] }, { data: Tag[] }];
  return { notes, tags };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const { notes, tags } = await loadData(tag);
  return (
    <div className="shell home">
      <section className="intro">
        <p className="eyebrow">CATATAN PRIBADI</p>
        <h1>Hal-hal yang layak<br />diingat kembali.</h1>
        <p>Kumpulan pemikiran, pelajaran, dan temuan kecil sepanjang perjalanan.</p>
      </section>

      <section className="archive">
        <div className="section-head">
          <h2>{tag ? `Topik: ${tag}` : "Tulisan terbaru"}</h2>
          <span>{notes.length} catatan</span>
        </div>
        {tags.length > 0 && (
          <div className="filters">
            <Link className={!tag ? "active" : ""} href="/">Semua</Link>
            {tags.map((item) => <Link className={tag === item.name ? "active" : ""} href={`/?tag=${item.name}`} key={item.id}>{item.name}</Link>)}
          </div>
        )}
        <div className="note-list">
          {notes.map((note, index) => (
            <Link className="note-row" href={`/notes/${note.id}`} key={note.id}>
              <span className="note-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{note.title}</h3>
                <div className="note-meta">
                  <time>{formatDate(note.updated_at)}</time>
                  {note.tags.map((item) => <span key={item.id}>#{item.name}</span>)}
                </div>
              </div>
              <span className="arrow">↗</span>
            </Link>
          ))}
          {notes.length === 0 && <div className="empty">Belum ada catatan untuk ditampilkan.</div>}
        </div>
      </section>
    </div>
  );
}
