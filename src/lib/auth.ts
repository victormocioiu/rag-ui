// Better Auth server config. Google + GitLab are config blocks, exactly as
// advertised. Tables live in Postgres (its own schema, its own migrations
// via `pnpm dlx @better-auth/cli migrate`). AUTH_DISABLED=1 short-circuits
// everything for local dev before OAuth credentials exist.
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    gitlab: {
      clientId: process.env.GITLAB_CLIENT_ID ?? "",
      clientSecret: process.env.GITLAB_CLIENT_SECRET ?? "",
    },
  },
});
