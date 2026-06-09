# PreAjaia — Progress

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
- ⬜ **Authenticated / share RLS paths not yet verified** — owner-sees-own,
  edit-share-can-update, viewer-cannot-write need two real accounts. Do this in the
  `1:40–2:10` block.

## Build blocks (from PLAN.md §Time budget)

| Block | Status |
|---|---|
| 0:00–0:20 — Read Next 16 docs + migration | ✅ **Done.** Docs read (cheatsheet); migration applied & verified. |
| 0:20–0:50 — Auth signup/login page; verify trigger populates `profiles` | ⬜ **Next up.** |
| 0:50–1:40 — Dashboard (Owned/Shared) + Tiptap editor + create/rename/autosave + beforeunload & flush-on-unmount | ⬜ Not started. |
| 1:40–2:10 — Share-by-email action + dialog; verify RLS as 2nd account | ⬜ Not started. (Closes the auth-path RLS check above.) |
| 2:10–2:25 — FileReader import + `parseImportedFile` | ⬜ Not started. |
| 2:25–2:40 — `parse-import.test.ts` + validation | ⬜ Not started. |
| 2:40–3:00 — Deploy (Vercel + Supabase prod) + smoke test | ⬜ Not started. |
| wrap — README · architecture note · AI note · SUBMISSION.md · video | ⬜ Not started. |

## Not started — files to create (PLAN.md §Routes & files)

None of the app code exists yet. Next session starts the `0:20–0:50` block:
`src/app/login/page.tsx`, `src/actions/auth.ts` (signUp/signIn/signOut), then sign up
a test account and confirm a row lands in `public.profiles` (proves the trigger fires).

## Dependencies

⬜ New deps from PLAN.md not yet installed:
`@tiptap/react @tiptap/starter-kit @tiptap/extension-underline marked isomorphic-dompurify`
(needed from the `0:50` editor block onward, not for auth).
