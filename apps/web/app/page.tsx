import Link from "next/link";
import type { ReactNode } from "react";
import { NoteSearch } from "@/components/note-search";
import { formatDate, serverApi } from "@/lib/api";
import type { Note, Tag } from "@/lib/types";

type Params = { tag?: string; q?: string; page?: string };

async function loadData(tag: string, q: string, page: number) {
  const query = new URLSearchParams({ page: String(page), limit: "6" });
  if (tag) query.set("tag", tag);
  if (q) query.set("q", q);
  const [notesResponse, tagsResponse] = await Promise.all([
    fetch(serverApi(`/notes?${query}`), { next: { revalidate: 30 } }),
    fetch(serverApi("/tags"), { next: { revalidate: 60 } }),
  ]);
  if (!notesResponse.ok || !tagsResponse.ok) return { notes: [], tags: [] };
  const [{ data: notes }, { data: tags }] = await Promise.all([notesResponse.json(), tagsResponse.json()]) as [{ data: Note[] }, { data: Tag[] }];
  return { notes, tags };
}

function href(params: Params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]);
  return `/?${query}`;
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  let start = 0;
  let match = lower.indexOf(query.toLowerCase());
  while (match !== -1) {
    parts.push(text.slice(start, match), <mark key={match}>{text.slice(match, match + query.length)}</mark>);
    start = match + query.length;
    match = lower.indexOf(query.toLowerCase(), start);
  }
  parts.push(text.slice(start));
  return parts;
}

function matchingLine(content: string | undefined, query: string) {
  return query ? content?.split("\n").find((line) => line.toLowerCase().includes(query.toLowerCase()))?.trim() : "";
}

export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const tag = params.tag ?? "";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1") || 1);
  const { notes: results, tags } = await loadData(tag, q, page);
  const hasNext = results.length > 5;
  const notes = results.slice(0, 5);
  const common = { tag, q };
  return (
    <div className="shell home">
      <section className="intro">
        <h1><span>Usupek&apos;s</span> Notes</h1>
      </section>

      <section className="archive">
        <div className="section-head">
          <h2>{tag ? `Topic: ${tag}` : "Newest Notes"}</h2>
          <div className="search"><NoteSearch value={q} /></div>
        </div>
        {tags.length > 0 && (
          <div className="filters">
            <Link className={!tag ? "active" : ""} href={href({ q })}>All</Link>
            {tags.map((item) => <Link className={tag === item.name ? "active" : ""} href={href({ ...common, tag: item.name })} key={item.id}>{item.name}</Link>)}
          </div>
        )}
        <div className="note-list">
          {notes.map((note, index) => (
            <Link className="note-row" href={`/notes/${note.id}`} key={note.id}>
              <span className="note-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{highlight(note.title, q)}</h3>
                <div className="note-meta">
                  <time>{formatDate(note.updated_at)}</time>
                  {note.tags.map((item) => <span key={item.id}>#{highlight(item.name, q)}</span>)}
                </div>
                {matchingLine(note.content_markdown, q) && <p className="search-excerpt">{highlight(matchingLine(note.content_markdown, q)!, q)}</p>}
              </div>
              <span className="arrow">↗</span>
            </Link>
          ))}
          {notes.length === 0 && <div className="empty">No note to show.</div>}
        </div>
        <div className="list-footer">
          <span>{notes.length} note(s)</span>
          <nav className="pagination" aria-label="Notes pages">
            {page > 1 && <Link href={href({ ...common, page: String(page - 1) })}>Previous</Link>}
            <span>Page {page}</span>
            {hasNext && <Link href={href({ ...common, page: String(page + 1) })}>Next</Link>}
          </nav>
        </div>
      </section>
    </div>
  );
}
