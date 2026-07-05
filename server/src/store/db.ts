import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** A query runner — the whole surface repositories depend on. */
export interface Executor {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/** The state store: a service-level Executor plus per-user (RLS-scoped) transactions. */
export interface RasaDb extends Executor {
  /** Run `fn` inside a transaction scoped to `userId` — RLS restricts rows to that user. */
  withUser<T>(userId: string, fn: (tx: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATION_SQL = readFileSync(
  fileURLToPath(
    new URL("../../../db/migrations/0001_init.sql", import.meta.url),
  ),
  "utf8",
);

// pglite (test + local dev) only: the default pglite role is a superuser that bypasses
// RLS, so we shim Supabase's auth.uid() to read a GUC and add a non-superuser role that
// withUser() switches into — which makes the production RLS policies actually apply.
const PGLITE_AUTH_SHIM = `
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.user_id', true), '')::uuid $$;
  create role app_user nosuperuser;
`;
const PGLITE_GRANTS = `
  grant usage on schema auth, public to app_user;
  grant select on auth.users to app_user;
  grant select, insert, update, delete on all tables in schema public to app_user;
`;

/** In-process Postgres (pglite) with the schema migrated + RLS enforceable. */
export async function createPgliteDb(): Promise<RasaDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(PGLITE_AUTH_SHIM);
  await pg.exec(MIGRATION_SQL);
  await pg.exec(PGLITE_GRANTS);

  const service: Executor = {
    async query(text, params) {
      const res = await pg.query(text, params as unknown[] | undefined);
      return { rows: res.rows as never[] };
    },
  };

  return {
    query: service.query,
    async withUser(userId, fn) {
      // Supabase manages auth.users in prod; seed it here so FKs resolve in tests.
      await pg.query(
        "insert into auth.users(id) values ($1) on conflict do nothing",
        [userId],
      );
      await pg.exec("begin");
      try {
        await pg.query("set local role app_user");
        await pg.query("select set_config('app.user_id', $1, true)", [userId]);
        const result = await fn(service);
        await pg.exec("commit");
        return result;
      } catch (e) {
        await pg.exec("rollback");
        throw e;
      }
    },
    async close() {
      await pg.close();
    },
  };
}

/**
 * Production Postgres (Supabase) via node-pg. Isolated infra — integration-tested
 * against a real Supabase project, not in this unit suite (the pglite path is tested).
 * withUser impersonates the user so Supabase's auth.uid() (JWT sub) drives RLS.
 */
export function createPostgresDb(connectionString: string): RasaDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let poolPromise: Promise<any> | null = null;
  async function getPool(): Promise<{
    connect: () => Promise<{
      query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
      release: () => void;
    }>;
    query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  }> {
    if (!poolPromise) {
      poolPromise = (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import("pg");
        const Pool = mod.Pool ?? mod.default?.Pool;
        return new Pool({ connectionString });
      })();
    }
    return poolPromise;
  }

  return {
    async query(text, params) {
      const pool = await getPool();
      const res = await pool.query(text, params as unknown[] | undefined);
      return { rows: res.rows as never[] };
    },
    async withUser(userId, fn) {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role authenticated");
        await client.query(
          "select set_config('request.jwt.claim.sub', $1, true)",
          [userId],
        );
        const exec: Executor = {
          async query(text, params) {
            const res = await client.query(
              text,
              params as unknown[] | undefined,
            );
            return { rows: res.rows as never[] };
          },
        };
        const result = await fn(exec);
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      const pool = await getPool();
      await pool.end();
    },
  };
}

/* --- shared row mappers --- */

/** Coerce a DATE/text value to a "YYYY-MM-DD" string. */
export function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Coerce a numeric/int column (pg returns NUMERIC as string) to a number, or undefined. */
export function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  return typeof v === "number" ? v : Number(v);
}
