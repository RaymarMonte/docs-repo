# PreAjaia — Build Plan (Assessment)

> **For future sessions:** This is the locked execution plan for a timed (~3h core)
> AI-native take-home: build a lightweight Google-Docs-style collaborative editor.
> All major decisions are made. Read this top-to-bottom and you're up to speed.
> The only open gate is the Supabase environment (see end).

## Product in one line
Sign up → create/rename/edit rich-text docs with debounced autosave → import
`.txt`/`.md` files → share docs by email (view/edit), with a clear Owned vs.
Shared-with-me split. Persisted in Supabase with RLS-enforced access.

## Stack (from existing scaffold — do not change)
Next.js 16 App Router · React 19 · TypeScript (`@/*`→`src/*`) · Tailwind v4 +
shadcn/ui · Supabase (`@supabase/ssr`) · Vitest + Testing Library · Deploy: Vercel.
AI SDK is present but unused for this slice.

> ⚠️ Next.js 16 has breaking changes vs. training data: `middleware`→`proxy`,
> `cookies()` is async, client-only libs need `ssr:false`. Read
> `node_modules/next/dist/docs/` before writing framework code. See AGENTS.md.

## New dependencies
`@tiptap/react @tiptap/starter-kit @tiptap/extension-underline marked isomorphic-dompurify`

## Locked decisions
| # | Area | Decision |
|---|---|---|
| 1 | Editor | Tiptap (StarterKit + Underline), WYSIWYG. Toolbar: bold, italic, underline, H1/H2, bullet + numbered list. Content stored as **HTML** in a `TEXT` column. Client component, dynamic import `ssr:false`, `immediatelyRender:false`. |
| 2 | Saving | **Debounced autosave only (~800ms)** → `saveDocument`. No manual Save button. "Saving… / Saved" pill. `beforeunload` guard (tab close/refresh) **+ flush-on-unmount** in `useEffect` cleanup (in-app nav). Rename autosaves too. |
| 3 | Auth | Supabase email+password. **Email confirmation OFF** (Supabase dashboard: Auth → Providers → Email → Confirm email = off). Self-serve signup, **no seeding**. README tells reviewers to make two accounts to test sharing. |
| 4 | Import | FileReader client-side, `.txt`/`.md` only. `parseImportedFile(name, content)`: `.md` → `marked.parse` → sanitize; `.txt` → escape+wrap → sanitize → Tiptap `setContent` → `createDocument`. |
| 5 | Profiles privacy | **Option A** — public `SELECT` on `profiles` (id+email only). Documented as a known tradeoff in the architecture note. |
| 6 | Test | One pure unit test on `parseImportedFile`: (a) `# H` → `<h1>`; (b) `<script>` in a `.txt` is stripped. `isomorphic-dompurify` runs in browser + Vitest jsdom with no config. No Next/Supabase mocking. |
| 7 | Time | ~3h core, **deploy hard-stop 3:00**. Docs + video as a short wrap after. |

## Data model
```sql
profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text not null
)

documents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Untitled',
  content    text not null default '',        -- Tiptap HTML
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

document_shares (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  permission  text not null check (permission in ('view','edit')),
  created_at  timestamptz not null default now(),
  unique (document_id, shared_with)
)
```

## Trigger (populates profiles so share-by-email works)
```sql
create function handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

## RLS (split policies, non-recursive)
Helper to break the `documents`↔`document_shares` recursion cycle:
```sql
create function is_document_owner(doc uuid) returns boolean
  language sql security definer stable as $$
  select exists (select 1 from documents where id = doc and owner_id = auth.uid());
$$;
```

- **profiles** — `SELECT: true` (public, documented tradeoff). No client writes (trigger only).
- **documents**
  - `SELECT` (view): `owner_id = auth.uid() OR id IN (select document_id from document_shares where shared_with = auth.uid())`
  - `INSERT` — `WITH CHECK owner_id = auth.uid()`
  - `UPDATE` (edit) — **`USING` and `WITH CHECK`**: `owner_id = auth.uid() OR id IN (select document_id from document_shares where shared_with = auth.uid() AND permission = 'edit')`
  - `DELETE` — `owner_id = auth.uid()`
- **document_shares** (non-recursive — uses helper, never loops back into `documents`)
  - `SELECT` — `shared_with = auth.uid() OR is_document_owner(document_id)`
  - `INSERT` — `WITH CHECK is_document_owner(document_id)` (only owner shares)
  - `DELETE` — `is_document_owner(document_id)` (owner unshares)

> Viewers read but cannot write because edit lives only in the `UPDATE` policy.
> Never collapse these into one `ALL` policy.

## Routes & files
```
src/app/login/page.tsx           login + signup (confirmation off)
src/app/page.tsx                  dashboard RSC — "Owned" / "Shared with me"
src/app/doc/[id]/page.tsx         RSC: fetch doc, pass to client editor
src/components/editor.tsx          "use client" Tiptap + toolbar + autosave + beforeunload
src/components/share-dialog.tsx    share by email + permission
src/components/import-button.tsx   FileReader → parseImportedFile → createDocument
src/lib/parse-import.ts            parseImportedFile()  ← the tested pure fn
src/actions/documents.ts           create / rename / save / delete / import
src/actions/shares.ts              shareDocument / unshareDocument
src/actions/auth.ts                signUp / signIn / signOut
src/lib/parse-import.test.ts       the one meaningful test
```

Server-action contracts:
- `createDocument(): id` · `renameDocument(id, title)` · `saveDocument(id, html)` · `deleteDocument(id)`
- `shareDocument(docId, email, permission)` — look up `profiles` by email (public read), insert share; clear error if email not found
- `unshareDocument(docId, userId)`
- Auth actions wrap the Supabase server client.

## Time budget (to the block)
| Time | Block |
|---|---|
| 0:00–0:20 | Read Next 16 docs; migration: schema + trigger + RLS + helper + public-read profiles |
| 0:20–0:50 | Auth signup/login page; verify trigger populates `profiles` |
| 0:50–1:40 | Dashboard (Owned/Shared) + Tiptap editor + create/rename/debounced autosave + beforeunload & flush-on-unmount |
| 1:40–2:10 | Share-by-email action + dialog; **verify RLS as a 2nd account** |
| 2:10–2:25 | FileReader import + `parseImportedFile` (marked→sanitize) |
| 2:25–2:40 | `parse-import.test.ts` + validation/error handling |
| 2:40–3:00 | **Deploy** Vercel + Supabase prod; smoke-test live URL |
| wrap | README · architecture note · AI note · SUBMISSION.md (from this plan) · 3-5 min video |

**Discipline:** RLS verified by ~0:20 · vertical slice (login→create→edit→reopen)
working before sharing · deploy at 3:00 regardless of polish.

## Scope cuts (state in README)
Cut: real-time collaboration, comments/suggestions, version history, `.docx` import,
roles beyond view/edit, separate Save button.
"Next 2-4 hours" list: `.docx` via `mammoth`, md-aware live preview, presence
indicators, export to PDF.

## Deliverables (Google Drive folder)
Source · `README.md` (setup + supported file types + "confirm email = off" note +
reviewer signup instructions) · architecture note · AI-workflow note ·
`SUBMISSION.md` · live URL · video-link `.txt` · screenshots/GIF.

## Open gate (resolve before coding)
Does `.env.local` already point at a live Supabase project (URL + anon key +
service-role), or must the project be created first? Everything else is ready to
execute starting at block 0:00 (read Next 16 docs, then write the migration).
