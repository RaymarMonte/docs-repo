# Submission — docs-repo

A lightweight Google-Docs-style collaborative editor built for a timed, AI-native
take-home.

## Links

| | |
|---|---|
| **Live URL** | _<add after deploy>_ |
| **Repository** | _<this repo>_ |
| **Demo video** | _<add link>_ |
| **README / setup** | [README.md](./README.md) |
| **Architecture note** | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **AI-workflow note** | [docs/AI-WORKFLOW.md](./docs/AI-WORKFLOW.md) |
| **Build plan (locked spec)** | [docs/PLAN.md](./docs/PLAN.md) |

## What it does

- **Email + password auth** (Supabase), self-serve signup, confirmation off.
- **Rich-text editor** (Tiptap): bold, italic, underline, H1/H2, bullet + numbered
  lists. Content stored as HTML.
- **Debounced autosave (~800ms)** with a "Saving… / Saved" pill, a `beforeunload`
  guard, and flush-on-unmount — no manual Save button.
- **Import `.txt` / `.md`** client-side; Markdown is rendered, all imported HTML is
  sanitized before storage.
- **Share by email** with **view** or **edit** permission; a clear **Owned** vs.
  **Shared with me** dashboard.
- **Access control via Postgres Row-Level Security**, not application code.

## How to evaluate

1. Sign up two accounts (A and B) in separate browsers — no email confirmation needed.
2. A: create a doc, type (watch autosave), reload to confirm persistence; try Import.
3. A: open a doc → Share → enter B's email → view or edit.
4. B: find it under **Shared with me**; confirm edit can write and view cannot.

Full reviewer walkthrough and the "confirm email = off" note are in the
[README](./README.md).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + RLS) ·
Tailwind v4 + shadcn/ui · Tiptap · `marked` + `isomorphic-dompurify` · Vitest ·
deployed on Vercel.

## Highlights

- **Database-enforced authorization.** Split per-operation RLS policies; the view/edit
  distinction lives only in the `documents` UPDATE policy, so a forgotten code check
  can't leak write access. A `security definer` helper breaks the
  `documents`↔`document_shares` recursion. See [ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- **Verified against a live database with two real accounts**, not just a green build —
  this is how the RLS edit/view/unshare paths were confirmed.
- **AI-native process**: plan-first + locked contracts + parallel subagents for
  independent UI + live verification gates per block. See
  [AI-WORKFLOW.md](./docs/AI-WORKFLOW.md).

## Scope cuts (deliberate)

Real-time collaboration, comments/suggestions, version history, `.docx` import, roles
beyond view/edit, manual Save button. The public `profiles` read (so share-by-email can
resolve a recipient) is a documented trade-off. Next steps: `.docx` via `mammoth`,
presence indicators, PDF export, and replacing the public read with a lookup RPC.

## Status

All build blocks complete and verified live except **deploy** (Vercel + Supabase
redirect URLs) and the **demo video**, which require manual sign-in steps. See
[docs/PROGRESS.md](./docs/PROGRESS.md) for the block-by-block record.
