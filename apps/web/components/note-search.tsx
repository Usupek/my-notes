"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function NoteSearch({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(value);

  useEffect(() => {
    if (query.trim() === value) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      const next = query.trim();
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      params.delete("limit");
      startTransition(() => router.replace(`/?${params}`, { scroll: false }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, router, searchParams, value]);

  return <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes..." aria-label="Search notes" />;
}
