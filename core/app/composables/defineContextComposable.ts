// CONTEXT: context-oracle — Client-side context wrapper (console.log only, no SQLite)

interface ContextScope {
  slug: string
  log: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  meta: Record<string, any>
}

function createContextScope(slug: string): ContextScope {
  const prefix = `[${slug}]`

  return {
    slug,
    meta: {},
    log: (message, ...data) => console.log(prefix, message, ...data),
    warn: (message, ...data) => console.warn(prefix, message, ...data),
    error: (message, ...data) => console.error(prefix, message, ...data),
  }
}

export function defineContextComposable<
  TArgs extends any[],
  TReturn,
>(
  slug: string,
  composable: (ctx: ContextScope, ...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const ctx = createContextScope(slug)
  return (...args: TArgs) => composable(ctx, ...args)
}
