export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    throw createError({ statusCode: 500, statusMessage: 'APP_PASSWORD not configured' })
  }

  if (!body?.password || body.password !== appPassword) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  await setUserSession(event, {
    user: { loggedIn: true }
  })

  return { ok: true }
})
