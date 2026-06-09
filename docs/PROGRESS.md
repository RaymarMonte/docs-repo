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
| 0:50–1:40 — Dashboard (Owned/Shared) + Tiptap editor + create/rename/autosave + beforeunload & flush-on-unmount | ⬜ **Next up.** |
| 1:40–2:10 — Share-by-email action + dialog; verify RLS as 2nd account | ⬜ Not started. (Closes the auth-path RLS check above.) |
| 2:10–2:25 — FileReader import + `parseImportedFile` | ⬜ Not started. |
| 2:25–2:40 — `parse-import.test.ts` + validation | ⬜ Not started. |
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

## Next up — `0:50–1:40` dashboard + editor block

Files to create (PLAN.md §Routes & files):
- `src/app/page.tsx` — **rebuild** the placeholder into the dashboard RSC. Guard:
  `getUser()` → `redirect("/login")` if absent. Split into **Owned** (`owner_id = me`)
  and **Shared with me** (join `document_shares`). Add a sign-out control here
  (wire to the existing `signOut` action) and a "New document" button (→ `createDocument`).
- `src/app/doc/[id]/page.tsx` — RSC: fetch the doc, pass to the client editor.
  Remember `params` is a Promise in Next 16 (`await props.params`).
- `src/components/editor.tsx` — `"use client"` Tiptap (StarterKit + Underline),
  toolbar, debounced autosave (~800ms) → `saveDocument`, `beforeunload` guard +
  flush-on-unmount. Dynamic-import with `ssr:false`, `immediatelyRender:false`.
- `src/actions/documents.ts` — `createDocument` / `renameDocument` / `saveDocument`
  / `deleteDocument`.

## Dependencies

⬜ **Install before the next block** (needed by the editor, starting now):
`@tiptap/react @tiptap/starter-kit @tiptap/extension-underline marked isomorphic-dompurify`
Use pnpm; prefix `C:\nvm4w\nodejs` on PATH if `node`/`pnpm` aren't found, and watch
the pnpm `allowBuilds` approval prompt.

✅ shadcn `input` + `label` already added (auth block). `button` + `card` pre-existed.
