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
    settings text,
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

  await db.run(sql`CREATE TABLE IF NOT EXISTS characters (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL REFERENCES app_agent_users(id) ON DELETE CASCADE,
    name text NOT NULL,
    age integer,
    description text DEFAULT '' NOT NULL,
    instructions text DEFAULT '' NOT NULL,
    avatar text DEFAULT '' NOT NULL,
    tags text DEFAULT '[]' NOT NULL,
    profile text DEFAULT '{}' NOT NULL,
    is_new integer DEFAULT 0 NOT NULL,
    is_live integer DEFAULT 0 NOT NULL,
    has_audio integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`)

  await db.run(sql`CREATE INDEX IF NOT EXISTS characters_owner_id_idx ON characters (owner_id)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS chats (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES app_agent_users(id) ON DELETE CASCADE,
    character_id text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`)

  await db.run(sql`CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats (user_id)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS chats_character_id_idx ON chats (character_id)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY NOT NULL,
    chat_id text NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role text NOT NULL,
    text text DEFAULT '' NOT NULL,
    created_at integer NOT NULL
  )`)

  await db.run(sql`CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages (chat_id)`)

  // Add settings column to existing users table (idempotent)
  try {
    await db.run(sql`ALTER TABLE app_agent_users ADD COLUMN settings text`)
  }
  catch {
    // Column already exists — ignore
  }
})
