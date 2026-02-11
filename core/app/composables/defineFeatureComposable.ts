// SEE: feature "feature-knowledge" at core/docs/knowledge/feature-knowledge.md

interface FeatureScope {
  slug: string
  log: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  meta: Record<string, any>
}

function createFeatureScope(slug: string): FeatureScope {
  const prefix = `[${slug}]`

  return {
    slug,
    meta: {},
    log: (message, ...data) => console.log(prefix, message, ...data),
    warn: (message, ...data) => console.warn(prefix, message, ...data),
    error: (message, ...data) => console.error(prefix, message, ...data),
  }
}

export function defineFeatureComposable<
  TArgs extends any[],
  TReturn,
>(
  slug: string,
  composable: (feat: FeatureScope, ...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const feat = createFeatureScope(slug)
  return (...args: TArgs) => composable(feat, ...args)
}
