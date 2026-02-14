import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, smoothStream, stepCountIs, streamText } from 'ai'
import { z } from 'zod'
import { db, schema } from 'hub:db'
import { blob } from 'hub:blob'
import { and, eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI.',
    tags: ['ai']
  }
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const { model, messages } = await readValidatedBody(event, z.object({
    model: z.string(),
    messages: z.array(z.custom<UIMessage>())
  }).parse)

  const chat = await db.query.chats.findFirst({
    where: () => and(
      eq(schema.chats.id, id as string),
      eq(schema.chats.userId, session.user?.id || session.id)
    ),
    with: {
      messages: true
    }
  })
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  if (!chat.title) {
    const { text: title } = await generateText({
      model: createModel(),
      system: `You are a title generator for a chat:
          - Generate a short title based on the first user's message
          - The title should be less than 30 characters long
          - The title should be a summary of the user's message
          - Do not use quotes (' or ") or colons (:) or any other punctuation
          - Do not use markdown, just plain text`,
      prompt: JSON.stringify(messages[0])
    })

    await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, id as string))
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user' && messages.length > 1) {
    await db.insert(schema.messages).values({
      chatId: id as string,
      role: 'user',
      parts: lastMessage.parts
    })
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Convert UI messages to model messages, then resolve local blob URLs to base64
      const modelMessages = await convertToModelMessages(messages)
      // Resolve local blob URLs to inline base64 so external AI providers can access them
      for (const msg of modelMessages) {
        if (!('content' in msg) || !Array.isArray(msg.content)) continue
        for (let i = 0; i < msg.content.length; i++) {
          const part = msg.content[i] as any
          const blobPath = typeof part?.data === 'string' && part.data.startsWith('/api/upload/')
            ? part.data.replace('/api/upload/', '')
            : null
          if (blobPath) {
            try {
              const blobData = await blob.get(blobPath)
              if (blobData) {
                const buffer = await blobData.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                msg.content[i] = { type: part.type, mediaType: part.mediaType, data: base64 } as any
              }
            }
            catch {
              // If blob fetch fails, leave as-is
            }
          }
        }
      }

      const result = streamText({
        model: createModelForId(model),
        system: `You are a knowledgeable and helpful AI assistant. ${session.user?.username ? `The user's name is ${session.user.username}.` : ''} Your goal is to provide clear, accurate, and well-structured responses.

**FORMATTING RULES (CRITICAL):**
- ABSOLUTELY NO MARKDOWN HEADINGS: Never use #, ##, ###, ####, #####, or ######
- NO underline-style headings with === or ---
- Use **bold text** for emphasis and section labels instead
- Examples:
  * Instead of "## Usage", write "**Usage:**" or just "Here's how to use it:"
  * Instead of "# Complete Guide", write "**Complete Guide**" or start directly with content
- Start all responses with content, never with a heading

**RESPONSE QUALITY:**
- Be concise yet comprehensive
- Use examples when helpful
- Break down complex topics into digestible parts
- Maintain a friendly, professional tone`,
        messages: modelMessages,
        providerOptions: {
          openai: {
            reasoningEffort: 'low',
            reasoningSummary: 'detailed'
          },
          google: {
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: 2048
            }
          }
        },
        stopWhen: stepCountIs(5),
        experimental_transform: smoothStream({ chunking: 'word' }),
        tools: {
          weather: weatherTool,
          chart: chartTool
        }
      })

      if (!chat.title) {
        writer.write({
          type: 'data-chat-title',
          data: { message: 'Generating title...' },
          transient: true
        })
      }

      writer.merge(result.toUIMessageStream({
        sendReasoning: true
      }))
    },
    onFinish: async ({ messages }) => {
      await db.insert(schema.messages).values(messages.map(message => ({
        chatId: chat.id,
        role: message.role as 'user' | 'assistant',
        parts: message.parts
      })))
    }
  })

  return createUIMessageStreamResponse({
    stream
  })
})
