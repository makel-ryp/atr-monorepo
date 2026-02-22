import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}

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
  ...timestamps
}, table => [
  uniqueIndex('app_agent_users_provider_id_idx').on(table.provider, table.providerId)
])

export const usersRelations = relations(users, ({ many }) => ({
  authMethods: many(authMethods)
}))

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
