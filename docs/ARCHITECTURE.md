# Architecture

A lightweight Google-Docs-style editor: sign up, write rich-text documents with
debounced autosave, import `.txt`/`.md`, and share by email (view/edit). The guiding
principle is **the database is the authority** — access control is Postgres Row-Level
Security (RLS), not application code, so there is no trusted server path that can
forget a check.

## Stack & data flow

- **Next.js 16 (App Router) + React 19.** Reads happen in **React Server Components**;
  mutations happen in **Server Actions** (`src/actions/`). There is essentially no
  client-side data fetching — the editor is the only meaningfully interactive surface.
- **Supabase** (`@supabase/ssr`) — Postgres + Auth. Three client builders in
  `src/lib/supabase/`: `server.ts` (async, for RSC/actions), `client.ts` (browser),
  and `proxy.ts` for session refresh. Next 16 renamed `middleware` → `proxy`
  (`src/proxy.ts`); `cookies()` is async.
- **Tiptap** for the editor; content is stored as **HTML in a `text` column** — simple,
  portable, and directly renderable. (Trade-off: HTML is heavier and less structured
  than JSON; fine at this scope.)

```
Browser (RSC pages, Tiptap client)
   │  Server Actions (mutations)        RSC reads (await createClient())
   ▼                                    ▼
Supabase server client  ──────────►  Postgres + RLS  ◄── trigger mirrors auth.users → profiles
```

Every query runs as the logged-in user, so RLS filters it. A Server Action does not
need its own ownership check — the policy already constrains which rows it can touch.

## Data model

Three tables (full DDL in [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)):

- **`profiles`** `(id → auth.users, email)` — mirror of the auth user, populated by a
  `security definer` trigger (`handle_new_user`) on `auth.users` insert. This exists so
  share-by-email can resolve an address to a user id.
- **`documents`** `(id, owner_id, title, content /* HTML */, created_at, updated_at)`.
- **`document_shares`** `(id, document_id, shared_with, permission ∈ {view,edit})`,
  `unique(document_id, shared_with)`.

Indexes back the RLS subqueries and the dashboard's Owned/Shared split
(`documents.owner_id`, `document_shares.shared_with`, `document_shares.document_id`).

## RLS design (the core of the app)

Policies are deliberately **split per operation** — never a single `ALL` policy —
because the view/edit distinction must live in exactly one place.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `true` (public read) | — (trigger only) | — | — |
| `documents` | owner **or** shared-with | `owner_id = auth.uid()` | owner **or** `permission='edit'` share (USING **and** WITH CHECK) | owner |
| `document_shares` | shared-with **or** owner | owner only | — | owner |

Two deliberate decisions:

1. **Edit lives only in the `documents` UPDATE policy.** Viewers can `SELECT` but the
   UPDATE policy excludes them, so read-only sharing is enforced by the database, not
   by hiding a button. `saveDocument` therefore has **no owner check** in code — adding
   one would silently break legitimate edit-shares.

2. **Breaking the recursion cycle.** `documents` policies reference `document_shares`
   and vice-versa, which would recurse. A `security definer stable` helper,
   `is_document_owner(doc)`, lets `document_shares` policies ask "does the current user
   own this document?" without re-entering `documents`' RLS.

## Saving model

Autosave only — no manual Save button ([editor.tsx](../src/components/editor.tsx)):

- A single **~800ms debounce** covers both the title and body (via refs), calling
  `saveDocument` / `renameDocument`.
- `saveDocument` intentionally **does not `revalidatePath`** — it is the hot keystroke
  path and the client already holds the latest content. The dashboard's ordering
  catches up on the next create/rename/navigation, which *do* revalidate.
- A **`beforeunload` guard** covers tab close/refresh, and a **flush-on-unmount** effect
  covers in-app navigation, so a pending debounce is never silently dropped.

## Import & sanitization

`parseImportedFile(name, content)` ([parse-import.ts](../src/lib/parse-import.ts)) is a
pure function (hence the one unit test): `.md` → `marked.parse` (forced sync) → HTML;
`.txt` → escape each line → `<p>`. **Both paths end in `DOMPurify.sanitize`**
(`isomorphic-dompurify`, works identically in the browser and in jsdom), so an imported
`<script>` is inert before it ever reaches the database. Unsupported extensions throw.

## Notable trade-offs

- **Public `profiles` read.** Share-by-email needs to resolve an email to a user id, and
  the recipient isn't authenticated in the sharer's session. We expose `(id, email)`
  publicly (PLAN "Option A") rather than build a `security definer` lookup RPC. Known
  privacy trade-off; the RPC is the obvious hardening step.
- **`document_shares` ↔ `profiles` have no FK between them** (both FK `auth.users`), so
  PostgREST can't resolve an embed across them. The owner's "shared with" list is read
  in **two steps** (fetch shares, then resolve emails via `profiles.in(id, …)`) and
  joined in memory. Re-sharing at a new permission is **delete-then-insert**, not upsert,
  because `document_shares` has no UPDATE policy.
- **HTML content column** — see above; JSON + a render step would be the richer choice.
- **No realtime/CRDT.** Concurrent editors get last-write-wins. Out of scope here.

## What's cut (and what's next)

Cut: realtime collaboration, comments/suggestions, version history, `.docx` import,
roles beyond view/edit, manual Save. Natural next steps: `.docx` via `mammoth`,
presence indicators, export to PDF, and replacing the public `profiles` read with a
lookup RPC.
