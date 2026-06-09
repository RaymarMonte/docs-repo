<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# PreAjaia

A full-stack web application. The product scope is still open — this repo is a
clean, conventional starting point with the stack wired up.

## Tech stack

- **Next.js 16** (App Router) + **React 19** — React Server Components for data
  fetching, Server Actions for mutations. Turbopack is enabled.
- **TypeScript**, path alias `@/*` → `src/*`.
- **Tailwind CSS v4** + **shadcn/ui** (radix primitives, "nova" preset). Components
  live in `src/components/ui`; the `cn()` helper is in `src/lib/utils.ts`.
- **Supabase** (`@supabase/ssr`) — database + auth.
- **@uiw/react-md-editor** — markdown editing (client-only).
- **Vitest** + **Testing Library** — unit/component tests.
- **Deploy:** Vercel.

## Commands

| Command                             | What it does                                 |
| ----------------------------------- | -------------------------------------------- |
| `pnpm dev`                          | Start the dev server (http://localhost:3000) |
| `pnpm build`                        | Production build                             |
| `pnpm start`                        | Run the production build                     |
| `pnpm lint`                         | ESLint                                       |
| `pnpm test`                         | Vitest (watch)                               |
| `pnpm test:run`                     | Vitest (single run, for CI)                  |
| `pnpm format` / `pnpm format:check` | Prettier write / check                       |

> Use **pnpm** (Corepack-managed). Node **22 LTS** (`.nvmrc`).

## Conventions

- **Read data in Server Components**; **mutate via Server Actions** (`src/actions/`)
  or Route Handlers. Avoid client-side fetching unless it's genuinely interactive.
- **Supabase clients** (`src/lib/supabase/`):
  - `server.ts` → `createClient()` is **async** (`await`) — use in RSC, Server
    Actions, Route Handlers.
  - `client.ts` → use in Client Components (`"use client"`).
  - Never import `server.ts` into a Client Component.
- **Next.js 16 renamed `middleware` to `proxy`.** Session refresh lives in
  `src/proxy.ts` (delegates to `src/lib/supabase/proxy.ts`). `cookies()` is async.
- **Client-only libs** (e.g. react-md-editor) must be `"use client"` and dynamically
  imported with `{ ssr: false }` — see `src/components/markdown-editor.tsx`.
- Add UI primitives with `pnpm dlx shadcn@latest add <component>`.
- Secrets go in `.env.local` (gitignored); document new keys in `.env.example`.

## Testing notes

- Vitest covers client components and pure logic. **Async Server Components and full
  RSC / Server-Action flows are not reliably unit-testable** — cover those with an
  end-to-end tool (e.g. Playwright) if needed.
