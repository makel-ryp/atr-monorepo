# Inventory Dashboard Port — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Summary

Port the Rypstick Golf Inventory Dashboard from Python/Streamlit to a Nuxt 4 app within the monorepo at `apps/inventory/`. The Python data pipeline is retained and co-located inside the app, switching from Google Sheets to a shared SQLite database. The Nuxt frontend replaces Streamlit, using the existing organization layer for styling and components.

---

## Architecture

### Approach

- **Python pipeline** stays Python. Logic is preserved as-is except: Google Sheets writes replaced with SQLite writes, Prophet forecasting replaced with WMA-only.
- **Nuxt app** provides the dashboard UI and API layer. Reads from SQLite via Drizzle/NuxtHub.
- **Shared database** — Python writes to `.data/hub/db.sqlite` using Python's `sqlite3` stdlib. Nuxt reads the same file via Drizzle ORM.
- **Pipeline triggering** — Nuxt server route spawns Python as a child process. Nitro scheduled task fires daily at 7am. Manual trigger available from Admin page.

### Directory Structure

```
apps/inventory/
├── nuxt.config.ts
├── package.json
├── .env.example
├── app/
│   ├── app.vue
│   ├── layouts/
│   │   └── default.vue
│   └── pages/
│       ├── index.vue           # Dashboard
│       ├── forecast.vue        # Forecast
│       ├── order-planner.vue   # Order Planner
│       ├── stock-pipeline.vue  # Stock Pipeline
│       ├── ai-advisor.vue      # AI Advisor
│       ├── admin.vue           # Admin
│       ├── run-history.vue     # Run History
│       ├── po-history.vue      # PO History
│       └── edi-orders.vue      # EDI Orders
├── server/
│   ├── api/
│   │   ├── inventory.get.ts
│   │   ├── rolling-windows.get.ts
│   │   ├── forecast.get.ts
│   │   ├── stock-pipeline.get.ts
│   │   ├── stock-pipeline.post.ts
│   │   ├── stock-pipeline.put.ts
│   │   ├── sku-params.get.ts
│   │   ├── sku-params.put.ts
│   │   ├── run-log.get.ts
│   │   ├── daily-briefs.get.ts
│   │   ├── po-history.get.ts
│   │   ├── edi-orders.get.ts
│   │   ├── pipeline/
│   │   │   ├── run.post.ts     # Spawns Python pipeline
│   │   │   └── status.get.ts  # Polls run_log for latest status
│   │   └── ai/
│   │       ├── chat.post.ts    # Streaming Claude advisor
│   │       └── narrative.post.ts # Generate daily brief
│   ├── database/
│   │   └── schema.ts           # Drizzle table definitions
│   ├── middleware/
│   │   └── auth.ts             # Protect all routes except /login
│   └── tasks/
│       └── pipeline.ts         # Nitro scheduled task (daily 7am)
└── pipeline/                   # Python scripts (co-located)
    ├── run_pipeline.py
    ├── shopify_pull.py
    ├── amazon_pull.py
    ├── sps_pull.py
    ├── inventory_calc.py
    ├── forecast.py             # WMA only (Prophet removed)
    ├── rolling_windows.py
    ├── sku_allowlist.py
    ├── sku_params.py
    ├── sku_mapping.csv
    ├── retailer_sku_map.csv
    ├── db_writer.py            # NEW: replaces sheets_setup.py + bigquery_writer.py
    ├── email_report.py
    ├── slack_alert.py
    ├── notify_failure.py
    ├── anomaly_detector.py
    ├── narrative_generator.py
    ├── advisor_context.py
    ├── utils.py                # Stripped of gspread, kept shared helpers
    ├── sps_inbox/
    └── requirements.txt
```

---

## Database Schema

All tables in `.data/hub/db.sqlite`. Python writes via `sqlite3` stdlib. Nuxt reads via Drizzle ORM.

| Table | Written by | Readable/Writable from UI |
|-------|-----------|--------------------------|
| `inventory_master` | Pipeline (full replace per run) | Read only |
| `rolling_windows` | Pipeline (full replace per run) | Read only |
| `forecast_history` | Pipeline (full replace per run) | Read only |
| `stock_pipeline` | Pipeline + UI | Read + Write |
| `sku_params` | Pipeline seed + UI | Read + Write |
| `run_log` | Pipeline | Read only |
| `daily_briefs` | AI narrative route | Read only |
| `po_history` | Pipeline (upsert on po_number+sku) | Read only |
| `edi_orders` | Pipeline (upsert on po_number+sku) | Read only |

### Key schema decisions

- `inventory_master` is replaced wholesale on each run — no upsert needed, single pipeline source
- `run_log` has a `status` column (`running` / `success` / `failed`) for Admin page polling
- `stock_pipeline` and `sku_params` are the only two tables with UI write routes
- SPS Commerce files continue to be dropped into `pipeline/sps_inbox/` for manual ingestion

---

## Python Pipeline Changes

The pipeline logic is preserved. Only the I/O layer changes:

1. **Remove**: all `gspread` / Google Sheets code (`utils.py`, `sheets_setup.py`, `bigquery_writer.py`, `data.py`)
2. **Add**: `db_writer.py` — SQLite writer replacing the Sheets writer. Uses Python `sqlite3` to write to `../.data/hub/db.sqlite` (resolved relative to `pipeline/`, one level up to `apps/inventory/.data/hub/db.sqlite`)
3. **Modify**: `run_pipeline.py` — imports `db_writer` instead of `sheets_setup` / gspread utils
4. **Modify**: `forecast.py` — remove Prophet entirely, WMA is already implemented as fallback
5. **Remove**: `compat.py` — was a NumPy 2.x shim for Prophet; no longer needed without Prophet

All other Python files (`shopify_pull.py`, `amazon_pull.py`, `sps_pull.py`, `inventory_calc.py`, `rolling_windows.py`, `anomaly_detector.py`, `narrative_generator.py`, `advisor_context.py`, `email_report.py`, `slack_alert.py`, `notify_failure.py`, `sku_allowlist.py`, `sku_params.py`) are copied with minimal or no changes.

---

## Authentication

- `nuxt-auth-utils` session-based auth (cookie, no user table)
- Single `APP_PASSWORD` env var
- Server middleware at `server/middleware/auth.ts` — redirects to `/login` if no session
- Login page at `/login` — password form, sets session on success
- Logout clears session, redirects to `/login`

---

## AI Features

### AI Advisor (`POST /api/ai/chat`)
- Builds system prompt from live SQLite data (port of `advisor_context.py`)
- Streams `claude-sonnet-4-6` responses via Anthropic SDK
- Vue page uses `EventSource` / streaming fetch
- Suggested questions shown when conversation is empty
- Reorder alert panel shown when critical/warning SKUs exist

### Narrative Generation
- `narrative_generator.py` continues to call Anthropic SDK directly (Python) and writes result to `daily_briefs` table via `db_writer.py`
- `run_pipeline.py` calls `narrative_generator.py` as the final step after a successful run
- Admin page "Generate narrative" button calls `POST /api/pipeline/run-narrative` which spawns `python pipeline/narrative_generator.py` as a child process
- No duplicate TypeScript implementation needed — same Python script handles both scheduled and manual triggers
- Displayed in Dashboard page "Today's brief" section

---

## Frontend

- Extends `../../organization` layer (same as all demos)
- `@nuxt/ui` for all UI components
- `@unovis/vue` for forecast charts
- `useAsyncData` / `useFetch` per page for data loading
- No global state management library

### Page-by-page summary

| Page | Key UI elements |
|------|----------------|
| Dashboard | 4 metric cards, today's brief, color-coded inventory table, pipeline summary |
| Forecast | SKU selector, unovis line chart (actuals + WMA forecast + bounds) |
| Order Planner | Filter controls, editable table (Override Qty + Notes), CSV/TSV export, family summary |
| Stock Pipeline | Table of incoming shipments, add/edit/deactivate entries |
| AI Advisor | Reorder alert panel, suggested questions, streaming chat interface |
| Admin | SKU params editor, Run Pipeline button with live status, narrative trigger |
| Run History | Run log table, records chart |
| PO History | Lead time analytics table, variance chart |
| EDI Orders | B2B order table with filters |

### Color coding (inventory status)
- `critical` → red background
- `warning` → yellow background
- `overstock` → blue background
- `exempt` → gray background
- `ok` → default

---

## Environment Variables

```env
# Auth
APP_PASSWORD=

# AI
ANTHROPIC_API_KEY=

# Shopify
SHOPIFY_SHOP_NAME=
SHOPIFY_ACCESS_TOKEN=

# Amazon SP-API
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
SP_AWS_ACCESS_KEY=
SP_AWS_SECRET=
SP_AWS_ROLE_ARN=
SP_MARKETPLACE_ID=ATVPDKIKX0DER

# Email alerts (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
ALERT_EMAIL_TO=

# Slack alerts (optional)
SLACK_WEBHOOK_URL=
```

---

## Nuxt Config

```typescript
export default defineNuxtConfig({
  extends: ['../../organization'],
  modules: ['@nuxt/ui', '@nuxthub/core', '@vueuse/nuxt', 'nuxt-auth-utils'],
  hub: { db: 'sqlite' },
  nitro: { preset: 'bun', experimental: { tasks: true } },
  runtimeConfig: {
    anthropicApiKey: '',
    shopifyShopName: '',
    shopifyAccessToken: '',
    // ...other private keys
    public: {}
  }
})
```

---

## Out of Scope

- BigQuery integration (removed)
- Google Sheets integration (removed)
- Prophet forecasting (replaced with WMA)
- GitHub Actions scheduling (replaced with Nitro scheduled task)
- Multi-user auth (single password gate is sufficient)
- Supabase/Postgres migration (future work when scaling as an entity)
