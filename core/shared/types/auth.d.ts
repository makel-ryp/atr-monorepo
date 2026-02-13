// SEE: feature "authentication" at core/docs/knowledge/authentication.md
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    avatar: string
    username: string
    provider: string
    providerId: string
    role: 'public' | 'registered' | 'admin'
  }
}

export {}
