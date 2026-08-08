# CLAUDE.md — rag-ui

The platform's face: Next.js app-router, Better Auth (Google + GitLab),
Tailwind. Talks ONLY to rag-api/rag-ingest through server routes — the
browser never sees tenant headers, internal URLs, or keys.

## Design decisions

- **Server routes are the only door**: /api/chat (SSE passthrough),
  /api/upload (sandbox only — the playground is read-only by
  construction: the route refuses it).
- **Tenant mapping**: signed-in user -> `u-<sha256(user.id)[:12]>`
  sandbox tenant, ensured via rag-api /internal/tenants on first use.
  RLS does the real isolation, server-side, always. Playground = the
  `erb-v1` tenant (512K-doc benchmark corpus).
- **AUTH_DISABLED=1** short-circuits Better Auth for local dev before
  OAuth credentials exist. Auth tables live in Postgres via
  `pnpm dlx @better-auth/cli migrate` (own tables, not rag-api's).
- The UI's validation (picker accept-list, 8 MB, docs count) is the
  polite layer; rag-api's persist endpoint enforces token-page quotas
  for real (413/409 surface as in-chat REJECTED messages).
- Chat requires a session in BOTH modes; playground retrieves from the
  shared erb-v1 corpus but bills the signed-in user's own daily budget
  (x-billing-tenant-slug). Over budget, answers degrade to the free
  model and the turn label says so.
- Chat history is per-tab localStorage (hrag.turns.v2, last 60 turns,
  pinned to the sending tab); cross-device history is future
  server-side work. The sandbox nudge retires permanently on first
  click (hrag.nudge.done).

## State

| | |
|---|---|
| implemented | live at hrag.app — OAuth (Google/GitHub) with /app callback, per-tab chat histories, upload validation + quota UX, usage meters (pages-used / tokens-left), free-model turn labels, sign-out, one-time sandbox nudge, first-party analytics (track.ts → rag-api), umami tracker proxied same-origin (/u/*, awaiting the edka umami app install), kami landing at /, runs-on-edka credit |
| next | umami rewire once the edka app lands (service URL + website ID), server-side conversation history (part 3) |

## Commands

```bash
pnpm dev                 # local dev against tailnet URLs (.env.local)
pnpm build && pnpm start
pnpm dlx @better-auth/cli migrate   # after DATABASE_URL + creds exist
```

## Deployment

edka GitHub-repo mode (image tag strategy: Commit SHA — floating tags
deploy fossils), port 3000, ui pool, hrag.app attached via edka Domains
(Envoy Gateway edka-public). Envs all in edka's panel: RAG_API_URL,
RAG_INGEST_URL, DATABASE_URL, BETTER_AUTH_URL=https://hrag.app,
BETTER_AUTH_SECRET, GOOGLE_/GITHUB_ client ids+secrets, AUTH_DISABLED=0.
NEXT_PUBLIC_* umami vars are build-baked; defaults target /u + the
registered website id, so no env needed until the instance moves.
