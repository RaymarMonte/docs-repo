# PreAjaia

Full-stack web app built with Next.js 16 (App Router), Supabase, Tailwind + shadcn/ui,
the Vercel AI SDK, and Vitest.

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

See [`.env.example`](.env.example). You'll need:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase
  project's API settings.
- `ANTHROPIC_API_KEY` — for the Vercel AI SDK example route (`src/app/api/chat/route.ts`).

## Scripts

- `pnpm dev` — dev server
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` — ESLint
- `pnpm test` / `pnpm test:run` — Vitest (watch / single run)
- `pnpm format` / `pnpm format:check` — Prettier

## Project structure

```
src/
  app/                 # routes, layouts, RSC pages, route handlers (api/chat)
  actions/             # Server Actions (mutations)
  components/
    ui/                # shadcn/ui components
    markdown-editor.tsx
  lib/
    supabase/          # client.ts, server.ts, proxy.ts
    utils.ts           # cn() + shared helpers
  proxy.ts             # session refresh (Next.js 16 "proxy", formerly middleware)
```

## Stack & conventions

See [`AGENTS.md`](AGENTS.md) for the full stack details and the conventions agents
(and humans) should follow — RSC for reads, Server Actions for mutations, Supabase
client usage rules, and the Next.js 16 `proxy` change.

## Deployment

Deploys to [Vercel](https://vercel.com). Set the environment variables above in the
Vercel project settings.
