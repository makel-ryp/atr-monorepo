import { db, schema } from 'hub:db'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const chats = await db.query.chats.findMany({
    where: () => eq(schema.chats.userId, user.id),
    with: {
      character: true,
      messages: {
        orderBy: [desc(schema.messages.createdAt)],
        limit: 1
      }
    },
    orderBy: [desc(schema.chats.updatedAt)]
  })

  return chats.map(chat => ({
    id: chat.id,
    characterId: chat.character.id,
    characterName: chat.character.name,
    characterAvatar: chat.character.avatar,
    lastMessage: chat.messages[0]?.text || '',
    lastMessageAt: chat.messages[0]?.createdAt || chat.createdAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt
  }))
})
