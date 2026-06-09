# docs-repo

A lightweight Google-Docs-style collaborative editor. Sign up, create and edit
rich-text documents with debounced autosave, import `.txt`/`.md` files, and share
documents by email with view or edit permissions — split into a clear **Owned** vs.
**Shared with me** dashboard. Built with Next.js 16 (App Router), React 19, Supabase
(Postgres + Auth + Row-Level Security), Tailwind v4 + shadcn/ui, and Vitest.

**Live URL:** _<add after deploy>_ · **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · **AI workflow:** [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md)

## Features

- **Auth** — email + password (Supabase). Self-serve signup, no seeding.
- **Rich-text editor** — Tiptap (bold, italic, underline, H1/H2, bullet + numbered
  lists). Content stored as HTML.
- **Debounced autosave** (~800ms) with a "Saving… / Saved" pill, a `beforeunload`
  guard, and flush-on-unmount for in-app navigation. No manual Save button.
- **Import** `.txt` and `.md` files client-side; Markdown is rendered and all imported
  HTML is sanitized (DOMPurify) before it is stored.
- **Sharing by email** — grant another account view or edit access; access is enforced
  by Postgres Row-Level Security, not application code.

## Prerequisites

- **Node.js 22 LTS** — this repo pins it via [`.nvmrc`](.nvmrc). With
  [nvm-windows](https://github.com/coreybutler/nvm-windows): `nvm install 22 && nvm use 22`.
- **pnpm** — enable via Corepack (ships with Node): `corepack enable pnpm`.

## Getting started

```bash
pnpm install

# configure environment
cp .env.example .env.local   # then fill in the values

pnpm dev                     # http://localhost:3000
```

### Environment variables

See [`.env.example`](.env.example). You only need the two Supabase keys:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase
  project's API settings (Project Settings → API).

> `src/app/api/chat/route.ts` is an unused scaffold stub (returns `501`); it needs no
> key and is not part of this product.

### Database setup

The schema, trigger, and Row-Level Security policies live in a single migration:
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Run it once
against your project (Supabase dashboard → SQL Editor → paste & run).

> **Confirm email = OFF.** In the Supabase dashboard, set
> **Auth → Providers → Email → Confirm email = off**. Signup then returns a live
> session immediately, which is what lets reviewers create two accounts and test
> sharing without an email round-trip.

## Supported import file types

- **`.md`** — Markdown, rendered to rich text (headings, lists, emphasis, etc.).
- **`.txt`** — plain text; each line becomes a paragraph.

Any other extension is rejected with an inline error. All imported content is
sanitized (DOMPurify) before it is stored, so embedded `<script>`/HTML cannot execute.

## Trying it out (reviewers)

1. Open the app and **Sign up** with any email + password (no confirmation email —
   see the note above). Repeat in a second browser/incognito window to make a
   **second account** (e.g. `a@example.com` and `b@example.com`).
2. As account A: **New document** → type → watch the pill go "Saving…" → "Saved".
   Reload to confirm it persisted. Try **Import** with a `.md` or `.txt` file.
3. As account A: open a doc → **Share** → enter account B's email → choose **view**
   or **edit** → Share.
4. As account B: the doc appears under **Shared with me**. With **edit** access B can
   change it and A sees the update; with **view** access B cannot modify it.

## Scripts

- `pnpm dev` — dev server
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` — ESLint
- `pnpm test` / `pnpm test:run` — Vitest (watch / single run)
- `pnpm format` / `pnpm format:check` — Prettier

## Project structure

```
src/
  app/
    login/page.tsx       # login + signup
    page.tsx             # dashboard RSC — "Owned" / "Shared with me"
    doc/[id]/page.tsx    # RSC: fetch doc + permissions, render client editor
  actions/               # Server Actions (mutations)
    auth.ts              # signUp / signIn / signOut
    documents.ts         # create / import / rename / save / delete
    shares.ts            # shareDocument / unshareDocument
  components/
    editor.tsx           # Tiptap + autosave + beforeunload + flush-on-unmount
    editor-toolbar.tsx   # bold/italic/underline/H1/H2/lists
    share-dialog.tsx     # share by email + permission
    import-button.tsx    # FileReader → parseImportedFile → importDocument
    auth-form.tsx
    ui/                  # shadcn/ui components
  lib/
    parse-import.ts      # parseImportedFile() — the tested pure fn
    parse-import.test.ts
    supabase/            # client.ts, server.ts, proxy.ts
    utils.ts             # cn() + shared helpers
  proxy.ts               # session refresh (Next.js 16 "proxy", formerly middleware)
supabase/migrations/0001_init.sql   # schema + trigger + RLS
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, RLS policy
design, and the autosave/sharing trade-offs.

## Stack & conventions

See [`AGENTS.md`](AGENTS.md) for the full stack details and the conventions agents
(and humans) should follow — RSC for reads, Server Actions for mutations, Supabase
client usage rules, and the Next.js 16 `proxy` change.

## Deployment

Deploys to [Vercel](https://vercel.com):

1. Import the repo into Vercel (framework auto-detected as Next.js).
2. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables in the Vercel project
   settings (same values as `.env.local`).
3. In the Supabase dashboard → **Authentication → URL Configuration**, add the Vercel
   deployment URL as the **Site URL** (and to **Redirect URLs**).
4. Deploy, then smoke-test: sign up → create → autosave → reload → share.

## Known limitations & next steps

Intentionally out of scope for this slice: real-time collaboration, comments/
suggestions, version history, `.docx` import, roles beyond view/edit, and a manual
Save button. `profiles.email` is publicly readable so share-by-email can resolve a
recipient — a documented trade-off (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
