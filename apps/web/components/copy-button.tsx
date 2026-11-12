"use client";

import { useRef, useState } from "react";

export function CopyField({ value }: { value: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API is unavailable on non-secure origins; let the user copy manually.
      input.current?.select();
    }
  }

  return (
    <div className="feed-url">
      <input ref={input} readOnly value={value} aria-label="RSS feed URL" onFocus={(event) => event.target.select()} />
      <button type="button" className="rss-button" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
    </div>
  );
}
