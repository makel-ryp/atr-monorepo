import { db, schema } from 'hub:db'

export default defineEventHandler(async () => {
  return db.select().from(schema.characters).orderBy(schema.characters.createdAt)
})
