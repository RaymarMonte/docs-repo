# AI Workflow & Tooling Strategy

How this project was built with an AI-native workflow, and — more importantly —
**where human architectural judgment and adversarial verification were required to
override naive AI suggestions**, prevent data loss, and secure the database, all inside
a 4-hour time budget.

The goal was not "AI writes some code" but a repeatable loop: **plan once, parallelize
the build, red-team the decisions with a second model, verify against the real system,
and write down what was learned.**

## 1. The tool stack & roles

The toolchain was integrated directly into VSCode to minimize context switching, running
a **Plan → Execute → Verify** loop with a dedicated verifier model on the side.

- **Claude Code (VSCode plugin)** — primary interface for execution, with direct file
  system and codebase context.
- **Claude Opus (primary driver & architect)** — high-level system design, logistics,
  database schema planning, and complex component architecture.
- **Claude Sonnet (subagent execution)** — delegated scoped, repetitive implementation:
  scaffolding shadcn/ui components, boilerplate Tailwind, pure UI written against
  already-locked signatures.
- **Gemini Pro Preview (verifier & "red team")** — an *independent* verifier. Opus's
  proposed architecture and logic were fed to Gemini specifically to hunt for edge
  cases, database traps, and UX flaws before any of it was committed.

Using a different model family as the verifier matters: it doesn't share Opus's blind
spots, so it catches the confident-but-wrong defaults that a same-model self-review
tends to wave through.

## 2. Plan first, then lock it

Before any code, the whole slice was designed into [PLAN.md](./PLAN.md): product scope
in one line, a locked decisions table (editor, saving model, auth, import, RLS shape),
the full data model and RLS policies, the route/file map, server-action contracts, and
a time-boxed budget. PLAN.md is treated as **immutable spec** — it doesn't change as
work proceeds. This keeps every later AI step anchored to one source of truth instead
of re-litigating decisions mid-build.

A separate living doc, [PROGRESS.md](./PROGRESS.md), tracks what's actually done,
block by block, including bugs found during verification. The split (frozen spec vs.
live status) is what makes the work resumable across sessions.

## 3. Read the framework, don't trust training data

Next.js 16 has breaking changes vs. the model's training cutoff (`middleware` → `proxy`,
async `cookies()`, client-only libs needing `ssr:false`). The first block was spent
reading `node_modules/next/dist/docs/` and capturing the deltas in
[NEXTJS16-CHEATSHEET.md](./NEXTJS16-CHEATSHEET.md). Treating the installed version as
the authority — not the model's memory — avoided a class of subtle, confident mistakes.

## 4. Gemini's catches & AI overrides

LLMs are excellent at boilerplate, but their *default architectural* suggestions often
introduce subtle bugs or overcomplicate scope. By passing Opus's plans through Gemini
and applying hard engineering constraints, the following AI defaults were explicitly
overridden.

### Database & Supabase auth traps

- **Auth-seeding brittleness.** AI often suggests injecting fake users via SQL for
  testing. Gemini flagged that this frequently fails due to Supabase's encrypted
  password hashing and identity linking, potentially locking reviewers out. **Fix:**
  "Confirm Email" was disabled in Supabase and reviewers self-serve dummy accounts in
  the UI.
- **The email-lookup RLS block.** To share a document, User A must look up User B's
  email. Default RLS blocks this, causing silent failures. **Fix:** a public `SELECT`
  policy on the `profiles` table — documented in [ARCHITECTURE.md](./ARCHITECTURE.md)
  as a deliberate speed-vs-privacy tradeoff.
- **The RLS infinite-recursion trap.** AI naturally writes ownership checks by querying
  related tables (`documents` checking `document_shares` and vice-versa), which triggers
  Postgres infinite-recursion errors. **Fix:** a non-recursive `SECURITY DEFINER` helper
  function (`is_document_owner(doc_id)`) used by the RLS checks.
- **UPDATE policy loopholes.** AI often relies solely on a `USING` clause for edit
  access. **Fix:** added `WITH CHECK` on `UPDATE` policies so a user with edit access
  can't maliciously modify protected columns (e.g. `owner_id`).

### Product judgment & UX

- **Editor choice.** AI defaults to `react-md-editor` for text apps, which feels like a
  dev tool and fails the "Google Docs" product prompt. **Fix:** **Tiptap** (starter-kit
  + underline) for true WYSIWYG.
- **File-upload architecture.** AI immediately suggested provisioning S3 / Supabase
  Storage buckets for imports — massive latency, async state, overhead. **Fix:** native
  browser `FileReader` client-side, piping text straight into a Server Action.
- **Autosave vs. manual save.** AI defaults to forms with a "Submit" button. **Fix:** an
  800 ms debounced autosave triggering a Server Action, paired with a seamless
  "Saving… / Saved" indicator.

## 5. Parallelize with subagents against locked signatures

Once the server-action contracts and RLS were fixed, independent UI pieces were built
**in parallel by subagents** while the main agent owned the RLS-critical, ordering-
sensitive code:

- **Main agent (Opus):** `documents.ts` / `shares.ts` actions, the RLS migration, the
  doc page's permission logic — anything where a wrong call is a silent security hole.
- **Subagents (Sonnet):** `share-dialog.tsx`, `import-button.tsx`, the dashboard, the
  toolbar, the unit test — pure UI/logic written against the already-locked signatures.

Because the interfaces were frozen first, the pieces composed without rework.

## 6. Editor & data-loss edge cases

Tiptap inside the Next.js App Router needed strict manual oversight:

- **SSR hydration mismatches.** Tiptap throws hydration errors when rendered
  server-side. It's a `"use client"` component, dynamically imported with `ssr:false`,
  and configured with Tiptap's `immediatelyRender: false`.
- **Markdown → HTML conversion.** Importing `.md` directly into Tiptap renders raw
  syntax (`# Heading`). Imported text is run through `marked.parse(text)` before
  injection.
- **Data-loss prevention.** An 800 ms debounce leaves a window for loss, closed with a
  two-part safety net:
  1. **Tab close** — a `beforeunload` listener
     (`e.preventDefault(); e.returnValue = ''`) catches browser exits.
  2. **In-app navigation** — because `beforeunload` misses Next.js SPA routing, a
     `useEffect` cleanup flushes the pending debounce when the editor unmounts.

## 7. Verify against the real system, not just types

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

## 8. Testing & pipeline strategy

AI tends to suggest heavy E2E suites or massive mocking for Next.js/Supabase, which
would burn 1–2 hours of the budget fighting configuration.

- **Pure unit testing over mocking.** AI suggestions to mock `cookies()` or a Postgres
  instance were ignored. Instead, exactly **one** Vitest test
  ([parse-import.test.ts](../src/lib/parse-import.test.ts)) targets the one genuinely
  pure, security-relevant function — Markdown → HTML and `<script>` stripping. Zero
  mocking, runs instantly, and mathematically proves the business logic works.
- **Sanitization environment crash.** Standard `dompurify` expects a browser `window`
  and crashes Node-based runners like Vitest. Caught early and swapped to
  `isomorphic-dompurify`, giving identical execution in the browser (client-side upload)
  and Node (the test suite).

Async Server Components and full RSC/Server-Action/RLS flows aren't reliably
unit-testable, so they're covered by the live two-account verification above rather than
by brittle mocks. AI is good at generating lots of low-value tests; the discipline here
was to write the *one* test that matters and verify the rest for real.

## 9. Write down what was learned

Every non-obvious gotcha went straight into PROGRESS.md or a memory note so it isn't
rediscovered: the duplicate Tiptap Underline extension, `@tailwindcss/typography` not
resolving under pnpm-strict + Tailwind v4 (worked around with explicit `.ProseMirror`
CSS), delete-then-insert instead of upsert for re-sharing, and the two-step
shares/profiles read. The cost of finding a gotcha is paid once.
