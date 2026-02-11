# The Naming Problem: "Context" Is Doing Triple Duty

## The Issue

The word **"context"** currently refers to three distinct things in this codebase:

| Thing | Current Name | What It Actually Is |
|-------|-------------|---------------------|
| Knowledge files | `knowledge/{slug}.md` | Documentation **about** a feature |
| Code annotations | `// CONTEXT: slug` | A breadcrumb saying "this code **implements** that feature" |
| Runtime wrapper | `context(slug, fn)` | Instrumentation **of** that feature |

The slug identifies a **feature**. Knowledge describes it. Annotations mark where it lives. The wrapper instruments it. Feature flags (future) would toggle it. All keyed by the same slug.

"Context" is the verb (providing context), but it's being used as the noun (the thing being identified). The thing being identified is a feature.

## Why It Matters

1. **OpenTelemetry collision**: OTel defines "context" as trace propagation plumbing. Our system IS observability tooling. When we emit OTel-compatible traces, we'll have `context` (our feature identifier) inside `Context` (OTel's propagation object).

2. **Feature flag confusion**: Feature flags will eventually scope by these same slugs. Every feature flag SDK in existence uses "feature" as its noun (`hasFeature`, `isEnabled(featureName)`). If the slug IS the feature flag key, calling the system "context" creates a split-brain.

3. **Framework collision**: React Context, Go's `context.Context`, LaunchDarkly's "evaluation context" — the word is the most overloaded term in software.

## Current Embedding

- 25 `// CONTEXT:` annotations across production code
- 6 `defineContextHandler` uses in middleware
- 3 `defineContextPlugin` uses in startup plugins
- 1 `defineContextComposable` definition (infrastructure-ready)
- 83-line `context.ts` server utility
- `context-db.ts` and `logs-db.ts` support files
- 30+ test cases referencing "context"
- 599-line ADR-006 titled "Context Oracle"
- 14 lines in AGENTS.md

## The Resolution

See **ADR-008** (`core/docs/adr/008-naming-context-vs-feature.md`) for full analysis.

**Decision: Option D** — "Feature" is the noun. Each domain uses its own verb.

| Action | Before | After |
|--------|--------|-------|
| Annotate | `// CONTEXT: rate-limiting` | `// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md` |
| Instrument | `defineContextHandler(slug, fn)` | `defineFeatureHandler(slug, fn)` |
| Log | `ctx.log(msg)` | `feat.log(msg)` |
| Document | `knowledge/{slug}.md` | `knowledge/{slug}.md` (unchanged) |
| Explain | `explain(slug, aspect)` | `explain(slug, aspect)` (unchanged) |

The annotation uses `// SEE:` (PEP 350 cross-reference codetag) — an established token with heavy LLM training weight — instead of inventing a novel `// FEATURE:` codetag. `SEE` means "look this up." It's self-documenting and works for any AI agent without knowing our conventions.
