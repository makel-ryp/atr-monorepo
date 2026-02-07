# App Agent Platform
This is a github repo that is forked from app-agent, a standards-based AI focused "tech company in a box" framework.

## Architecture
- Nuxt 4 layered monorepo: `core/` -> `organization/` -> `apps/*`
- ADRs live in `core/docs/adr/nnn-title.md` — (nnn = 000-999) read them before making architectural changes
- Build-time config: ADR-004 (defu, layers, i18n, cross-cutting concerns)
- Runtime config: ADR-005 (merge-change, $meta.lock, PG NOTIFY, hot-reload)
- AI interfaces: ADR-006 (working on this now)
- Feature flags: ADR-007 (planned)

## Key Constraints
- `runtimeConfig` is startup config, NOT runtime — see ADR-005 for actual runtime config
- Nuxt/Nitro versions are pinned — do NOT accept dependabot upgrades without reviewing `useRuntimeConfig()` mutability contract (see ADR-005 Risks section)
- `$meta` is an existing Nuxt convention — use it for governance namespace
- Nuxt handles secrets via `.public` vs private runtimeConfig — no custom $secret needed

## Rules
- See `.claude/rules/` for behavioral expectations
