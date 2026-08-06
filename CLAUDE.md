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
- The UI's 10-doc counter is a courtesy; enforcement belongs to the
  platform (rag-api quotas — pending server-side work).

## State

| | |
|---|---|
| implemented | chat with SSE streaming + [n] citation inspection, playground/sandbox toggle, model picker (allowlist mirror), rerank toggle, upload, Better Auth wiring (inactive until creds) |
| next | OAuth creds (Google + GitLab consoles), auth-tables migration, sign-in UI, server-side quotas, usage display, edka deployment + public domain |

## Commands

```bash
pnpm dev                 # local dev against tailnet URLs (.env.local)
pnpm build && pnpm start
pnpm dlx @better-auth/cli migrate   # after DATABASE_URL + creds exist
```

## Deployment

edka GitHub-repo mode, port 3000, ui pool, public domain attached in
edka; envs per .env.example (in-cluster URLs, AUTH_DISABLED=0).
