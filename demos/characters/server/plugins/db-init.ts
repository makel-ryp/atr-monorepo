import { db } from 'hub:db'
import { sql } from 'drizzle-orm'

export default defineNitroPlugin(async () => {
  // Auto-create tables if they don't exist (dev mode bootstrap)
  await db.run(sql`CREATE TABLE IF NOT EXISTS app_agent_users (
    id text PRIMARY KEY NOT NULL,
    email text NOT NULL UNIQUE,
    name text DEFAULT '' NOT NULL,
    avatar text DEFAULT '' NOT NULL,
    username text DEFAULT '' NOT NULL,
    provider text NOT NULL,
    provider_id text NOT NULL,
    password_hash text,
    role text DEFAULT 'registered' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`)

  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS app_agent_users_provider_id_idx ON app_agent_users (provider, provider_id)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS app_agent_auth_methods (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES app_agent_users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_id text NOT NULL,
    provider_email text,
    password_hash text,
    last_used_at integer,
    created_at integer NOT NULL
  )`)

  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS auth_methods_provider_id_idx ON app_agent_auth_methods (provider, provider_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS auth_methods_user_id_idx ON app_agent_auth_methods (user_id)`)
})
