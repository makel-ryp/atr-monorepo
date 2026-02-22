import { db, schema } from 'hub:db'
import { sql } from 'drizzle-orm'

export default defineNitroPlugin(async () => {
  // Backfill auth_methods for existing users who don't have any
  const usersWithoutAuthMethods = await db
    .select({
      id: schema.users.id,
      provider: schema.users.provider,
      providerId: schema.users.providerId,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash
    })
    .from(schema.users)
    .where(
      sql`${schema.users.id} NOT IN (SELECT DISTINCT ${schema.authMethods.userId} FROM ${schema.authMethods})`
    )

  if (usersWithoutAuthMethods.length === 0) return

  console.log(`[seed-auth-methods] Backfilling ${usersWithoutAuthMethods.length} user(s)`)

  for (const user of usersWithoutAuthMethods) {
    await db.insert(schema.authMethods).values({
      userId: user.id,
      provider: user.provider,
      providerId: user.providerId,
      providerEmail: user.email || null,
      passwordHash: user.provider === 'credentials' ? user.passwordHash : null
    })
  }

  console.log(`[seed-auth-methods] Done`)
})
