# Next.js 16 + Stack Cheat-Sheet

> **Why this file exists:** This repo targets Next.js **16.2.7** / React **19.2.4** / AI SDK **6**.
> These differ from most LLM training data (and pre-16 tutorials). This is a fast, grounded
> reference for the deltas that actually bite during a build — pulled from
> `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and the working scaffold.
> Read this instead of re-deriving the API mid-task.

---

## 0. The five things that will trip you up first

1. **All request APIs are async — synchronous access is fully removed in 16** (it was just a warning in 15).
2. **`middleware` is now `proxy`** (`src/proxy.ts`, function named `proxy`). Runtime is `nodejs`, not `edge`.
3. **Turbopack is the default** for `dev` and `build` — no `--turbopack` flag needed.
4. **`next lint` is gone** — run `eslint` directly (`pnpm lint` already does this).
5. **AI SDK is v6** — use the `streamText` / `UIMessage` pattern in `src/app/api/chat/route.ts`, not older `OpenAIStream`-style code.

---

## 1. Async Request APIs (the #1 gotcha)

In Next.js 16 these can **only** be accessed asynchronously. No sync fallback.

```ts
import { cookies, headers, draftMode } from "next/headers";

const cookieStore = await cookies();   // ✅ must await
const headerList  = await headers();   // ✅ must await
const draft       = await draftMode(); // ✅ must await
```

`params` and `searchParams` are **Promises** in `page`, `layout`, `route`, `default`,
and metadata image files:

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;        // ✅ await params
  const query = await props.searchParams;     // ✅ await searchParams
  return <h1>{slug}</h1>;
}
```

- Generate the `PageProps` / `LayoutProps` / `RouteContext` global type helpers with
  `pnpm next typegen` (or they appear after a `dev`/`build`).
- This is exactly why `src/lib/supabase/server.ts` `createClient()` is **`async`** — it
  awaits `cookies()`. **Always `await createClient()`** in RSCs, Server Actions, Route Handlers.

---

## 2. Reading data — Server Components (the default)

```tsx
// app/items/page.tsx  — no "use client", runs on the server
import { createClient } from "@/lib/supabase/server";

export default async function ItemsPage() {
  const supabase = await createClient();           // ✅ await
  const { data: items } = await supabase.from("items").select();
  return <ul>{items?.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

Rules of thumb (from AGENTS.md):
- **Read in Server Components.** No `useEffect` + fetch unless genuinely interactive.
- Server Components can be `async`. Client Components cannot.
- Never import `@/lib/supabase/server` into a `"use client"` file — use `@/lib/supabase/client`.

---

## 3. Mutating data — Server Actions (`src/actions/`)

```ts
// src/actions/items.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createItem(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "");
  await supabase.from("items").insert({ name });
  revalidatePath("/items");          // re-render the list
}
```

Call it directly from a form — no API route, no client fetch:

```tsx
// Server Component
import { createItem } from "@/actions/items";

export default function NewItem() {
  return (
    <form action={createItem}>
      <input name="name" />
      <button type="submit">Add</button>
    </form>
  );
}
```

For client-side pending state / optimistic UI use `useActionState` / `useFormStatus`
(React 19) or `useTransition`.

---

## 4. Cache / revalidation API changes (16)

| API | Change | Use when |
| --- | --- | --- |
| `revalidateTag(tag, profile)` | **2nd arg now required** (e.g. `"max"`). Single-arg form errors. | Stale-while-revalidate OK (blogs, catalogs). |
| `updateTag(tag)` | **New, Server-Action-only.** Read-your-writes — expires + refreshes in same request. | Forms/settings where user must see their change instantly. |
| `refresh()` | **New.** Refresh the client router from a Server Action. | After a mutation, update a header counter etc. |
| `cacheLife` / `cacheTag` | Stable — drop the `unstable_` prefix. | Fine-grained cache control. |

```ts
import { revalidateTag, updateTag, refresh } from "next/cache";
revalidateTag("posts", "max");   // ✅ note the 2nd arg
```

PPR is gone as a flag; opt into Partial Prerendering via `cacheComponents: true` in
`next.config` (different behavior from 15 — only touch if you actually need it).

---

## 5. AI SDK v6 (Vercel `ai` + `@ai-sdk/anthropic`)

**Canonical working example lives in `src/app/api/chat/route.ts`** — copy from it, don't
recall older AI SDK shapes. Key v5/v6 names:

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

- One-shot generation (no stream): `import { generateText } from "ai"` → `const { text } = await generateText({ model, prompt })`.
- Structured output: `generateObject` / `streamObject` with a Zod schema.
- Client chat UI: `useChat` from `@ai-sdk/react` (point it at the route).
- **Model IDs:** `claude-opus-4-8` (most capable), `claude-sonnet-4-6` (balanced),
  `claude-haiku-4-5-20251001` (fast/cheap — current default in the route).
- Needs `ANTHROPIC_API_KEY` in `.env.local`. Swap provider by swapping the `@ai-sdk/*` import.

---

## 6. Auth / session (Supabase + proxy)

- Session refresh runs in `src/proxy.ts` → `src/lib/supabase/proxy.ts` (`updateSession`).
- **Do not put logic between `createServerClient` and `supabase.auth.getUser()`** in the
  proxy — it breaks cookie refresh.
- Protect a route: in the RSC/action, `const { data: { user } } = await supabase.auth.getUser();`
  then `redirect("/login")` from `next/navigation` if absent.
- The `proxy` `matcher` already excludes static assets — extend it, don't replace it.

---

## 7. Client-only libraries

Anything touching `window`/`document` (e.g. react-md-editor) must be `"use client"` **and**
dynamically imported with `{ ssr: false }`. See `src/components/markdown-editor.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
```

---

## 8. UI: Tailwind v4 + shadcn/ui

- Add primitives: `pnpm dlx shadcn@latest add button card dialog input ...`
- Components land in `src/components/ui`; compose, don't fork them.
- `cn()` (clsx + tailwind-merge) is in `src/lib/utils.ts` — use it for conditional classes.
- Tailwind v4 is CSS-config based (`@import "tailwindcss"` + `@theme`), not `tailwind.config.js`.
- Icons: `lucide-react`.

---

## 9. Removed / renamed — don't reach for these

| Gone in 16 | Use instead |
| --- | --- |
| `next lint` | `eslint` directly (`pnpm lint`) |
| `middleware.ts` / `export function middleware` | `proxy.ts` / `export function proxy` |
| `--turbopack` flag | nothing — it's default |
| sync `cookies()/headers()/params/searchParams` | `await` them |
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, "max")` |
| `serverRuntimeConfig` / `publicRuntimeConfig` | `process.env` (+ `NEXT_PUBLIC_` for client) |
| `images.domains` | `images.remotePatterns` |
| `next/legacy/image` | `next/image` |
| `experimental.dynamicIO` / `experimental.useCache` | top-level `cacheComponents: true` |
| AMP (`next/amp`, `useAmp`, `amp` config) | removed entirely |
| `experimental_ppr` segment config | `cacheComponents: true` |

---

## 10. Commands (pnpm, Node 22)

| Command | Does |
| --- | --- |
| `pnpm dev` | dev server, http://localhost:3000 (outputs to `.next/dev` in 16) |
| `pnpm build` / `pnpm start` | prod build / run |
| `pnpm lint` | eslint |
| `pnpm test` / `pnpm test:run` | vitest watch / single-run (CI) |
| `pnpm format` / `pnpm format:check` | prettier |
| `pnpm next typegen` | regenerate `PageProps`/`LayoutProps`/`RouteContext` helpers |

> **Env note (from project memory):** nvm-windows Node lives at `C:\nvm4w\nodejs` — prefix PATH
> in commands if `node`/`pnpm` aren't found. Watch the pnpm `allowBuilds` approval prompt on installs.

---

## 11. Testing reality

- Vitest + Testing Library covers **client components and pure logic**.
- **Async Server Components and full RSC / Server-Action flows are NOT reliably unit-testable.**
  Don't burn assessment time fighting this — cover those paths with Playwright/E2E or manual
  verification if they matter.
