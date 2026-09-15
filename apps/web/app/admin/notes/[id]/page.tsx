import { NoteEditor } from "@/components/note-editor";

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  return <NoteEditor id={(await params).id} />;
}
