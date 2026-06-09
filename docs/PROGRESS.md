# docs-repo — Progress

> **Read this first.** Live status against [PLAN.md](./PLAN.md) (the locked plan) and
> [NEXTJS16-CHEATSHEET.md](./NEXTJS16-CHEATSHEET.md) (framework deltas). PLAN.md is the
> spec and doesn't change; this file tracks what's actually done.
>
> Last updated: 2026-06-09.

## Environment (gate — RESOLVED)

- ✅ `.env.local` points at a **live** Supabase project — ref `wfofifhqexzomspzxcrc`.
  URL + anon (publishable `sb_publishable_…`) key present. Auth health = `200`.
- ✅ **Confirm email = OFF** (Supabase dashboard, Auth → Providers → Email). Self-serve
  signup works without confirmation — needed for the two-account sharing test.
- ⚠️ No service-role key in `.env.local`. **Not needed** for this slice (app uses
  `@supabase/ssr` + anon key + RLS; migration runs in the SQL editor). Add only if a
  server-side path must bypass RLS.

## Database — migration applied & verified

[supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) is committed
(`eee3f78`) **and has been run** against the live project.

- ✅ Tables `profiles`, `documents`, `document_shares` resolve via REST (`200`).
- ✅ Trigger `handle_new_user` + helper `is_document_owner` created.
- ✅ RLS **on** and enforcing — anon `SELECT` returns `[]`; anon `INSERT` rejected
  (`42501` row-level security violation).
- ✅ **Trigger verified against a real account** — signing up via the UI lands a
  row in `public.profiles` (proves `on_auth_user_created` fires). Confirmed
  `0:20–0:50` block.
- ⬜ **Share / edit / viewer RLS paths still not verified** — owner-sees-own,
  edit-share-can-update, viewer-cannot-write need two real accounts. Do this in the
  `1:40–2:10` block.

## Build blocks (from PLAN.md §Time budget)

| Block | Status |
|---|---|
| 0:00–0:20 — Read Next 16 docs + migration | ✅ **Done.** Docs read (cheatsheet); migration applied & verified. |
| 0:20–0:50 — Auth signup/login page; verify trigger populates `profiles` | ✅ **Done** (`5ec566d`). Signup/login/logout + trigger verified against a real account. |
| 0:50–1:40 — Dashboard (Owned/Shared) + Tiptap editor + create/rename/autosave + beforeunload & flush-on-unmount | ✅ **Done.** All files landed; `pnpm build` clean; **slice verified live** (signup→create→type→autosave "Saved"→reload persists→rename persists→listed under Owned). Two bugs found & fixed in verify: duplicate Underline ext removed; editor body styled via `.ProseMirror` CSS (typography plugin doesn't resolve under pnpm+TW4). |
| 1:40–2:10 — Share-by-email action + dialog; verify RLS as 2nd account | ✅ **Done & verified live (2 accounts).** Share view/edit, edit-share saves + owner sees changes, owner shares-list + unshare all confirmed. One bug found & fixed in verify (shares-list embed → two-step read). |
| 2:10–2:25 — FileReader import + `parseImportedFile` | ✅ **Done & verified live.** `.md` heading renders `<h1>`; `<script>` in a `.txt` is inert. |
| 2:25–2:40 — `parse-import.test.ts` + validation | ✅ **Done.** 5/5 tests pass; button handles parse/extension errors inline. |
| 2:40–3:00 — Deploy (Vercel + Supabase prod) + smoke test | ⬜ Not started. |
| wrap — README · architecture note · AI note · SUBMISSION.md · video | ⬜ Not started. |

## Done — auth files (PLAN.md §Routes & files)

Shipped in `5ec566d`:
- `src/actions/auth.ts` — `signIn` / `signUp` / `signOut`. `useActionState`-shaped
  (`(prevState, formData) => AuthState`); `redirect()` kept outside any try/catch
  (it throws `NEXT_REDIRECT`); `revalidatePath("/", "layout")` before each redirect.
  Sign-up assumes confirm-email OFF → returns a live session.
- `src/components/auth-form.tsx` — `"use client"` form, sign-in/sign-up mode toggle,
  error + pending state via `useActionState`.
- `src/app/login/page.tsx` — RSC; redirects already-logged-in users to `/`.
- `src/components/ui/{input,label}.tsx` — added via shadcn.

## Done — `0:50–1:40` dashboard + editor block

✅ **Slice verified live** end-to-end and committed. Files below.

**Note for next session:** `deleteDocument` action exists but is **not wired to any
UI** — this was out of the block's scope (create/rename/autosave only). Wire a delete
control on the dashboard when convenient; it's a small follow-up, not a gap.

**Landed (Opus, typecheck clean):**
- ✅ `src/actions/documents.ts` — `createDocument` (sets `owner_id`, redirects to
  `/doc/[id]`) / `renameDocument` / `saveDocument` (no revalidate — autosave hot
  path) / `deleteDocument`. Authorization left to RLS; no owner check in
  `saveDocument` so edit-shares keep working.
- ✅ `src/components/editor.tsx` — `"use client"` Tiptap (**StarterKit only — it
  already bundles Underline**, so a separate `@tiptap/extension-underline` was a
  duplicate and is removed), `immediatelyRender:false`, single 800ms debounce
  covering title + body via refs, `beforeunload` guard + flush-on-unmount,
  Saving/Saved/error pill. Rendered directly from the RSC doc page (the
  `immediatelyRender:false` flag removes the need for a `dynamic(ssr:false)` wrapper).
- ✅ `src/app/doc/[id]/page.tsx` — RSC, `await props.params`, `getUser` guard,
  `maybeSingle()` → `notFound()`; `canEdit = owner` for now (sharing block widens it).
- ✅ `src/components/editor-toolbar.tsx` (Sonnet) — full toolbar: bold, italic,
  underline, H1, H2, bullet list, numbered list, lucide icons + aria-labels.
- ✅ `src/app/page.tsx` (Sonnet) — dashboard RSC. `getUser()` → `redirect("/login")`.
  **Owned** (`owner_id = me`, ordered by `updated_at`) + **Shared with me** (via
  `document_shares` nested relation, normalized defensively). Card grid + empty
  states, "New document" (→ `createDocument`) + sign-out (→ `signOut`) controls.

✅ `pnpm build` passes; `tsc` + `lint` clean (one pre-existing warning in
`api/chat/route.ts`, untouched).

**Slice gate — ✅ VERIFIED:** login → New document → type → "Saved" → reload
`/doc/[id]` → content persisted → rename persisted → dashboard listed it under Owned.
Confirmed via live `pnpm dev` + a real signup account and the server-action log.
**This also closes the first real exercise of the `documents` INSERT/UPDATE RLS
paths** (owner create + owner save both succeeded).

## Done — `1:40–2:10` share-by-email block (code)

✅ `pnpm build` clean; `tsc` + `lint` clean (same one pre-existing `route.ts` warning).

**Landed (Opus, RLS-critical):**
- ✅ `src/actions/shares.ts` — `shareDocument(docId, email, permission)` /
  `unshareDocument(docId, userId)`. Resolves recipient via public `profiles`
  read (`ilike` email), rejects empty/invalid-permission/self-share with clear
  messages. ⚠️ **Delete-then-insert, NOT upsert** — `document_shares` has no
  UPDATE policy (only SELECT/INSERT/DELETE), so an upsert's ON CONFLICT DO UPDATE
  path would 42501. Delete-then-insert stays on owner-allowed paths and supports
  re-sharing at a new permission level. Returns `{ error } | { ok: true }`.
- ✅ `src/app/doc/[id]/page.tsx` — widened `canEdit` to
  `owner || my-share.permission === 'edit'`; owner-only fetch of recipients
  (`document_shares` + nested `profiles(email)`, normalized) passed to the dialog;
  `<ShareDialog>` rendered in the header **for the owner only**.

**Landed (Sonnet subagent, pure UI):**
- ✅ `src/components/share-dialog.tsx` — `"use client"` dialog: email + view/edit
  native `<select>` (default edit), `useTransition` + `router.refresh()` to pull
  revalidated props, inline success/error, per-recipient unshare (X) buttons.
- ✅ `src/components/ui/dialog.tsx` — shadcn nova dialog primitive, hand-written to
  match the repo's unified `radix-ui` import convention (the `shadcn add` CLI
  prompted to overwrite `button.tsx`, so it was bypassed). No new npm dep —
  `radix-ui` was already present.

**✅ 2-account RLS verify — DONE (live, two real accounts):**
- ✅ A shares B as **view** and as **edit**.
- ✅ B (edit-share) types → autosave "Saved" → A sees the changes (confirms the
  `documents` UPDATE edit-share path + delete-then-insert re-share).
- ✅ A's Share dialog lists B with permission; **unshare (X) works**.

> **Bug found & fixed in verify** (`5c310b3`): the owner's shares-list used a
> `document_shares.select("... , profiles(email)")` PostgREST **embed**, but
> `document_shares.shared_with` and `profiles.id` both FK to `auth.users(id)` with
> **no FK between the two tables** — so the embed can't be resolved and the query
> errored to an empty list ("Not shared with anyone yet", no unshare controls)
> *even though the share existed and B had access*. Fixed with a **two-step read**:
> fetch shares, then resolve emails from `profiles` via `.in("id", ...)` and join
> in memory. ⚠️ Keep this pattern for any future `document_shares`↔`profiles` join;
> the dashboard's `document_shares→documents(...)` embed is fine (that FK exists).

## Done — `2:10–2:40` import block (code + test)

✅ `pnpm test:run` 5/5 · `pnpm build` clean · `tsc` + `lint` clean (same one
pre-existing `route.ts` warning).

**Landed (Opus — pure fn + RLS insert):**
- ✅ `src/lib/parse-import.ts` — `parseImportedFile(name, content) → { title, html }`.
  `.md` → `marked.parse(..., { async: false })` (forced sync so the fn stays pure
  and testable). `.txt` → HTML-escape each non-empty line, wrap in `<p>`. **Both
  paths end in `DOMPurify.sanitize`** (isomorphic-dompurify — runs in browser + jsdom
  unchanged). Title derived from filename, extension stripped, `"Untitled"` fallback.
  Throws on any non-`.md`/`.txt` extension.
- ✅ `src/actions/documents.ts` — added `importDocument(title, html)`: sibling of
  `createDocument` (sets `owner_id` for the INSERT policy, `revalidatePath`,
  `redirect` outside try/catch). Kept separate so the dashboard's zero-arg
  `createDocument` form action is untouched.

**Landed (Sonnet subagents, in parallel against the locked signatures):**
- ✅ `src/components/import-button.tsx` — `"use client"`; hidden
  `<input accept=".txt,.md">` + `<Button variant="outline">` ("Import" / "Importing…").
  FileReader → `parseImportedFile` → `importDocument` in `useTransition`. Parse/extension
  errors shown inline (`text-destructive`); resets input value so re-picking the same
  file re-fires. Wired into `src/app/page.tsx` header (between New document / Sign out).
- ✅ `src/lib/parse-import.test.ts` — the meaningful unit test (PLAN §6): `# H` → `<h1>`;
  `<script>` in a `.txt` does not survive; title-from-filename; unsupported ext throws.

**✅ Live verify — DONE:** imported a real `.md` with a heading → opened as a doc
rendering `<h1>`; imported a `.txt` containing `<script>` → text is inert, no
execution. (Throwaway fixtures used for this were not committed.)

## Dependencies

✅ Installed: `@tiptap/react @tiptap/starter-kit marked isomorphic-dompurify`
(`marked` + `isomorphic-dompurify` now **in use** by `src/lib/parse-import.ts`).
✅ shadcn `input` + `label` (auth block). `button` + `card` pre-existed.
❌ Removed: `@tiptap/extension-underline` (StarterKit bundles Underline — duplicate).

> **Editor content styling:** the `@tailwindcss/typography` `@plugin` directive does
> **not** resolve under this pnpm-strict + Tailwind v4 toolchain (the postcss plugin
> can't see a package that isn't its own dependency). Instead, editor body styles
> (h1/h2 sizes, list markers stripped by preflight) live as explicit `.ProseMirror`
> rules in `globals.css`. No plugin dependency. Verified: `/login` 200, fonts OK.
>
> ⚠️ Gotcha hit: `rm -rf .next` evicts cached Google Fonts; they re-download on next
> `pnpm dev` (needs network to fonts.gstatic.com). Don't clear `.next` offline.
