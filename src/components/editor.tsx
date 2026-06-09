"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { renameDocument, saveDocument, type SaveState } from "@/actions/documents";
import { Input } from "@/components/ui/input";
import { EditorToolbar } from "@/components/editor-toolbar";

const AUTOSAVE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorProps = {
  id: string;
  initialTitle: string;
  initialContent: string;
  /** False for view-only shares (sharing block); defaults to editable. */
  canEdit?: boolean;
};

/**
 * Client editor: Tiptap (StarterKit — which bundles Underline) with debounced
 * autosave for both
 * the title and the body. There is no Save button by design (PLAN.md §2).
 *
 * Autosave correctness notes — the parts that are easy to get wrong:
 *  - Latest title/body live in REFS, not state, so the debounced flush always
 *    reads the newest value and never a stale closure.
 *  - A single 800ms timer covers both fields; flush saves whichever is dirty.
 *  - `beforeunload` warns on tab close/refresh while dirty; the unmount cleanup
 *    flushes for in-app navigation (where beforeunload never fires).
 *
 * `immediatelyRender: false` is required: it stops Tiptap from rendering during
 * SSR, which would otherwise cause a hydration mismatch (PLAN.md §28). With it
 * set, this client component can be rendered straight from the RSC doc page —
 * no `dynamic(..., { ssr: false })` wrapper needed.
 */
export function Editor({
  id,
  initialTitle,
  initialContent,
  canEdit = true,
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const titleRef = useRef(initialTitle);
  const contentRef = useRef(initialContent);
  const dirtyRef = useRef({ title: false, content: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const dirty = dirtyRef.current;
    if (!dirty.title && !dirty.content) return;
    dirtyRef.current = { title: false, content: false };

    setStatus("saving");
    const ops: Promise<SaveState>[] = [];
    if (dirty.title) ops.push(renameDocument(id, titleRef.current));
    if (dirty.content) ops.push(saveDocument(id, contentRef.current));

    const results = await Promise.all(ops);
    const failed = results.find((r) => r?.error);
    setStatus(failed ? "error" : "saved");
  }, [id]);

  const schedule = useCallback(() => {
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    editable: canEdit,
    editorProps: {
      attributes: {
        // Content styling lives in globals.css under `.ProseMirror`.
        class: "min-h-[60vh] max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      contentRef.current = editor.getHTML();
      dirtyRef.current.content = true;
      schedule();
    },
  });

  // Warn on tab close / refresh while there are unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.title || dirtyRef.current.content) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Flush pending edits on in-app navigation (component unmount). `flush` is
  // stable (memoized on `id`), so this cleanup runs only on unmount.
  useEffect(() => () => void flush(), [flush]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Input
          aria-label="Document title"
          value={title}
          disabled={!canEdit}
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            titleRef.current = next;
            dirtyRef.current.title = true;
            schedule();
          }}
          className="h-auto border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          placeholder="Untitled"
        />
        <SaveIndicator status={status} />
      </div>

      {canEdit && editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed — retrying on next edit"
          : "";
  if (!label) return null;
  return (
    <span
      className={
        "shrink-0 text-sm " +
        (status === "error" ? "text-destructive" : "text-muted-foreground")
      }
    >
      {label}
    </span>
  );
}
