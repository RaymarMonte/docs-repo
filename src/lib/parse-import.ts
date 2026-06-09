import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

/**
 * Result of parsing an imported file: a derived title (from the filename) and
 * sanitized HTML ready to store in `documents.content` (Tiptap renders it on open).
 */
export type ParsedImport = { title: string; html: string };

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Convert an uploaded `.md` / `.txt` file into sanitized HTML for the editor.
 *
 * Pure and synchronous by design — this is the one unit-tested function
 * (PLAN.md §6). Two security-relevant details:
 *  - `.md` is rendered with `marked.parse(..., { async: false })` so it returns a
 *    string (marked can otherwise return a Promise), keeping the fn sync/testable.
 *  - `.txt` is HTML-escaped line-by-line BEFORE wrapping in `<p>`, so file text is
 *    never interpreted as markup. DOMPurify is the second line of defense on both
 *    paths and strips anything dangerous (e.g. a `<script>` pasted into a `.txt`).
 *
 * `isomorphic-dompurify` runs unchanged in the browser and in Vitest's jsdom.
 *
 * @throws if the file is neither `.md` nor `.txt`.
 */
export function parseImportedFile(name: string, content: string): ParsedImport {
  const lower = name.toLowerCase();
  const isMd = lower.endsWith(".md");
  const isTxt = lower.endsWith(".txt");
  if (!isMd && !isTxt) {
    throw new Error("Only .txt and .md files are supported.");
  }

  const title = name.replace(/\.(md|txt)$/i, "").trim() || "Untitled";

  let raw: string;
  if (isMd) {
    raw = marked.parse(content, { async: false }) as string;
  } else {
    raw = content
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : ""))
      .join("");
  }

  return { title, html: DOMPurify.sanitize(raw) };
}
