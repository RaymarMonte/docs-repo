# Import samples

Sample files for testing the document **Import** flow (dashboard → **Import**).
Supported types are `.md` and `.txt`; anything else is rejected with an inline
error.

| File | Purpose |
|---|---|
| [`sample-notes.md`](./sample-notes.md) | Markdown with headings, lists, bold/italic, a blockquote, and nested lists. Imports as rich text — confirms formatting survives the round-trip. |
| [`sample-pentest.txt`](./sample-pentest.txt) | Plain text containing common XSS / injection payloads. Confirms imported content is sanitized: the readable text imports fine and the payloads render as inert text (or are stripped) — **no script executes**. |

The sanitization behavior is also covered by an automated test in
[`src/lib/parse-import.test.ts`](../src/lib/parse-import.test.ts).
