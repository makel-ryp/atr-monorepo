# ADR-008: Naming — "Context" vs "Feature" as the System's Core Noun

## Status
**Accepted**

> **Archive notice:** This ADR is retained as historical reference. Operational knowledge is managed via feature knowledge files (`core/docs/knowledge/`) and MCP tools (`explain`, `record`). Remaining work is tracked in [GitHub Issues](https://github.com/app-agent-io/core/issues).

## Date
2026-02-11

---

## The Problem

ADR-006 introduced the Context Oracle — a system where every meaningful concept in the codebase gets a slug, and that slug connects documentation, code annotations, runtime instrumentation, scoped logging, and (eventually) feature flags.

The word "context" was chosen as the umbrella term. It now refers to three distinct things:

| Surface | Current Name | Purpose |
|---------|-------------|---------|
| Knowledge files | `knowledge/{slug}.md` | Documents a concept |
| Code annotations | `// CONTEXT: slug` | Marks code that implements a concept |
| Runtime wrapper | `defineContextHandler(slug, fn)` | Instruments code at runtime |

The slug identifies **what** something is. The annotation says **where** it lives. The wrapper says **how** it runs. But all three are called "context."

This matters because:

1. "Context" is the most overloaded word in software (OpenTelemetry context, React context, Go context, evaluation context in feature flag SDKs)
2. The system will eventually emit OTel-compatible telemetry, creating a direct naming collision
3. Feature flags will scope by these same slugs, but every feature flag SDK uses "feature" as its noun
4. Developers reading `defineContextHandler('rate-limiting', fn)` can't tell if this is about providing context, creating a context object, or something else

### How We Got Here

The original proposal (Feb 7) used `// FEATURE: slug`. The counter-argument was that not all slugs are user-facing features — `defu-merge` is a mechanism, `monorepo-architecture` is a structural decision. "Context" was chosen because it felt more universal: "a context slug lets me get more context on some aspect of something, feature or not."

The counter-counter-argument (Feb 10) was that "context" had become confusing — the same word for knowledge, annotations, and instrumentation. The renaming decision was deferred.

---

## Prior Art

### OpenTelemetry: "Context" Means Something Else

OTel defines **Context** as an object carrying trace IDs and span IDs for signal correlation across services. It is pure plumbing — metadata propagation infrastructure. It has nothing to do with knowledge, documentation, or feature identity.

The OTel term closest to our slug concept is **Instrumentation Scope** — "a logical unit within the application code with which the emitted telemetry can be associated." Scopes are identified by name + version. Each span, metric, or log created within a scope is tagged with that scope.

This is remarkably close to what `defineContextHandler('rate-limiting', fn)` does today.

**Implication:** Using "context" for our feature-identification wrapper directly conflicts with the dominant observability standard's definition of the same word.

### Feature Flag SDKs: "Feature" Is the Universal Noun

| System | API | What they call the identifier |
|--------|-----|-------------------------------|
| LaunchDarkly | `variation(flagKey)` | "flag key" |
| Unleash | `isEnabled(featureName)` | "feature name" |
| Flagsmith | `hasFeature(featureId)` | "feature ID" |
| OpenFeature | `getBooleanValue(flagKey)` | "flag key" |

None use "context" for the feature identifier. In LaunchDarkly and OpenFeature, "context" is reserved for **evaluation context** — the user/environment data used to decide flag values, NOT the flag itself.

### Feature-Oriented Programming and Software Product Lines

FOP uses "feature" as its central decomposition axis — a composable transformation that can be composed with other features to build a program. Software product line engineering (SPLE) uses "feature models" to describe the variability space of a product family.

Our system sits closer to SPLE than classic FOP: slugs are selectable, documentable units of functionality — like Kconfig symbols — rather than algebraic refinement compositions. The key insight from both traditions is that **"feature" is the established noun for a composable unit of functionality**, whether user-facing or infrastructure. The term is never confused with "context."

### Aspect-Oriented Programming: "Concern" as Alternative

AOP uses "concern" for cross-cutting behavioral areas and "aspect" for modules encapsulating concerns. `rate-limiting` is a concern in the AOP sense. But "concern" is academic and implies "problem" in everyday English. "Aspect" implies behavior modification specifically.

### Code Annotations: `SEE` Is the Established Cross-Reference

PEP 350's codetag proposal defined `TODO`, `FIXME`, `BUG`, `HACK`, `NOTE`, `SEE`, and others. Neither `CONTEXT` nor `FEATURE` appears as a standard codetag. But `SEE` is defined as a **cross-reference** — "refer to another source for more information."

This is exactly what our annotation does: it points the reader (human or AI) to a knowledge file for deeper understanding. The `SEE` codetag is part of PEP 350's standard set, which means LLMs have significant training weight on it. When an LLM encounters `// SEE:`, it activates cross-reference semantics — "there's something to look up here."

A `// FEATURE: slug` annotation is novel and requires the reader to know our convention. A `// SEE: feature "slug"` annotation leverages existing training data: `SEE` means "look this up," `feature` identifies what kind of thing it is, and the slug tells you which one. This binds to existing weighted tokens rather than inventing new ones.

### Linux Kconfig: "Feature" Includes Infrastructure

The strongest real-world precedent for calling infrastructure things "features" is **Linux Kconfig**. The Linux kernel — arguably the largest codebase LLMs are trained on — uses Kconfig to define configuration symbols that include/exclude code at build time:

- `CONFIG_SMP` (symmetric multiprocessing)
- `CONFIG_PREEMPT` (preemptible kernel)
- `CONFIG_DEBUG_INFO` (debugging symbols)
- `CONFIG_NET` (networking support)

These are universally referred to as "features" in variability and product-line research. Research by Berger et al. and She et al. explicitly maps Linux's Kconfig variability model to **feature models** from software product line engineering.

Linux is NOT an FOP system in the "feature modules with refinement calculus" sense. It uses **feature-based configurability** — Kconfig symbols as selectable units of functionality that materially change kernel behavior and code paths. These are operational and structural, not "user-facing."

This is the precise precedent for our system: slugs like `rate-limiting`, `defu-merge`, and `monorepo-architecture` are features in the Kconfig/product-line sense — selectable, documentable, instrumentable units of functionality that include infrastructure.

### Observability Wrappers: The Verb Question

| System | Wrapper | Creates |
|--------|---------|---------|
| OpenTelemetry | `tracer.startSpan(name)` | A span |
| Sentry | `Sentry.startSpan()` | A span |
| Langfuse | `observe()` | An observation |
| Datadog | `tracer.trace(name)` | A span |

The verbs used are: **trace**, **observe**, **instrument**, **wrap**. Nobody uses `context()` as a wrapper function name. Langfuse's `observe()` is the closest analog to our pattern — wraps a function, captures inputs/outputs/timing/errors, tags everything with a name.

---

## The Candidates

### Option A: Stay with "context"

```typescript
// CONTEXT: rate-limiting
export default defineContextHandler('rate-limiting', async (ctx, event) => {
  ctx.log('checking', event.path)
})
```

**For:**
- Already embedded (25 annotations, 9 handlers/plugins, 30+ tests, 599-line ADR)
- "Giving context" matches the knowledge/documentation purpose
- Chosen deliberately — not an accident

**Against:**
- Collides with OTel, React, Go, and every feature flag SDK's definition of "context"
- `defineContextHandler` reads as "a handler that has context" — ambiguous
- The word is doing triple duty (knowledge, annotation, instrumentation)
- When feature flags arrive, we'll need ANOTHER term or a confusing `context('feature:rate-limiting', fn)` namespace hack

### Option B: Rename to "feature"

```typescript
// FEATURE: rate-limiting
export default defineFeatureHandler('rate-limiting', async (feat, event) => {
  feat.log('checking', event.path)
})
```

**For:**
- FOP, feature flags, and vertical slice architecture all use "feature" for exactly this
- Correctly identifies what the slug represents — a unit of functionality
- `// FEATURE: rate-limiting` reads naturally: "this code is part of the rate-limiting feature"
- Natural unification with future feature flags — no namespace hack needed
- `defineFeatureHandler` is unambiguous
- Every feature flag SDK uses this exact mental model

**Against:**
- "Feature" can imply user-facing — `defu-merge` is infrastructure, not a user-visible feature
- Rename cost: 25 annotations, 9 handler/plugin calls, test files, ADR-006, AGENTS.md
- "Feature" is slightly more loaded — people have preconceptions

### Option C: Use "scope" (OTel-aligned)

```typescript
// SCOPE: rate-limiting
export default defineScopeHandler('rate-limiting', async (scope, event) => {
  scope.log('checking', event.path)
})
```

**For:**
- OTel's "instrumentation scope" is exactly this concept — established terminology
- Clean, short, precise

**Against:**
- Overloaded in JavaScript (variable scope, CSS scope, Vue scoped slots)
- Sentry deliberately abandoned "scope" in their API migration for clarity
- Doesn't evoke knowledge/documentation — reads as pure instrumentation

### Option D: Separate the noun from the system, bind to existing tokens

The slug identifies a **feature**. The system that manages knowledge about features is the **oracle**. The wrapper **instruments** the feature. The annotation uses the established `SEE` codetag to **cross-reference** the feature's knowledge.

```typescript
// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md
export default defineFeatureHandler('rate-limiting', async (feat, event) => {
  feat.log('checking', event.path)
})
```

The annotation leverages `SEE` (PEP 350 cross-reference codetag) — a token with heavy training weight in LLMs. When any AI agent encounters `// SEE:`, it activates "look this up" semantics before even parsing the rest. The format is self-documenting: what kind of thing (`feature`), which one (`"rate-limiting"`), and where to find more (`at path`). This works for any LLM, any MCP tool, any sub-agent — even without our specific toolchain.

Knowledge lives in `knowledge/rate-limiting.md`. The MCP tool is still `explain('rate-limiting', 'overview')`. Feature flags call `isEnabled('rate-limiting')`. Logging is scoped to the feature: `[rate-limiting] checking /api/users`.

This is Option B with two refinements: **the noun is "feature", the verbs are specific to each domain** (explain, instrument, enable, log), and **the annotation binds to existing weighted tokens** (`SEE`) rather than inventing novel ones (`CONTEXT`, `FEATURE`).

---

## Recommendation: Option D — "Feature" as the Noun, `SEE` as the Annotation

The slug identifies a feature. Everything else is a verb that acts on features. The annotation uses an established codetag to bind to existing LLM training weight.

| Action | API | Domain |
|--------|-----|--------|
| Document | `knowledge/rate-limiting.md` | Knowledge base |
| Annotate | `// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md` | Code breadcrumbs |
| Explain | `explain('rate-limiting', 'overview')` | MCP tool |
| Instrument | `defineFeatureHandler('rate-limiting', fn)` | Runtime wrapper |
| Log | `feat.log('checking', path)` | Scoped observability |
| Toggle | `isEnabled('rate-limiting')` | Feature flags (future) |

### Why "feature" over "context"

1. **It's what the slug actually is.** `rate-limiting` is a feature. `auth-flow` is a feature. `defu-merge` is a feature (of the config system). `monorepo-architecture` is a feature (of the project). In software product line engineering, a feature is any selectable unit of functionality — this includes infrastructure. Linux's Kconfig uses `CONFIG_SMP` and `CONFIG_PREEMPT` as features. So does every feature flag platform.

2. **It converges with feature flags.** Feature flags scope by slug. The slug IS the feature key. Calling the wrapper `defineFeatureHandler` means feature flags are a natural extension, not a bolted-on namespace hack.

3. **It avoids the OTel collision.** When we emit traces, "feature" is an attribute on spans — not confused with OTel's `Context` propagation object. `feature: "rate-limiting"` is clean OTel-compatible metadata.

4. **It removes the triple-duty problem.** "Context" was doing three jobs. "Feature" does one job (identify the thing) and lets each domain use its own verb (see, explain, instrument, toggle, log).

5. **Prior art supports it.** Linux Kconfig, LaunchDarkly, Unleash, Flagsmith, OpenFeature, software product line research, and vertical slice architecture all agree: the unit of functionality is called a "feature."

### Why `// SEE:` over `// FEATURE:` for annotations

1. **Training weight.** `SEE` is a PEP 350 codetag. LLMs have been trained on millions of `// SEE:` and `// TODO:` annotations. `// FEATURE:` has no established codetag definition — it's novel, meaning the LLM must learn our convention from our AGENTS.md alone. `// SEE:` activates cross-reference semantics immediately.

2. **Self-documenting.** `// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md` tells any reader — human, Claude, GPT, Copilot, a grep script — exactly what to do and where to go. `// FEATURE: rate-limiting` requires knowing our convention to be actionable.

3. **Works without tooling.** Even without MCP, without our oracle, without any special setup — the path is right there. An LLM in a sub-agent, an MCP tool, or a developer with no onboarding can follow the reference.

4. **Separates the noun from the verb.** `FEATURE:` as a codetag conflates the identity (what is this?) with the action (what should you do?). `SEE:` is the action (look this up). `feature "rate-limiting"` is the identity. Clean separation.

5. **Respects AI as a first-class reader.** Words are tokens, tokens are knowledge lookups. Binding to existing weighted indicators (`SEE`) is more effective than inventing new ones. We should work with the training data, not against it.

### The "not all slugs are features" objection

The original objection was that `defu-merge` isn't a "feature." But in software product line terminology, a feature is any selectable unit of functionality — it doesn't have to be user-facing. Linux Kconfig features include `CONFIG_PREEMPT` (preemptible kernel) and `CONFIG_SMP` (symmetric multiprocessing). LaunchDarkly flags include operational flags like `kill-switch-payments` and `enable-debug-logging`. Infrastructure IS features.

If a slug is worth naming, annotating, documenting, and instrumenting — it's a feature.

### The "context oracle" name

The MCP system can remain "the oracle" or become "the knowledge base." The `explain()` and `record()` tools don't need "context" or "feature" in their names — they operate on slugs. `explain('rate-limiting', 'overview')` works regardless of what we call the system.

ADR-006's title could become: **"Feature Oracle — Replacing Static Documentation with On-Demand Knowledge"** or simply **"The Knowledge Oracle"**.

---

## Migration Cost

The rename is mechanical and bounded:

| Change | Count | Effort |
|--------|-------|--------|
| `// CONTEXT: slug` → `// SEE: feature "slug" at path` | 25 files | Scripted replacement (slug → path derivable) |
| `defineContextHandler` → `defineFeatureHandler` | 6 calls + 1 def | Find/replace + test update |
| `defineContextPlugin` → `defineFeaturePlugin` | 3 calls + 1 def | Find/replace + test update |
| `defineContextComposable` → `defineFeatureComposable` | 1 def | File rename + find/replace |
| `context.ts` → `feature.ts` | 1 file | File rename |
| `context-db.ts` | 1 file | File rename (or keep — it's the oracle's DB) |
| `ctx` → `feat` parameter name | ~10 sites | Find/replace |
| `createContextScope` → `createFeatureScope` | 1 def + tests | Find/replace |
| Test files | 3 files | Update names + assertions |
| ADR-006 | 1 file | Title + key terms (bulk of content is about the oracle design, not the name) |
| AGENTS.md | ~14 lines | Find/replace |
| MEMORY.md | References | Update |

Total: ~50 files touched, all mechanical replacements. No logic changes. No API contract changes. No database schema changes. The `logs.db` schema uses `slug` (not `context`), and `config_layers` uses `layer_name` (not `context`). The rename is purely at the wrapper/annotation layer.

This should be done before ADR-006 graduates from draft status — while the naming is still soft.

---

## Consequences

### If Accepted

- All `// CONTEXT: slug` annotations become `// SEE: feature "slug" at core/docs/knowledge/slug.md`
- All `defineContext*` wrappers become `defineFeature*`
- The `ctx` parameter in wrapper callbacks becomes `feat`
- ADR-006 title and key terms update
- AGENTS.md conventions section updates
- Future feature flags use the same slug namespace with zero naming friction
- OTel integration uses `feature` as a span attribute, no collision with `Context`
- Any AI agent encountering the codebase can follow `// SEE:` references without knowing our conventions

### If Rejected

- "Context" remains the umbrella term
- Feature flags will need a namespace convention (`context('feature:slug', fn)`) to distinguish instrumentation from gating
- OTel integration will require care to avoid confusion between our "context" and OTel's `Context`
- The triple-duty problem persists until addressed differently

### Risks

- **Developers assume "feature" = user-facing**: Mitigate with documentation clarifying that features include infrastructure. The FOP definition is broader than the colloquial one.
- **Churn fatigue**: This is the second naming change (FEATURE → CONTEXT → FEATURE). Mitigate by making this the final decision before ADR-006 graduates from draft. The codebase is young — now is the cheapest time to rename.
