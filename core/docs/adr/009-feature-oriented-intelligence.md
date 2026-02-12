# ADR-009: Feature-Oriented Intelligence

## Status
**Partially Implemented**

> **Archive notice:** This ADR is retained as historical reference. Operational knowledge is managed via feature knowledge files (`core/docs/knowledge/`) and MCP tools (`explain`, `record`). Remaining work is tracked in [GitHub Issues](https://github.com/app-agent-io/core/issues).

> **Note (Feb 2026):** Core runtime infrastructure implemented: `defineFeature*()` wrappers, `FeatureScope` with `feature()` and `getFeature()`, feature registry with edge tracking, `// SEE:` scanner, MCP tools (explain, record, introspect, census, log-summary, recent-logs). The self-documentation loop and adaptation protocol described below are aspirational. See [GitHub Issues](https://github.com/app-agent-io/core/issues) for remaining work.

## Date
2026-02-11

---

## Context

### The Feature Blindness Problem

Codebases are organized by technical concern: controllers in one directory, services in another, models in a third. A "feature" — rate limiting, authentication, billing — is scattered across multiple files in multiple directories. To understand a feature, a developer must:

1. **Find** which files implement it (no index exists)
2. **Trace** how those files interact (no dependency graph exists)
3. **Locate** the tests that verify it (no traceability matrix exists)
4. **Read** documentation that may be stale (no verification mechanism exists)

AI coding agents face the same problem at scale. They spend the majority of their context window on reconnaissance — grep, read, grep, read — before they can make a single change. The feature knowledge they painstakingly gather is discarded at the end of each session. The next session starts from zero.

This is **feature blindness**: the code is there, the features are there, but the mapping between them is invisible. Every developer and every AI agent must reconstruct it from scratch, every time.

### Prior Art: What Almost Worked

| System | Year | Innovation | Limitation |
|--------|------|-----------|------------|
| FODA / SPLE (Kang) | 1990 | Feature models for product-line variability | Static, design-time only — the model is separate from the code |
| FOP (Batory, Prehofer) | 1992 | Features as composable algebraic modules | Required special compilers and refinement calculus |
| AOP (Kiczales) | 1997 | Cross-cutting concerns as aspects | Required bytecode weaving — couldn't be adopted incrementally |
| Linux Kconfig | 1999 | Features include infrastructure (`CONFIG_SMP`, `CONFIG_PREEMPT`) | Build-time only, no runtime graph, no documentation link |
| OpenTelemetry | 2019 | Instrumentation scopes for observability | Only covers telemetry — no knowledge, no dependencies, no tests |
| Feature Flags (LaunchDarkly, etc.) | 2010s | Feature keys for runtime toggling | Only covers activation — the key has no connection to implementation or docs |
| PEP 350 Codetags | 2005 | Standard annotations (`TODO`, `SEE`, `FIXME`) | Cross-reference only — no runtime semantics, no tooling integration |

Each system captured one dimension of what a feature is. None connected all the dimensions. SPLE had the model but not the code. FOP had the code but required special tools. OTel had the runtime but not the knowledge. Feature flags had the key but not the implementation. Nobody had the complete picture.

### Validation: The ethicaladults.com Prototype

A prior codebase (React, 2026) implemented the core pattern: feature wrappers with nesting and cross-feature access (`getFeature()`), scoped logging, and a single enforcement rule. Results:

- AI agents built features spanning dozens of files with **zero bugs** across multiple complex implementation sessions
- The dependency graph was always accurate because it was **discovered at runtime**, not declared in metadata
- Documentation stayed current because the agent could compare what the code does (introspection) with what the docs say (knowledge files)
- New developers (and new AI sessions) reached full productivity immediately because the feature graph told them exactly where to look

This rebuild extends the prototype with `// SEE:` annotations (binding to PEP 350 for LLM training weight — see ADR-008), layered monorepo support (features spanning core/org/app layers), MCP tool integration, and a self-healing documentation loop.

---

## Decision

### The Core Idea

Every meaningful unit of functionality in a codebase gets a **slug** — a kebab-case identifier like `rate-limiting`, `runtime-config`, or `monorepo-architecture`. That slug becomes the **universal join key** across six dimensions:

| Dimension | Mechanism | Question It Answers |
|-----------|-----------|-------------------|
| **Knowledge** | `knowledge/{slug}.md` | What is this feature? Why does it exist? |
| **Source** | `// SEE: feature "slug" at path` | Where is this feature implemented? |
| **Runtime** | `defineFeature*(slug, fn)` | How does this feature behave? What does it depend on? |
| **Tests** | `// SEE:` in test files | Is this feature verified? |
| **Config** | Feature flags (future) | Can this feature be toggled? |
| **Telemetry** | OTel spans tagged by slug (future) | Is this feature healthy in production? |

No single dimension is the system. The system is the **connection between all of them** through the slug.

### Three-Layer Architecture

#### Layer 1: Static Feature Map — `// SEE:` Annotations

Every file in the codebase that does meaningful work gets at least one annotation:

```typescript
// SEE: feature "rate-limiting" at core/docs/knowledge/rate-limiting.md
import { defineFeatureHandler } from '#imports'
```

This is the **file→feature traceability matrix**. It answers: "which files are part of which features?" The `SEE` codetag is from PEP 350's standard set — LLMs have significant training weight on `// SEE:` cross-references, activating "look this up" semantics before parsing the rest (see ADR-008 for the full rationale).

**Properties:**
- Universal coverage: every `.ts` file belongs to at least one feature. Untagged files are coverage gaps.
- Self-healing: the path after `at` points to the knowledge file. A missing file is a broken reference — a repair work order, not a silent failure.
- Layer disambiguation: `core/docs/knowledge/rate-limiting.md` vs `organization/docs/knowledge/brand-theme.md` — the path makes the owning layer explicit.
- Multi-feature files: a file can have multiple `// SEE:` lines. Infrastructure like `setup-server.ts` references every feature it supports.
- Zero runtime cost: it's a comment.

**Placement convention:** First line(s) of the file, before imports.

#### Layer 2: Runtime Feature Graph — `defineFeature*()` + `getFeature()`

The runtime layer wraps executable code in feature scopes. Every wrapper receives a `FeatureScope` object with three capabilities: **logging**, **nesting**, and **cross-feature access**.

```typescript
export default defineFeatureHandler('rate-limiting', async (feat, event) => {
  feat.log('checking', event.path)

  // Access another feature's scope → records dependency: rate-limiting → runtime-config
  const config = feat.getFeature('runtime-config')
  const settings = config.meta.rateLimitSettings
  config.log('read settings', settings)

  // Nest a sub-feature → records containment: rate-limiting → token-bucket
  feat.feature('token-bucket', (bucket) => {
    bucket.log('checking tokens for', event.path)
    // Sub-feature accesses parent's dependency → records: token-bucket → runtime-config
    bucket.getFeature('runtime-config').log('re-reading threshold')
  })
})
```

**The FeatureScope interface:**

```typescript
interface FeatureScope {
  slug: string
  log: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  meta: Record<string, any>

  // Nest a sub-feature. Records containment: this.slug → childSlug.
  feature: <T>(slug: string, fn: (feat: FeatureScope) => T) => T

  // Access another feature's scope. Records dependency: this.slug → otherSlug.
  getFeature: (slug: string) => FeatureScope
}
```

**Wrapper variants:**
- `defineFeatureHandler(slug, fn)` — Nitro HTTP handlers
- `defineFeaturePlugin(slug, fn)` — Nitro server plugins
- `defineFeatureComposable(slug, fn)` — Vue composables (client-side)

**Dependency discovery:**

Every call to `feat.feature('child', fn)` records a **containment edge**: parent → child.
Every call to `feat.getFeature('other')` records a **dependency edge**: consumer → provider.

These edges form the **runtime feature graph** — a directed graph of how features actually interact. This graph is discovered by execution, not declared in metadata. It cannot be stale because it IS the code's behavior.

#### Layer 3: Knowledge & Introspection — MCP Tools

The knowledge layer stores human-and-AI-readable documentation as markdown files with YAML frontmatter and H2 aspect sections (see ADR-006 for the format). MCP tools provide programmatic access:

| Tool | Purpose |
|------|---------|
| `explain(slug, aspect)` | Read knowledge for a feature |
| `record(slug, aspect, content)` | Write knowledge during work sessions |
| `introspect(slug)` | Query the runtime feature registry — files, lines, dependencies, behavior |
| `census(options)` | Coverage report — completeness by feature, orphaned files, missing tests |

The `introspect` and `census` tools are the key additions. They query the **feature registry** — a dev-mode-only data structure that accumulates everything the runtime graph discovers.

### The Single Rule

> **You cannot use a feature context that you didn't explicitly define or request.**

This means:
- To log inside a feature, you must be inside a `defineFeature*()` wrapper or have called `getFeature()`.
- To access another feature's scope, you must call `feat.getFeature('other-slug')` — no ambient scopes, no globals, no leaking.
- To nest a sub-feature, you must call `feat.feature('child-slug', fn)`.

What the rule enforces:

1. **Explicit coupling.** Every cross-feature interaction is visible. No hidden dependencies.
2. **Complete dependency graph.** If feature A uses feature B, there's a `getFeature('B')` call to prove it.
3. **Scoped side effects.** Every log, warn, or error is tagged with the feature that produced it AND the feature scope it's operating in.
4. **Reviewable contracts.** A code reviewer can see exactly which features a handler touches by reading its `getFeature()` calls.

What the rule prevents:

1. **Ambient state.** No feature scope floating around in module scope waiting to be grabbed.
2. **Implicit dependencies.** No "I happen to know that middleware X runs before me" — if you need X's output, get its scope.
3. **Scope leakage.** A feature scope returned by `getFeature()` is used inline — not stored in a global, not passed to unrelated code.

### Production vs Development Split

**Production** (`import.meta.dev === false`):
- `createFeatureScope(slug)` returns a minimal scope: slug + console.log/warn/error.
- `feature(slug, fn)` calls `fn` with a new minimal scope. No edge recorded.
- `getFeature(slug)` returns a new minimal scope. No edge recorded.
- No registry. No `knowledge.db` writes. No introspection data.
- Cost: one boolean check per wrapper. Effectively zero overhead.

**Development** (`import.meta.dev === true`):
- `createFeatureScope(slug)` returns a full scope with registry integration.
- `feature(slug, fn)` records a containment edge in the registry, creates a full scope, calls `fn`.
- `getFeature(slug)` records a dependency edge in the registry, returns a full scope.
- All `log`/`warn`/`error` calls write to `logs.db` (tagged by slug) AND the registry.
- The feature registry is held in memory, periodically flushed to `knowledge.db`.
- `introspect` and `census` MCP tools query the registry.

The dev/prod split is already established: the current `createFeatureScope` uses `import.meta.dev` to gate `writeLog` calls. This extends that same pattern to dependency tracking.

### The Self-Documentation Loop

```
1. Developer writes code inside defineFeature*() wrappers
2. Code runs in dev → feature registry captures actual behavior
3. introspect(slug) → returns what the code ACTUALLY does
     - Files and line numbers where the feature is defined
     - All dependencies discovered from getFeature() calls
     - All containment from feature() nesting
     - Log/warn/error call sites and frequencies
4. explain(slug, 'overview') → returns what the docs SAY it does
5. Sub-agent compares introspection vs documentation → finds discrepancies
6. record(slug, 'overview', corrected) → fixes the docs
7. Repeat after any significant change
```

Documentation correctness becomes a **testable property**: does `explain` match `introspect`? A sub-agent can run this check on every feature. Drifted docs are auto-corrected. Documentation that was never written is auto-generated from introspection data — complete with file paths, line numbers, and dependency lists.

This inverts the traditional documentation burden. Instead of "write docs and hope they stay current," the system says: "the code is the source of truth; docs are a human-readable rendering of what introspection reveals."

### Knowledge Frontmatter: Auto-Generated Dependencies

Because the runtime discovers dependencies, the knowledge file frontmatter includes them as a **cache** — useful for static queries when the dev server isn't running, but never the source of truth:

```yaml
---
title: Rate Limiting
description: Token bucket rate limiting for API endpoints
layer: core
status: active
# Auto-generated from feature registry — do not edit manually
depends: [runtime-config, token-bucket]
dependents: [api-security]
last_introspection: 2026-02-11T15:30:00Z
---
```

The `last_introspection` timestamp tells readers how fresh the cached data is.

### Adapting Any Codebase — The Protocol

This system can be applied to any existing codebase:

1. **Scan.** An AI agent walks all source files. It proposes feature groupings based on directory structure, naming patterns, import graphs, and domain analysis.

2. **Approve.** A human reviews the proposed groupings. Adjusts, merges, splits. ("Those three files are all part of `auth-flow`, not separate features.") This is the only step that requires human judgment.

3. **Annotate.** The agent adds `// SEE: feature "slug" at path` to every file, creating the static feature map.

4. **Instrument.** The agent wraps key functions (handlers, plugins, composables, entry points) in `defineFeature*()`, adding `getFeature()` calls where cross-feature interactions exist.

5. **Discover.** The codebase runs in dev mode. The feature registry captures the runtime dependency graph — which features exist, how they interact, what they log.

6. **Document.** `introspect(slug)` generates knowledge for each feature. The agent calls `record(slug, aspect, content)` to create documentation from what the code actually does.

7. **Maintain.** Ongoing: un-annotated files are flagged by `census()`. Drifted docs are detected by comparing `introspect` vs `explain`. Broken `// SEE:` references trigger repair. The system is self-healing through the agents that use it.

Steps 3-7 are fully automatable. The human's role is step 2: confirming that the feature groupings make domain sense. Even step 2 can be iterative — the human can ask the AI to regroup, and the AI adjusts the annotations.

### The Feature Census

The `census` MCP tool reports on the health of the feature system:

```
Feature Census — 2026-02-11
═══════════════════════════

Features: 14 total, 11 active, 2 draft, 1 deprecated

Feature                  Knowledge  Source  Tests  Wrappers  Deps   Score
─────────────────────────────────────────────────────────────────────────
rate-limiting            3/6 ██▓░░░  4 files ✓  2 tests ✓  2 wraps  1 dep  75%
runtime-config           5/6 ████▓░  8 files ✓  3 tests ✓  1 wrap   0 deps 90%
feature-knowledge        2/6 █▓░░░░  6 files ✓  3 tests ✓  3 wraps  2 deps 65%
testing-infrastructure   0/6 ░░░░░░  2 files ✓  0 tests ✗  0 wraps  0 deps 20%
...

Unaffiliated files: 3
  core/server/utils/orphan-helper.ts
  core/app/composables/unused-thing.ts
  core/tests/server/mystery-test.test.ts

Orphaned features (knowledge exists, no code references): 1
  old-auth-system (deprecated — consider removing knowledge file)
```

This makes the completeness of the codebase's self-description a measurable, trackable metric.

---

## Consequences

### Positive

- **AI agents reach full productivity immediately.** No reconnaissance phase. Query the feature graph, get the complete picture, start coding.
- **Dependencies are always accurate.** Discovered at runtime from actual `getFeature()` calls — cannot drift from reality.
- **Documentation is self-correcting.** The introspection→documentation loop detects and fixes drift automatically.
- **Feature coverage is measurable.** The census tool quantifies how much of the codebase is described, tested, and instrumented by feature.
- **Works with any structure.** Features are virtual overlays on conventionally-structured code. No directory reorganization, no special compiler, no framework lock-in.
- **Incremental adoption.** Tag one file, wrap one function — the system degrades gracefully. Partial coverage is useful. 100% coverage is the goal but not a prerequisite.
- **Zero production overhead.** The registry, dependency tracking, and introspection only exist in dev mode. Production code pays one boolean check per wrapper.
- **Cross-layer traceability.** In a layered monorepo, features can span `core/`, `organization/`, and `apps/*`. The `// SEE:` path makes the owning layer explicit.
- **Natural feature flag integration.** The same slug that instruments a feature will toggle it. No naming translation, no mapping table.
- **Self-maintaining through AI agents.** Every agent that follows `AGENTS.md` instructions maintains the system as a side effect of its normal work: fix broken references, tag untagged files, update drifted docs.

### Negative

- **Annotation overhead.** Every file needs a `// SEE:` line. This is mechanical but adds visual noise. Mitigated by the annotation being a useful cross-reference for any reader.
- **Wrapper boilerplate.** `defineFeatureHandler` instead of `defineEventHandler`. One extra argument (`feat`), one extra wrapper. Mitigated by the instrumentation being immediately useful (scoped logging, dependency tracking).
- **Learning curve for `getFeature()`.** Developers must learn the single rule: "only use feature contexts you explicitly requested." This is a new constraint. Mitigated by the rule being simple and the benefits being obvious in practice.
- **Registry memory in dev mode.** The feature registry grows with the number of features and their interactions. Bounded by periodic flush to `knowledge.db` and reset.
- **Knowledge files add to the repo.** Each feature gets a markdown file. In a codebase with 50 features, that's 50 files in `knowledge/`. Mitigated by these files being genuinely useful reference documentation.

### Risks

- **Feature granularity disagreements.** "Is `token-bucket` a feature or just an implementation detail of `rate-limiting`?" There's no universal answer — this requires domain judgment. Mitigate with a guiding principle: if it's worth naming, annotating, and potentially toggling independently, it's a feature.
- **Nesting depth.** Features nesting features nesting features could create an overly deep graph. Mitigate with a soft convention: 2-3 levels of nesting is normal, more suggests the outer feature is too broad and should be decomposed.
- **Registry consistency.** The feature registry reflects what code paths actually executed during a dev session. Code paths not exercised won't appear. Mitigate with test coverage: running tests exercises more paths. The census tool flags features with source annotations but no registry entries.
- **Self-documentation accuracy.** The introspection→documentation loop depends on a sub-agent correctly synthesizing what the code does. LLM-generated summaries can be wrong. Mitigate by making the introspection data (files, lines, dependencies) the primary output, and the narrative summary secondary and human-reviewable.

---

## What's Novel

This system combines ideas from feature-oriented programming (features as first-class entities), software product line engineering (feature models for variability), aspect-oriented programming (cross-cutting concern identification), OpenTelemetry (instrumentation scopes), and PEP 350 (standard codetags). Each has existed for decades.

The novel contributions are:

1. **Runtime dependency discovery.** Neither FOP nor SPLE discovers feature dependencies from execution. They declare them statically. Our system discovers them from actual `getFeature()` calls — the graph IS the runtime behavior.

2. **Self-documenting through introspection.** No prior system compares runtime behavior against documentation and auto-corrects drift. The introspection→documentation loop makes documentation a derived artifact of the code, not a separate maintenance burden.

3. **AI agents as first-class maintainers.** The system is designed for AI navigation: `// SEE:` leverages LLM training weight, MCP tools provide programmatic access, and the `AGENTS.md` instructions make maintenance a side effect of normal AI work.

4. **Zero-tooling adoption.** FOP required compilers. AOP required weavers. This system uses comments and thin wrappers. It works in any language, any framework, any editor. The MCP tools enhance it but aren't required — the annotations and knowledge files work on their own.

5. **Universal applicability.** The adaptation protocol (scan → group → annotate → instrument → discover → document → maintain) can transform any existing codebase. The human's role is confirming feature groupings. Everything else is automatable.

---

## References

- ADR-006: Feature Knowledge — knowledge file format, MCP tools (explain, record), storage model
- ADR-007: Testing Strategy — test directory structure, where test files live
- ADR-008: Naming Decision — why "feature" (not "context"), why `// SEE:` (not `// FEATURE:`)
- Kang, S. et al. (1990). *Feature-Oriented Domain Analysis (FODA) Feasibility Study.* SEI Technical Report.
- Batory, D. & Geraci, B. (1997). *Composition Validation and Subjectivity in GenVoca Generators.* IEEE TSE.
- Kiczales, G. et al. (1997). *Aspect-Oriented Programming.* ECOOP.
- Berger, T. et al. (2013). *A Study of Variability Models and Languages in the Systems Software Domain.* IEEE TSE.
- [PEP 350](https://peps.python.org/pep-0350/) — Codetags (TODO, SEE, FIXME, etc.)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/) — Context, Instrumentation Scope
- [OpenFeature](https://openfeature.dev/) — Feature flag standard
