import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable('app_agent_users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  username: text('username').notNull().default(''),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['registered', 'admin'] }).notNull().default('registered'),
  settings: text('settings'),
  ...timestamps
}, table => [
  uniqueIndex('app_agent_users_provider_id_idx').on(table.provider, table.providerId)
])

export const usersRelations = relations(users, ({ many }) => ({
  authMethods: many(authMethods),
  characters: many(characters),
  chats: many(chats)
}))

// ─── Auth Methods ────────────────────────────────────────────────────────────

export const authMethods = sqliteTable('app_agent_auth_methods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  providerEmail: text('provider_email'),
  passwordHash: text('password_hash'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, table => [
  uniqueIndex('auth_methods_provider_id_idx').on(table.provider, table.providerId),
  index('auth_methods_user_id_idx').on(table.userId)
])

export const authMethodsRelations = relations(authMethods, ({ one }) => ({
  user: one(users, {
    fields: [authMethods.userId],
    references: [users.id]
  })
}))

// ─── Characters ──────────────────────────────────────────────────────────────

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  age: integer('age'),
  description: text('description').notNull().default(''),
  instructions: text('instructions').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  profile: text('profile', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  isNew: integer('is_new', { mode: 'boolean' }).notNull().default(false),
  isLive: integer('is_live', { mode: 'boolean' }).notNull().default(false),
  hasAudio: integer('has_audio', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
}, table => [
  index('characters_owner_id_idx').on(table.ownerId)
])

export const charactersRelations = relations(characters, ({ one, many }) => ({
  owner: one(users, {
    fields: [characters.ownerId],
    references: [users.id]
  }),
  chats: many(chats)
}))

// ─── Chats ───────────────────────────────────────────────────────────────────

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  ...timestamps
}, table => [
  index('chats_user_id_idx').on(table.userId),
  index('chats_character_id_idx').on(table.characterId)
])

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id]
  }),
  character: one(characters, {
    fields: [chats.characterId],
    references: [characters.id]
  }),
  messages: many(messages)
}))

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  text: text('text').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, table => [
  index('messages_chat_id_idx').on(table.chatId)
])

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  })
}))
