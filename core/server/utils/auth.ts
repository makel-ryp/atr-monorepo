// SEE: feature "authentication" at core/docs/knowledge/authentication.md
import type { H3Event } from 'h3'

const feat = createFeatureScope('authentication')

export interface AuthContext {
  loggedIn: boolean
  user: AuthUser | null
  role: 'public' | 'registered' | 'admin'
}

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar: string
  username: string
  provider: string
  providerId: string
  role: 'public' | 'registered' | 'admin'
}

export interface DbAdapter {
  findByProvider: (provider: string, providerId: string) => Promise<any | null>
  create: (userData: Record<string, any>) => Promise<any>
  onLogin?: (user: any) => Promise<void>
}

interface OAuthUserData {
  name?: string
  email?: string
  avatar?: string
  username?: string
}

/**
 * Handle OAuth success callback. Two modes:
 * - Session-only (no db): user lives in cookie only
 * - Database-backed (db adapter): lookup-or-create in app's DB
 *
 * Only call from apps that load nuxt-auth-utils as a module.
 * getUserSession/setUserSession are auto-imported by the module.
 */
export async function handleOAuthSuccess(
  event: H3Event,
  provider: string,
  providerId: string,
  userData: OAuthUserData,
  db?: DbAdapter,
  redirectTo = '/'
) {
  feat.log('oauth success', provider)

  let user: AuthUser

  if (db) {
    let dbUser = await db.findByProvider(provider, providerId)

    if (!dbUser) {
      dbUser = await db.create({
        name: userData.name || '',
        email: userData.email || '',
        avatar: userData.avatar || '',
        username: userData.username || '',
        provider,
        providerId
      })
      feat.log('created user', dbUser.id)
    } else {
      if (db.onLogin) {
        await db.onLogin(dbUser)
      }
      feat.log('existing user', dbUser.id)
    }

    user = {
      id: dbUser.id,
      name: dbUser.name || '',
      email: dbUser.email || '',
      avatar: dbUser.avatar || '',
      username: dbUser.username || '',
      provider,
      providerId,
      role: dbUser.role || 'registered'
    }
  } else {
    const session = await getUserSession(event)
    user = {
      id: session.id || crypto.randomUUID(),
      name: userData.name || '',
      email: userData.email || '',
      avatar: userData.avatar || '',
      username: userData.username || '',
      provider,
      providerId,
      role: 'registered'
    }
  }

  await setUserSession(event, { user })

  return sendRedirect(event, redirectTo)
}

/**
 * Get the authenticated user or null.
 * Safe to call in any app — returns null when nuxt-auth-utils is not loaded.
 */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  // Guard: getUserSession is only available when nuxt-auth-utils module is loaded
  if (typeof getUserSession !== 'function') return null
  try {
    const session = await getUserSession(event)
    return (session.user as AuthUser) || null
  } catch {
    return null
  }
}

/**
 * Require authentication. Throws 401 if not logged in.
 */
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return user
}

/**
 * Require a specific role. Throws 401 if not logged in, 403 if wrong role.
 */
export async function requireRole(event: H3Event, role: 'registered' | 'admin'): Promise<AuthUser> {
  const user = await requireAuth(event)

  if (role === 'admin' && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }

  return user
}
