import { db, schema } from 'hub:db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { characterId } = await readValidatedBody(event, z.object({
    characterId: z.string()
  }).parse)

  // Verify character exists
  const character = await db.query.characters.findFirst({
    where: () => eq(schema.characters.id, characterId)
  })

  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Character not found' })
  }

  // Check for existing chat with this character
  const existingChat = await db.query.chats.findFirst({
    where: () => and(
      eq(schema.chats.userId, user.id),
      eq(schema.chats.characterId, characterId)
    ),
    with: { messages: true }
  })

  if (existingChat) {
    return existingChat
  }

  // Create new chat
  const [chat] = await db.insert(schema.chats).values({
    userId: user.id,
    characterId
  }).returning()

  // Add initial greeting message
  const greeting = `Hey there! I'm ${character.name}. ${character.description} What would you like to talk about?`
  await db.insert(schema.messages).values({
    chatId: chat.id,
    role: 'assistant',
    text: greeting
  })

  // Return chat with messages
  const fullChat = await db.query.chats.findFirst({
    where: () => eq(schema.chats.id, chat.id),
    with: { messages: true, character: true }
  })

  setResponseStatus(event, 201)
  return fullChat
})
