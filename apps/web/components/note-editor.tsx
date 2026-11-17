"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "./markdown";
import { request } from "@/lib/api";
import type { Note } from "@/lib/types";

const INDENT = "\t";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const IMAGE_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

// Clipboard images usually arrive as "image.png"; the API rejects duplicate names, so give each paste a unique one.
function pastedFilename(file: File) {
  const stamp = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `paste-${stamp}-${rand}.${IMAGE_EXTENSIONS[file.type] ?? "png"}`;
}

export function NoteEditor({ id }: { id?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pendingUploads = useRef(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("# New note\n\nStart writing here.");
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

  // Keep the preview exactly as tall as the textarea (which the user can resize) so both panes scroll the same way.
  useEffect(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;
    const observer = new ResizeObserver(() => {
      preview.style.height = `${textarea.offsetHeight}px`;
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [loading]);

  // Mirror the textarea's scroll position onto the preview, proportionally, since rendered markdown has a different height.
  function syncPreviewScroll() {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;
    const maxSource = textarea.scrollHeight - textarea.clientHeight;
    const ratio = maxSource > 0 ? textarea.scrollTop / maxSource : 0;
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }

  // Re-align after edits, since the rendered preview height changes with the content.
  useEffect(syncPreviewScroll, [content]);

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
      setMessage("Change saved.");
      router.refresh();
      if (!id) router.replace(`/admin/notes/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setBusy(false);
    }
  }

  // Replaces the current selection in the textarea and mirrors the DOM value back into state,
  // so React keeps the caret/selection instead of resetting it on re-render.
  function replaceSelection(text: string, start: number, end: number, selectStart: number, selectEnd: number) {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setRangeText(text, start, end, "preserve");
    el.setSelectionRange(selectStart, selectEnd);
    setContent(el.value);
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((current) => `${current}\n\n${text}`);
      return;
    }
    const start = el.selectionStart;
    const before = el.value.slice(0, start);
    const after = el.value.slice(el.selectionEnd);
    const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const suffix = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const inserted = prefix + text + suffix;
    replaceSelection(inserted, start, el.selectionEnd, start + inserted.length, start + inserted.length);
  }

  // Wraps the selection with markdown markers; toggles them off if the selection is already wrapped.
  function wrapSelection(before: string, after = before, placeholder = "text") {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    const innerWrapped = selected.length >= before.length + after.length && selected.startsWith(before) && selected.endsWith(after);
    const outerWrapped = value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after;
    if (innerWrapped) {
      const inner = selected.slice(before.length, selected.length - after.length);
      replaceSelection(inner, start, end, start, start + inner.length);
    } else if (outerWrapped && start >= before.length) {
      replaceSelection(selected, start - before.length, end + after.length, start - before.length, end - before.length);
    } else {
      const text = selected || placeholder;
      replaceSelection(before + text + after, start, end, start + before.length, start + before.length + text.length);
    }
  }

  function insertLink() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    if (selected) {
      // Select the URL placeholder so the user can type it straight away.
      const text = `[${selected}](url)`;
      replaceSelection(text, start, end, start + selected.length + 3, start + text.length - 1);
    } else {
      replaceSelection("[text](url)", start, end, start + 1, start + 5);
    }
  }

  // Toggles a prefix on every line touched by the selection (headings, lists, quotes).
  function toggleLinePrefix(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const allPrefixed = lines.every((line) => line.startsWith(prefix));
    const updated = lines.map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line)).join("\n");
    replaceSelection(updated, lineStart, lineEnd, lineStart, lineStart + updated.length);
  }

  // Inline code for a single-line selection, a fenced block when the selection spans lines.
  function toggleCode() {
    const el = textareaRef.current;
    if (!el) return;
    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
    if (selected.includes("\n")) wrapSelection("```\n", "\n```", "code");
    else wrapSelection("`", "`", "code");
  }

  // Tab inserts a tab at the caret, or indents every selected line when the selection spans lines.
  // Shift+Tab removes one level (a tab or up to 4 spaces) from every line touched by the selection.
  function indentSelection(outdent: boolean) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    if (!outdent && !value.slice(start, end).includes("\n")) {
      replaceSelection(INDENT, start, end, start + INDENT.length, start + INDENT.length);
      return;
    }
    // A selection ending right after a newline shouldn't pull in the next line.
    const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", effectiveEnd);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const lines = value.slice(lineStart, lineEnd).split("\n");

    if (!outdent) {
      const updated = lines.map((line) => INDENT + line).join("\n");
      replaceSelection(updated, lineStart, lineEnd, start + INDENT.length, end + INDENT.length * lines.length);
      return;
    }

    const removed = lines.map((line) => (line.startsWith("\t") ? 1 : (line.match(/^ {1,4}/)?.[0].length ?? 0)));
    const total = removed.reduce((sum, n) => sum + n, 0);
    if (total === 0) return;
    const updated = lines.map((line, i) => line.slice(removed[i])).join("\n");
    const newStart = Math.max(lineStart, start - removed[0]);
    const newEnd = Math.max(newStart, end - total);
    replaceSelection(updated, lineStart, lineEnd, newStart, newEnd);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      indentSelection(event.shiftKey);
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    // Use the physical key so Shift+8 etc. work regardless of keyboard layout.
    const code = event.code;
    const actions: Record<string, () => void> = {
      KeyB: () => wrapSelection("**", "**", "bold"),
      KeyI: () => wrapSelection("*", "*", "italic"),
      KeyE: toggleCode,
      KeyK: insertLink,
      KeyS: () => formRef.current?.requestSubmit(),
    };
    const shiftActions: Record<string, () => void> = {
      KeyX: () => wrapSelection("~~", "~~", "strikethrough"),
      KeyH: () => toggleLinePrefix("# "),
      Digit8: () => toggleLinePrefix("- "),
      Digit7: () => toggleLinePrefix("1. "),
      Period: () => toggleLinePrefix("> "),
    };
    const action = event.shiftKey ? shiftActions[code] : actions[code];
    if (!action) return;
    event.preventDefault();
    action();
  }

  async function uploadFile(file: File, filename = file.name) {
    if (!id) {
      setError("Save the note first before adding images.");
      return;
    }
    const placeholder = `![Uploading ${filename}…]()`;
    insertAtCursor(placeholder);
    const data = new FormData();
    data.append("file", file, filename);
    pendingUploads.current += 1;
    setBusy(true);
    setError("");
    try {
      const asset = await request<{ markdown: string }>(`/admin/notes/${id}/assets`, { method: "POST", body: data });
      setContent((current) => current.replace(placeholder, asset.markdown));
      setMessage("Image added to editor. Save note to keep changes.");
    } catch (err) {
      setContent((current) => current.replace(placeholder, ""));
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      pendingUploads.current -= 1;
      if (pendingUploads.current === 0) setBusy(false);
    }
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadFile(file);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.files).filter((file) => IMAGE_TYPES.includes(file.type));
    if (images.length === 0) return;
    event.preventDefault();
    for (const file of images) void uploadFile(file, pastedFilename(file));
  }

  if (loading) return <div className="center-card"><p>Loading editor…</p></div>;

  return (
    <div className="editor-shell">
      <form className="editor-form" onSubmit={save} ref={formRef}>
        <div className="editor-toolbar">
          <Link className="back-link" href="/admin">← Dashboard</Link>
          <div className="actions">
            {id && <label className="button secondary file-button">Add image<input type="file" accept={IMAGE_TYPES.join(",")} onChange={uploadImage} disabled={busy} /></label>}
            <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
        <div className="editor-fields">
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Note title" required autoFocus /></label>
          <label>Topics<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="learning, devops" /><small>Separate with commas. Use lowercase letters, numbers, - or _.</small></label>
          <label className="switch-row"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span>Public</span></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <div className="editor-grid">
          <div className="editor-pane">
            <div className="pane-label">MARKDOWN</div>
            <textarea ref={textareaRef} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={handleKeyDown} onScroll={syncPreviewScroll} onPaste={handlePaste} spellCheck={false} required />
            <div className="editor-hints">
              <span><kbd>Ctrl</kbd>+<kbd>B</kbd> bold</span>
              <span><kbd>Ctrl</kbd>+<kbd>I</kbd> italic</span>
              <span><kbd>Ctrl</kbd>+<kbd>E</kbd> code / code block</span>
              <span><kbd>Ctrl</kbd>+<kbd>K</kbd> link</span>
              <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> strike</span>
              <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> heading</span>
              <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd> list</span>
              <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd> numbered</span>
              <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> quote</span>
              <span><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> indent / outdent</span>
              <span><kbd>Ctrl</kbd>+<kbd>S</kbd> save</span>
              <span><kbd>Ctrl</kbd>+<kbd>V</kbd> paste image</span>
            </div>
          </div>
          <div className="preview-pane">
            <div className="pane-label">PREVIEW</div>
            <div className="preview-scroll" ref={previewRef}><Markdown content={content} assetBaseUrl={id ? `/api/v1/notes/${id}/assets` : undefined} /></div>
          </div>
        </div>
      </form>
    </div>
  );
}
