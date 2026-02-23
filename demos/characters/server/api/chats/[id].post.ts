import { db, schema } from 'hub:db'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'
import { streamText, smoothStream, createUIMessageStream, createUIMessageStreamResponse } from 'ai'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const { message } = await readValidatedBody(event, z.object({
    message: z.string().min(1)
  }).parse)

  // Verify user owns this chat
  const chat = await db.query.chats.findFirst({
    where: () => and(
      eq(schema.chats.id, id),
      eq(schema.chats.userId, user.id)
    ),
    with: {
      character: true
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  // Save user message
  await db.insert(schema.messages).values({
    chatId: id,
    role: 'user',
    text: message
  })

  // Load recent message history for context
  const history = await db.select().from(schema.messages)
    .where(eq(schema.messages.chatId, id))
    .orderBy(asc(schema.messages.createdAt))
    .limit(50)

  // Build messages array for AI
  const aiMessages = history.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.text
  }))

  // Update chat timestamp
  await db.update(schema.chats)
    .set({ updatedAt: new Date() })
    .where(eq(schema.chats.id, id))

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: createModel(),
        system: chat.character.instructions,
        messages: aiMessages,
        experimental_transform: smoothStream({ chunking: 'word' })
      })

      writer.merge(result.toUIMessageStream())
    },
    onFinish: async ({ messages }) => {
      // Save assistant messages
      for (const msg of messages) {
        if (msg.role === 'assistant') {
          const text = msg.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || ''
          if (text) {
            await db.insert(schema.messages).values({
              chatId: id,
              role: 'assistant',
              text
            })
          }
        }
      }
    }
  })

  return createUIMessageStreamResponse({ stream })
})
