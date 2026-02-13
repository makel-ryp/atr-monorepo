// SEE: feature "authentication" at core/docs/knowledge/authentication.md
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}

export const appAgentUsers = sqliteTable('app_agent_users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  avatar: text('avatar').notNull().default(''),
  username: text('username').notNull().default(''),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  role: text('role', { enum: ['registered', 'admin'] }).notNull().default('registered'),
  ...timestamps
}, table => [
  uniqueIndex('app_agent_users_provider_id_idx').on(table.provider, table.providerId)
])
