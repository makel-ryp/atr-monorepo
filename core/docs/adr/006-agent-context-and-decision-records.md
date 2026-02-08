# ADR-006: Context Oracle — Replacing Static Documentation with On-Demand Knowledge

## Status
**Draft — Exploratory**

## Date
2026-02-07

> **Meta-note:** This is intentionally the last ADR written in the traditional format. It defines the system that replaces ADRs as the primary knowledge access pattern. The ADR format works for capturing this thinking, so we're using it one final time to design its own successor.

---

## The Problem

### ADRs Don't Serve Anyone Well Enough

ADRs follow the Nygard template: Context → Decision → Consequences. They capture *why* decisions were made, and that's genuinely valuable. But:

- **Humans skim them.** An 870-line ADR (ADR-004) is a wall of text. Developers jump to the section they need, skip the rest. The access pattern is "search and extract," not "read front to back."
- **AI agents choke on them.** Loading all ADRs dumps 1,300+ lines into context. Research shows agent instruction files work best under 150 lines ([empirical study of 2,303 files](https://arxiv.org/html/2511.12884v1)). Our ADRs exceed that by 10x.
- **The ID system is broken.** "Read ADR-001" requires: list the directory, find the matching file, open it. "Read the nuxt-setup doc" is the same number of words but self-describing. Numeric IDs add an indirection layer with zero benefit.
- **Static documents rot.** Nobody re-reads a 400-line ADR to check if paragraph 7 is still accurate. Length creates maintenance blindness.

### The Agent Instruction Zoo Is Noise

The ecosystem's response to "how do we tell AI agents what to do" has been to create per-tool instruction files:

| File | Tool | Problem |
|------|------|---------|
| `AGENTS.md` | Codex, Cursor, Amp, etc. | Static, ≤150 lines, no reasoning |
| `CLAUDE.md` | Claude Code | Static, Claude-specific |
| `.cursorrules` | Cursor | Static, Cursor-specific |
| `.github/copilot-instructions.md` | GitHub Copilot | Static, Copilot-specific |
| `.clinerules/` | Cline | Static, Cline-specific |

All of these are static text files pre-loaded into agent context. They solve the "tell the agent the rules" problem, but:

- They're all imperative ("do this, don't do that") with no reasoning attached
- They compete for context window space with actual code
- They drift from the real state of the codebase
- They require N files for N tools, or a lowest-common-denominator single file
- [Format doesn't matter](https://arxiv.org/abs/2602.05447) (p=0.484 across YAML/Markdown/JSON/TOON) — content relevance and timing matter

### The Real Insight

The problem isn't *format*. It's *access pattern*.

Pre-loading documentation (ADRs, AGENTS.md, rules files) is a push model: shove context into the agent's window before it knows what it needs. What we actually want is a pull model: the agent (or human) asks for context *when they need it*, at *the granularity they need*.

A human doesn't read all the ADRs before starting work. They encounter something, have a question, and look it up. AI agents should work the same way.

---

## The Design: Context Slugs + Context Oracle

### Context Slugs as Universal Identifiers

Every meaningful concept in the codebase gets a **slug** — a short, descriptive, human-readable identifier. Not a numeric ID. Not a file path. A name.

| Today (ADR IDs) | Proposed (Slugs) |
|------------------|------------------|
| ADR-001 | `nuxt-setup` |
| ADR-002 | `monorepo-architecture` |
| ADR-004 | `layer-cascade` |
| ADR-005 | `runtime-config` |
| "the rate limiting thing" | `rate-limiting` |
| "how i18n works across layers" | `i18n-layers` |
| "that config locking feature" | `meta-lock` |

Slugs are:
- **Self-describing** — `layer-cascade` tells you what it's about without a lookup
- **Terse** — short enough to use in conversation, code comments, commit messages
- **Universal** — same slug works in the `explain()` tool, in code annotations, in chat

### Two Forms of Code Annotation

#### 1. `// CONTEXT:` Comments — Static Breadcrumbs

For code that can't be wrapped in a function (config files, templates, .env, .svg, markdown, or inline markers within larger blocks):

```typescript
// CONTEXT: rate-limiting — Token bucket rate limiter inherited from core layer
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (config.rateLimiter?.enabled === false) return  // CONTEXT: rate-limiting — Disable via runtimeConfig flag
  // ...
})
```

```typescript
// CONTEXT: meta-lock — Locked paths cannot be overridden by lower-priority tiers
function mergeWithGovernance(layers) {
  const lockedPaths = new Set()
  // ...
}
```

```vue
<!-- CONTEXT: i18n-layers — Bridge @nuxtjs/i18n locale to Nuxt UI -->
<UApp :locale="uiLocale">
  <NuxtPage />
</UApp>
```

**Why `CONTEXT:` and not `FEATURE:`, `TODO:`, `NOTE:`, etc.:**
- "Context" is the universal concept. A slug might be a feature, a decision, a mechanism, a pattern, or a cautionary tale. "Context" covers all of them.
- For AI agents, "context" is one of the highest-activation tokens in latent space. Encountering `// CONTEXT: slug` doesn't just label — it primes the agent to think "there's more to know here, I should look this up before I touch this."
- It's shorter than `FEATURE` and more precise than `NOTE`.

#### 2. `context()` Runtime Wrapper — Active Instrumentation

For executable code, a `context()` wrapper provides runtime introspection:

```typescript
// Instead of:
export default defineEventHandler(async (event) => {
  console.log('rate limiter checking', event.path)
  // ...
})

// Wrapped:
export default defineContextHandler('rate-limiting', async (ctx, event) => {
  ctx.log('checking', event.path)  // tagged to slug, stored in logs.db
  // ...
})
```

What the runtime wrapper provides:

| Capability | How |
|------------|-----|
| **Auto file/line discovery** | Stack introspection at call time — automatically registers which files and line ranges implement a slug |
| **Contextual logging** | `ctx.log()` routes to `logs.db`, tagged by slug. Debugging `rate-limiting`? Get ONLY rate-limiting logs |
| **Cross-restart persistence** | Logs survive server restarts — `logs.db` persists across HMR and `bun run dev` cycles |
| **Runtime telemetry per slug** | Hit counts, timing, error rates — the `analysis` aspect can reference actual runtime behavior |
| **Scoped log retrieval** | Query last N logs for a specific slug — no more searching through undifferentiated console output |

The `// CONTEXT:` comments are the static breadcrumbs — they work everywhere, any file type, zero runtime cost. The `context()` wrapper is the active instrumentation — it only applies to executable code but provides dramatically richer data.

**Production behavior:** In production, the wrapper is a pass-through — a single boolean check, then straight to the wrapped function. No stack introspection, no logging, no DB writes. The cost is nanoseconds per major functionality boundary (these wrap handlers and plugins, never tight loops — wrapping inside loops is a code review flag).

**The escape hatch:** Context collection can be re-enabled in production via a runtime settings feature flag (ADR-005's control plane). When something goes wrong:

```
1. Operator sees the system is broken
2. Goes to control plane, enables context collection for the affected service
3. Connects an AI agent to the MCP server (with private key auth)
4. Agent introspects live runtime — slug-tagged logs, file/line mappings,
   the full context object for every feature boundary
5. Agent diagnoses, patches, verifies
6. Operator disables context collection
7. Back to pass-through. Total downtime: minutes, not hours.
```

This is dramatically better than a blind rollback. You get AI-assisted live debugging with the same contextual powers as development, activated on demand, with zero steady-state cost.

**Framework-native API:** The wrapper composes with Nitro/Nuxt's existing conventions rather than fighting them:

```typescript
// Server handler
export default defineContextHandler('rate-limiting', async (ctx, event) => { ... })

// Composable
export const useRateLimit = defineContextComposable('rate-limiting', (ctx) => { ... })

// Nitro plugin
export default defineContextPlugin('rate-limiting', async (ctx, nitroApp) => { ... })
```

### The `explain()` MCP Tool — Reading Context

The `/docs` app (which already runs an MCP server per ADR-003) exposes:

```
explain(slug, aspect)
```

**Aspects** control level of detail:

| Aspect | What It Returns | Use Case |
|--------|-----------------|----------|
| `description` | One-liner: what is this? | Quick orientation |
| `overview` | 5–15 line summary: what, why, how | Starting point for any task |
| `faq` | Common questions and gotchas | Avoiding known mistakes |
| `reasoning` | Why this decision was made, alternatives considered | Understanding intent before changing something |
| `details` | Full technical deep-dive | Implementation reference |
| `history` | How this evolved, key moments, in the user's own words | Provenance, "why does this exist in THIS form" |
| `analysis` | On-demand agent-driven analysis of current state | "How does this actually work RIGHT NOW in the code?" |

The first six aspects return pre-written content from the knowledge base (fast, cached, deterministic). `analysis` uses MCP sampling to invoke a sub-agent that reads the actual codebase and synthesizes a fresh answer (see Part: MCP Sampling below).

### The `record()` MCP Tool — Writing Context

```
record(slug, aspect, content, context?)
```

| Parameter | Purpose |
|-----------|---------|
| `slug` | The context slug (existing or new) |
| `aspect` | Which aspect to write/append: `description`, `overview`, `faq`, `reasoning`, `details`, `history` — or `stale` (see Staleness) |
| `content` | The knowledge to record — can be rough, conversational, include user quotes |
| `context?` | Optional: relevant file paths, code snippets, error messages for the sub-agent to incorporate |

**The secretary model:** The main agent stays in flow. It fires off a `record()` call with rough direction and a sub-agent handles the actual writing:

```
Main agent: "Hey, record this — we just learned that mutating runtimeConfig
from a request handler causes race conditions under load. Slug: runtime-config,
aspect: faq. User's exact words were 'this sucks'. File was server/middleware/foo.ts."

Sub-agent: *reads existing faq.md, appends the new gotcha with timestamp and
user quote, updates context.db with the change metadata, done*

Main agent: *never left the coding task*
```

The sub-agent:
- Reads the existing aspect file (if any) and appends/updates
- Preserves the user's raw voice in `history` entries (no sanitizing)
- Includes timestamps, relevant file paths, and code context
- Creates the slug directory if it doesn't exist yet (new knowledge = new slug)
- Updates `context.db` with operational metadata (what changed, when, triggered by what)
- Uses exact slug matching (no fuzzy matching — correctness is a code review concern, not a development-time concern. Don't punish developers in the trenches for unshined boots.)
- Returns immediately — the main agent never waited

---

## The Storage Model: Two Tiers

### Tier 1: Source of Truth (git-tracked, plain text)

```
core/docs/knowledge/
  layer-cascade/
    description.md      ← one-liner
    overview.md         ← 5-15 lines
    faq.md              ← gotchas and common questions
    reasoning.md        ← why this decision, what alternatives
    details.md          ← full technical reference
    history.md          ← evolution, key moments, user quotes
  runtime-config/
    description.md
    overview.md
    ...
```

This is what survives if everything else burns down. It's the seed that can rebuild the operational layer from scratch.

**Properties:**
- Each aspect is a separate file — easy to update one without touching others
- Git-trackable — changes to knowledge are PR-reviewable
- The directory IS the slug — no mapping table, no database, no indirection
- Aspects can be added incrementally — start with `description` and `overview`, fill in others as they accumulate
- Human-readable on GitHub, in PRs, and as a cold-start fallback for agents without MCP
- Merge conflicts are rare (aspects change infrequently) and when they happen, they're in plain text — easy to resolve

### Tier 2: Operational Context (local, .gitignored, rebuildable)

```
/context.db      ← operational knowledge: slug registry, file/line mappings,
                   staleness flags, change history, query history, metadata
/logs.db         ← runtime logs tagged by slug via context.log()
```

Both files live at project root and are `.gitignored`.

**`context.db` contains:**
- Slug registry — all known slugs, their source files, line ranges (from both `// CONTEXT:` scans and `context()` wrapper registration)
- Change metadata — when each aspect was last updated, what triggered it, by whom
- Query history — which slugs were looked up, how often, which aspects (helps identify what knowledge is actually used)
- Staleness flags — when a slug was flagged stale and why
- File/line index — maps slugs to every file and line range that references them (built from `// CONTEXT:` scanning + `context()` stack introspection)

**`logs.db` contains:**
- Runtime logs from `ctx.log()` calls, tagged by slug
- Survives HMR and server restarts
- Queryable: "last 10 logs for `rate-limiting`" returns only rate-limiting output
- Represents the current work, not historical archive — encourages regular cleanup and retros
- Shareable: dropping someone else's `context.db` into your repo gives you their exact context state (knowledge transfer for debugging, pair programming, onboarding)

### The Bootstrap Protocol: Staleness = Delete and Rebuild

`context.db` and `logs.db` are caches, not sources of truth. The rebuild protocol:

```
bun run dev
  ├── context.db exists? → proceed normally
  └── context.db missing? →
        "Please wait while we setup the knowledge context.
         To skip this step, bring your context.db from past work."
        ├── Scan repo for all // CONTEXT: comments
        ├── Read core/docs/knowledge/ for all slug directories and aspect files
        ├── Build slug registry with file/line mappings
        ├── Index all context() wrapper registrations
        └── context.db ready → proceed
```

**This eliminates the staleness problem entirely.** If the knowledge feels stale, delete `context.db`. The rebuild scans the current repo state and reconstructs everything from the source of truth files + code annotations. No staleness detection algorithm needed — the nuclear option IS the recovery mechanism.

For targeted staleness (a single slug, not everything):

```
Agent encounters: // CONTEXT: correctness-as-a-feature - implements /core/patchCorrectness
Agent looks for /core/patchCorrectness → doesn't exist
Agent calls: record("correctness-as-a-feature", "stale", "/core/patchCorrectness folder doesn't exist")

The record() sub-agent:
  1. Flags the slug as stale in context.db
  2. Rescans the repo for all // CONTEXT: correctness-as-a-feature annotations
  3. Checks if the knowledge files still match reality
  4. Updates or marks aspects that reference stale paths
  5. Returns the updated state to the main agent

Main agent: "There's a staleness issue with correctness-as-a-feature. The knowledge
has been rebuilt. [continues or recommends clearing conversation]"
```

---

## MCP Sampling for `analysis` Aspect

### Why MCP Sampling, Not Tool-Specific Sub-Agents

The `analysis` aspect needs an LLM to read current code and synthesize a fresh answer. We could implement this as a Claude Code sub-agent, but:

- **Claude Code sub-agents are proprietary.** If we build an agentic UI (the next step), or a developer uses Cursor, Codex, or any other tool, the analysis feature breaks.
- **MCP sampling is the standard.** Defined by Anthropic in the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling), it lets the MCP server request an LLM completion from the client. The client controls which model, the cost, and the permissions.
- **One implementation, every client.** The MCP server implements `analysis` once. Any MCP client that supports sampling gets it for free.

### Current Reality: Emulation Required

As of February 2026, Claude Code [does not support MCP sampling](https://github.com/anthropics/claude-code/issues/1785). Neither do most MCP clients.

**The emulation pattern:**

```
MCP Server receives: explain("rate-limiting", "analysis")
  ├── Try: sampling/createMessage → client handles LLM call
  │     (client pays, client controls model, client approves)
  │
  └── Catch "not supported":
        Fall back to direct API call → server makes LLM call
        (server needs API key, server pays, same result)
```

When Claude Code (or any client) eventually ships sampling support, the emulation path stops being hit. Zero code changes on the server. The fallback is invisible — clients that support sampling use it natively, clients that don't get the same result through emulation.

### What `analysis` Actually Does

```
explain("rate-limiting", "analysis") →

Sub-agent (via sampling or emulation):
  1. Reads context.db for all files/lines tagged rate-limiting
  2. Reads those actual source files
  3. Reads the existing knowledge aspects (overview, faq, details)
  4. Compares what the knowledge says vs what the code actually does
  5. Synthesizes: "Here's how rate-limiting actually works RIGHT NOW..."
  6. Flags any discrepancies between knowledge and code
```

This is the only aspect that's always fresh. It's also the slowest (LLM call + file reads), which is why it's explicitly separated from the cached aspects.

---

## The `context()` Runtime Wrapper — Deep Dive

### The Key Insight: Logs Are Contextless Without Slugs

`console.log()` outputs undifferentiated text. When debugging, you scroll through hundreds of lines from dozens of subsystems looking for the one relevant message. This is the same problem as pre-loading ADRs — information without targeting.

`ctx.log()` tags every log entry with its slug. Debugging `rate-limiting`? Query `logs.db` for slug = `rate-limiting` and get ONLY those logs, across server restarts, across HMR reloads.

### Developer Workflow

```typescript
// During development, working on rate-limiting:
// Agent or human queries the last 10 rate-limiting logs:

explain("rate-limiting", "analysis")
// Response includes: "Last 10 runtime logs for rate-limiting:
//   [12:04:01] checking /api/users — 147 tokens remaining
//   [12:04:01] checking /api/settings — 146 tokens remaining
//   [12:04:03] BLOCKED /api/users — 0 tokens remaining
//   ..."
```

No grep. No scrolling. No "which log line is this from?" Just slug-targeted signal.

### How File/Line Discovery Works

The `context()` wrapper uses error stack introspection to discover which files and lines are involved:

```typescript
function context(slug: string, fn: Function) {
  // On first call, capture the stack to discover the calling file and line
  const registration = new Error()
  const { file, line } = parseStack(registration.stack)

  // Register this file/line → slug mapping in context.db
  registerContext(slug, file, line)

  // Return the wrapped function
  return (...args) => {
    const ctx = createContextScope(slug)
    return fn(ctx, ...args)
  }
}
```

Every time a `context()` wrapper executes for the first time, it registers itself. Combined with `// CONTEXT:` comment scanning, `context.db` builds a complete map of slug → files/lines without manual maintenance.

### What `ctx` Provides

```typescript
interface ContextScope {
  slug: string
  log: (...args: any[]) => void     // tagged logging → logs.db
  warn: (...args: any[]) => void    // tagged warning → logs.db
  error: (...args: any[]) => void   // tagged error → logs.db
  meta: Record<string, any>         // arbitrary metadata for this invocation
}
```

Minimal surface area. The wrapper should feel invisible — not a framework, just instrumentation.

---

## Code Review and Codebase Health

The context system enables automated code review and health checks:

### Slug-Based Review

When a PR touches files annotated with `// CONTEXT: slug`, the review process can:
1. Identify all slugs touched by the changeset
2. Call `explain(slug, "faq")` for each — surface known gotchas relevant to the change
3. Call `explain(slug, "reasoning")` — ensure the change doesn't violate the original intent
4. Flag if any annotated code was modified without updating the knowledge base

### Codebase Health Scan

A full health check scans every `// CONTEXT:` comment and `context()` registration:

```
bun run context:health
  ├── For each slug:
  │   ├── Does knowledge exist? (core/docs/knowledge/{slug}/)
  │   ├── Does the description match what the code does? (analysis)
  │   ├── Are there code files NOT annotated that should be? (orphan detection)
  │   └── Are there annotations pointing to deleted/moved code? (staleness)
  └── Report: N slugs, M healthy, K stale, J missing knowledge
```

This replaces ad-hoc "did someone update the docs?" reviews with structured, automated knowledge validation.

---

## Agent Instruction Files: One File, One Redirect

### The Convergence

The original design anticipated a zoo of tool-specific instruction files requiring a generation script and template system. That turned out to be unnecessary.

As of early 2026, AGENTS.md has become the cross-tool standard ([60,000+ repos](https://agents.md/), Linux Foundation stewardship). Cursor, Codex, Amp, Roo Code, and others read it natively. The only major holdout is Claude Code, which still requires `CLAUDE.md` ([issue #6235](https://github.com/anthropics/claude-code/issues/6235), 2,400+ upvotes).

Claude Code supports file imports via `@path` syntax. So the entire "agent instruction" problem reduces to:

### Two Committed Files

**`AGENTS.md`** — the source of truth. Contains architecture summary, conventions, build commands, Context Oracle usage. This is the file you maintain.

**`CLAUDE.md`** — one line:

```markdown
@AGENTS.md
```

That's it. Claude Code imports the full AGENTS.md content. Both files are committed to the repo. No generation script, no template file, no agent selection prompt, no `.agent-config.json`.

### What Got Eliminated

| Original Design | Replaced By |
|-----------------|-------------|
| `core/docs/agent-prompt.md` template | AGENTS.md directly |
| `scripts/setup-agent.ts` generator | Not needed |
| `bun run dev` agent selection prompt | Not needed |
| `.agent-config.json` (developer's tool choice) | Not needed |
| Per-tool generated files (.cursorrules, .clinerules, etc.) | AGENTS.md read natively |
| CLAUDE.md .gitignored + generated | CLAUDE.md committed (one line) |

### Claude Code-Specific Behavioral Rules

Claude Code's `.claude/rules/` directory is separate from AGENTS.md. These contain Claude Code-specific behavioral instructions (like `critical-thinking.md`) that don't belong in the cross-tool AGENTS.md. They stay hand-maintained and committed.

---

## Migration from ADRs

### ADR Decomposition

Existing ADRs are decomposed into slug-based knowledge:

| ADR | Becomes Slugs |
|-----|---------------|
| ADR-001 (Nuxt 4 setup) | `nuxt-setup` |
| ADR-002 (Monorepo) | `monorepo-architecture` |
| ADR-003 (DX and docs) | `docs-app`, `mcp-tools` |
| ADR-004 (Layer cascade) | `layer-cascade`, `i18n-layers`, `defu-merge`, `rate-limiting`, `health-checks` |
| ADR-005 (Runtime config) | `runtime-config`, `meta-lock`, `pg-notify`, `settings-api` |

One ADR can produce multiple slugs. Each slug is focused on one concept instead of one ADR mixing 8 concerns across 870 lines.

**Bootstrapping:** Done all at once — walk the `explain()` tool through each ADR and convert. The original ADR files stay in `core/docs/adr/` as historical artifacts. They stop being the primary access path.

### The Multi-Aspect Insight: Re-Explanation as Knowledge Mining

Writing the same knowledge across different aspects isn't redundant — it's generative. The act of explaining `layer-cascade` as a one-liner (`description`), then as a summary (`overview`), then as a FAQ, then as reasoning, forces you to look at the same concept from different angles.

Each angle creates new connections:
- The `description` forces you to identify the single most important thing
- The `faq` forces you to recall what actually tripped people up
- The `reasoning` forces you to reconstruct the decision context
- The `history` captures the emotional and experiential truth that sanitized documentation erases

This is knowledge mining. The format is the process.

---

## Resolved Questions (This Session)

4. **Slug naming governance.** Exact matching only. No fuzzy matching at development time. Slug duplication and naming inconsistencies (e.g., `rate-limiting` vs `rate-limiter`) are caught during code review, not while the developer is working. The code review process scans all `// CONTEXT:` annotations and flags duplicates/near-misses. Don't interrupt flow with polish concerns.

5. **`context()` wrapper in production.** Pass-through by default — single boolean check, then straight to the wrapped function. Zero overhead. Context collection can be re-enabled via runtime settings feature flag (ADR-005 control plane) for live debugging with AI assistance. Never wrap inside tight loops (code review flag). The wrapper goes at major functionality boundaries: handlers, plugins, composables.

6. **DB ownership model.** Single `/context.db` and `/logs.db` per repo clone, not per-developer. Each developer already has their own via their own clone. The DB represents the current work session, not a personal archive. Shareable: drop in a teammate's `context.db` to inherit their context state. CI gets a fresh rebuild each run.

## Open Questions

_(None remaining — all questions from this design session have been resolved.)_

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary knowledge access | `explain(slug, aspect)` MCP tool | Pull > push. On-demand > pre-loaded. |
| Knowledge write-back | `record(slug, aspect, content)` MCP tool | Capture knowledge in flow, secretary sub-agent writes |
| Knowledge identifier | Descriptive slugs (e.g., `layer-cascade`) | Self-describing, no lookup table, works everywhere |
| Code annotations | `// CONTEXT: slug` comments | "Context" is universal, primes AI to look deeper |
| Runtime wrapper | `context(slug, fn)` / `defineContextHandler` | Active instrumentation: auto file/line discovery, contextual logging |
| Aspect model | 7 aspects (description → analysis) | Different angles mine different knowledge |
| Source of truth | `core/docs/knowledge/{slug}/{aspect}.md` | Git-trackable, PR-reviewable, rebuildable seed |
| Operational store | `/context.db` + `/logs.db` (.gitignored) | Rebuildable from source of truth + repo scan. Delete to reset. |
| Staleness recovery | Delete `context.db`, rebuild on next `bun run dev` | Nuclear option IS the recovery mechanism |
| `analysis` engine | MCP sampling with emulation fallback | Works with any MCP client, not Claude Code-specific |
| `record()` execution | Sub-agent via MCP sampling ("secretary") | Main agent never leaves the coding task |
| Slug governance | Exact match at dev time, duplicates caught in code review | Don't interrupt flow with polish — correctness at commit time |
| Production behavior | Pass-through by default, activatable via runtime settings | Zero cost + on-demand god-mode debugging with AI |
| DB ownership | Single per repo clone, not per-developer | Shareable context state, simple model, implicit per-dev via clones |
| Agent instruction source | `AGENTS.md` (committed) | Cross-tool standard, read natively by Cursor/Codex/Amp/Roo Code |
| Claude Code support | `CLAUDE.md` containing `@AGENTS.md` (committed) | One-line redirect, no generation needed |
| Tool-specific files | Not needed | AGENTS.md is the universal standard; only Claude Code needs the redirect |
| ADR fate | Historical artifacts, no longer primary | Decomposed into slug-based knowledge |
| Bootstrapping | All at once — walk tool through each ADR | Greenfield project, do it right from the start |

---

## References

### Research
- [Agent READMEs: An Empirical Study of Context Files for Agentic Coding](https://arxiv.org/html/2511.12884v1) — 2,303 files, 1,925 repos
- [Structured Context Engineering for File-Native Agentic Systems](https://arxiv.org/abs/2602.05447) — 9,649 experiments, format doesn't matter (p=0.484)
- [On the Impact of AGENTS.md Files on Efficiency](https://arxiv.org/html/2601.20404)
- [Martin Fowler: Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)

### MCP Sampling
- [MCP Sampling specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [Claude Code sampling feature request #1785](https://github.com/anthropics/claude-code/issues/1785) — not yet implemented as of Feb 2026
- [Goose blog: MCP Sampling](https://block.github.io/goose/blog/2025/12/04/mcp-sampling/)

### Agent Context Standards
- [AGENTS.md](https://agents.md/) — cross-tool open standard (60,000+ repos)
- [Claude Code CLAUDE.md guide](https://claude.com/blog/using-claude-md-files)
- [Claude Code AGENTS.md feature request](https://github.com/anthropics/claude-code/issues/6235)
- [AGENTS.md vs CLAUDE.md comparison](https://substratia.io/blog/agents-md-vs-claude-md/)

### ADR Background
- [Nygard ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub organization](https://adr.github.io/)
- [Using ADRs with AI coding assistants](https://blog.thestateofme.com/2025/07/10/using-architecture-decision-records-adrs-with-ai-coding-assistants/)

### Related ADRs (Historical)
- [ADR-003: Developer Experience and Documentation](./003-developer-experience-and-documentation.md) — defines the /docs app and MCP server
- [ADR-004: Layer Cascade, i18n, and Cross-Cutting Concerns](./004-layer-cascade-i18n-and-cross-cutting-concerns.md) — will decompose into ~5 slugs
- [ADR-005: Runtime Configuration Service](./005-runtime-configuration-service.md) — will decompose into ~4 slugs
