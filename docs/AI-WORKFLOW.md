# AI Workflow

How this project was built with an AI-native workflow (Claude Code / Opus). The goal
was not "AI writes some code" but a repeatable loop: **plan once, parallelize the
build, verify against the real system, write down what was learned.**

## 1. Plan first, then lock it

Before any code, the whole slice was designed into [PLAN.md](./PLAN.md): product scope
in one line, a locked decisions table (editor, saving model, auth, import, RLS shape),
the full data model and RLS policies, the route/file map, server-action contracts, and
a time-boxed budget. PLAN.md is treated as **immutable spec** — it doesn't change as
work proceeds. This keeps every later AI step anchored to one source of truth instead
of re-litigating decisions mid-build.

A separate living doc, [PROGRESS.md](./PROGRESS.md), tracks what's actually done,
block by block, including bugs found during verification. The split (frozen spec vs.
live status) is what makes the work resumable across sessions.

## 2. Read the framework, don't trust training data

Next.js 16 has breaking changes vs. the model's training cutoff (`middleware` → `proxy`,
async `cookies()`, client-only libs needing `ssr:false`). The first block was spent
reading `node_modules/next/dist/docs/` and capturing the deltas in
[NEXTJS16-CHEATSHEET.md](./NEXTJS16-CHEATSHEET.md). Treating the installed version as
the authority — not the model's memory — avoided a class of subtle, confident mistakes.

## 3. Parallelize with subagents against locked signatures

Once the server-action contracts and RLS were fixed, independent UI pieces were built
**in parallel by subagents** while the main agent owned the RLS-critical, ordering-
sensitive code. Examples:

- Main agent (Opus): `documents.ts` / `shares.ts` actions, the RLS migration, the doc
  page's permission logic — anything where a wrong call is a silent security hole.
- Subagents (Sonnet): `share-dialog.tsx`, `import-button.tsx`, the dashboard, the
  toolbar, the unit test — pure UI/logic written against the already-locked signatures.

Because the interfaces were frozen first, the pieces composed without rework.

## 4. Verify against the real system, not just types

A clean `tsc`/`build` was treated as necessary but **not sufficient**. Each block has a
written verification gate run against a live Supabase project and real accounts:

- Auth: signing up actually lands a row in `profiles` (proves the trigger fires).
- Editor: login → create → type → "Saved" → reload persists → rename persists.
- **Sharing: two real accounts** — owner shares view/edit, edit-share saves and the
  owner sees it, viewer cannot write, unshare works. This is the only way to actually
  exercise RLS; unit tests can't.
- Import: a real `.md` heading renders `<h1>`; a `<script>` in a `.txt` stays inert.

This caught bugs that compile cleanly, e.g. a PostgREST embed across two tables with no
FK between them returning an empty "shared with" list even though the share existed —
fixed with a two-step read.

## 5. Write down what was learned

Every non-obvious gotcha went straight into PROGRESS.md or a memory note so it isn't
rediscovered: the duplicate Tiptap Underline extension, `@tailwindcss/typography` not
resolving under pnpm-strict + Tailwind v4 (worked around with explicit `.ProseMirror`
CSS), delete-then-insert instead of upsert for re-sharing, and the two-step
shares/profiles read. The cost of finding a gotcha is paid once.

## Testing philosophy

Per the plan, exactly **one** unit test ([parse-import.test.ts](../src/lib/parse-import.test.ts))
covers the one genuinely pure, security-relevant function — Markdown → HTML and
`<script>` stripping. Async Server Components and full RSC/Server-Action/RLS flows
aren't reliably unit-testable, so they're covered by the live two-account verification
above rather than by brittle mocks. AI is good at generating lots of low-value tests;
the discipline here was to write the *one* test that matters and verify the rest for
real.
