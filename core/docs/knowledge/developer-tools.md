---
title: Developer Tools
description: Embedded AI assistant infrastructure for introspection, multi-model consultation, and personal knowledge base.
---

## Overview

Embedded infrastructure giving AI assistants deep access to introspection, multi-model consultation, and a personal knowledge base with vector embeddings.

Key capabilities:

- Live logs, config, health, features, database inspection
- Multi-LLM council for architectural decisions
- RAG over preferences, decisions, and notes
- JMESPath filtering on all results

Disabled in production by default.

## Details

> **Status**: Implemented
> **Created**: 2026-01-27
> **Last Updated**: 2026-01-27
> **Purpose**: Comprehensive embedded tooling for AI-assisted development

---

### Overview

The `dev` MCP tool provides embedded infrastructure that gives the AI assistant (Claude) deep access to:

1. **Introspection** - Live logs, config, health, features, database, connections
2. **Multi-model consultation** - Query multiple LLMs for architectural decisions (Karpathy-style council)
3. **Personal knowledge base** - RAG over preferences, decisions, notes with vector embeddings
4. **JMESPath filtering** - Query and filter all results to reduce response size

This is **not** an external service. It lives in the codebase, has full access to internals, and is disabled in production by default.

---

### Quick Reference

#### Actions

| Action | Description | Example |
|--------|-------------|---------|
| `status` | Quick overview (compact, fast) | `dev({ action: 'status' })` |
| `logs` | Tail/search server logs | `dev({ action: 'logs', query: 'error' })` |
| `config` | Runtime configuration | `dev({ action: 'config', options: { path: 'ai.agents' } })` |
| `health` | Service health checks | `dev({ action: 'health' })` |
| `features` | Feature registry state | `dev({ action: 'features' })` |
| `db` | Database state/queries | `dev({ action: 'db', options: { stats: true } })` |
| `connections` | Active sessions | `dev({ action: 'connections' })` |
| `consult` | Multi-model LLM council | `dev({ action: 'consult', query: 'Redis vs Memcached?' })` |
| `recall` | RAG search knowledge base | `dev({ action: 'recall', query: 'auth patterns' })` |
| `remember` | Store to knowledge base | `dev({ action: 'remember', query: 'content...', options: { collection: 'decisions' } })` |
| `preferences` | Get/set coding preferences | `dev({ action: 'preferences', query: 'early returns' })` |
| `decisions` | Access decision journal | `dev({ action: 'decisions', query: 'supabase' })` |
| `collections` | List memory collections | `dev({ action: 'collections' })` |
| `restart` | Trigger server restart | `dev({ action: 'restart' })` |

#### JMESPath Filtering

All actions support the `jmespath` option to filter/transform results:

```typescript
// Get just the summary from features
dev({ action: 'features', options: { jmespath: 'summary' } })

// Get database status only
dev({ action: 'health', options: { jmespath: 'services.database.status' } })

// Filter to error logs only
dev({ action: 'logs', options: { jmespath: 'logs[?contains(@, `ERROR`)]' } })
```

---

### Introspection Actions

#### status - Quick Overview

Returns a compact summary of system state in a single call.

```typescript
dev({ action: 'status' })

// Returns:
{
  status: 'healthy',
  uptime: '2h 34m',
  memory: '124MB',
  database: { connected: true, latencyMs: 3 },
  features: { enabled: 17, total: 18 },
  logs: { buffered: 45, maxSize: 500 },
  mcp: { activeSessions: 1 }
}
```

#### logs - Server Logs

Tail and search the in-memory log buffer.

```typescript
interface LogsOptions {
  lines?: number;      // Number of lines (default 100)
  level?: 'debug' | 'info' | 'warn' | 'error';
  since?: string;      // Time filter: '5m', '1h', '2d'
  component?: string;  // Filter by logger component
  clear?: boolean;     // Clear the buffer instead of reading
}

// Search for errors in last 10 minutes
dev({ action: 'logs', query: 'error', options: { since: '10m', level: 'error' } })

// Clear the log buffer
dev({ action: 'logs', options: { clear: true } })
```

**Log Buffer Details:**

- Max size: 500 entries (oldest removed when full)
- Message length limit: 500 chars (truncated)
- Captures: api, auth, tool, mcp, error, startup, shutdown events
- Filters out: verbose settings dumps, large JSON objects

#### config - Runtime Configuration

Access current configuration with optional secret redaction.

```typescript
interface ConfigOptions {
  path?: string;           // Dot-notation path to specific value
  includeSecrets?: boolean; // Include sensitive values (requires flag)
  includeEnv?: boolean;     // Include environment variables
}

// Get specific config path
dev({ action: 'config', options: { path: 'ui.branding' } })

// Get all config (secrets redacted)
dev({ action: 'config' })
```

#### health - Service Health

Comprehensive health check of all services.

```typescript
dev({ action: 'health' })

// Returns:
{
  status: 'healthy',
  uptime: '2h 34m',
  uptimeSeconds: 9240,
  memory: {
    used: '124MB',
    heap: '89MB',
    heapUsed: '67MB',
    external: '12MB',
    rss: '156MB'
  },
  services: {
    database: { status: 'healthy', latency: 3 },
    supabase: { status: 'healthy' },
    openrouter: { status: 'healthy' }
  }
}
```

#### features - Feature Registry

View all feature flags and their current state.

```typescript
dev({ action: 'features' })

// Returns:
{
  summary: { total: 18, enabled: 17, disabled: 1 },
  features: {
    'dev-tools': {
      enabled: true,
      status: 'active',
      name: 'Developer Tools',
      description: '...',
      publicConfig: { ... }
    },
    // ...
  }
}
```

#### db - Database State

Query database state and run read-only SQL.

```typescript
interface DbOptions {
  query?: string;   // Raw SQL (SELECT only)
  table?: string;   // Describe table schema
  stats?: boolean;  // Table statistics
}

// Get table statistics
dev({ action: 'db', options: { stats: true } })

// Describe a table
dev({ action: 'db', options: { table: 'settings_blob' } })

// Run a query (read-only)
dev({ action: 'db', options: { query: 'SELECT COUNT(*) FROM transactions' } })
```

**Known Tables:** settings\_blob, settings\_audit, transactions, llm\_calls, settings\_users, knowledge\_embeddings

#### connections - Active Connections

View MCP sessions and database connection status.

```typescript
dev({ action: 'connections' })

// Returns:
{
  currentRequest: {
    authenticated: true,
    userId: '...',
    userLogin: '...'
  },
  mcp: {
    activeSessions: 2,
    sessions: [...]
  },
  database: {
    provider: 'Supabase Cloud',
    status: 'connected',
    latencyMs: 3
  }
}
```

---

### Consultation Actions

#### consult - Multi-Model LLM Council

Query multiple LLMs and synthesize their responses (Karpathy-style).

```typescript
interface ConsultOptions {
  mode?: 'quick' | 'standard' | 'full';  // Default: 'standard'
  models?: string[];      // Override council models
  chairman?: string;      // Override synthesis model
  roles?: boolean;        // Use specialized roles
  preserveDissent?: boolean;  // Include disagreements
  chairmanSystemPrompt?: string;  // Custom system prompt
  chairmanUserPrompt?: string;    // Custom user prompt
}

// Standard consultation
dev({
  action: 'consult',
  query: 'Should we use Redis or Memcached for session storage?',
  options: { mode: 'standard' }
})
```

#### Consultation Modes

| Mode | Models | Use Case |
|------|--------|----------|
| `quick` | 1 model | Quick sanity checks |
| `standard` | 3 models + chairman | Architectural decisions |
| `full` | 5 models + peer review + chairman | Critical decisions |

#### Default Council Models

Configured in feature flag `dev-tools`:

- `openai/gpt-4o-mini`
- `google/gemini-2.0-flash-thinking-exp:free`
- `meta-llama/llama-3.3-70b-instruct`

Chairman: `openai/gpt-4o-mini`

---

### Memory Actions

#### recall - RAG Search

Search the knowledge base using vector similarity.

```typescript
interface RecallOptions {
  collections?: string[];  // Filter by collection
  project?: string;        // Filter by project
  limit?: number;          // Max results (default 10)
}

// Search for authentication patterns
dev({
  action: 'recall',
  query: 'authentication patterns',
  options: { collections: ['decisions', 'preferences'] }
})
```

#### remember - Store Knowledge

Store information to the knowledge base with embeddings.

```typescript
interface RememberOptions {
  collection: string;     // Required: which collection
  project?: string;       // Optional: project scope
  tags?: string[];        // Optional: searchable tags
  importance?: 'low' | 'medium' | 'high';
}

// Store a decision
dev({
  action: 'remember',
  query: 'Chose Supabase for auth because of built-in RLS and realtime subscriptions.',
  options: { collection: 'decisions', importance: 'high' }
})

// Store a preference
dev({
  action: 'remember',
  query: 'User prefers early returns over nested conditionals.',
  options: { collection: 'preferences' }
})
```

#### collections - List Collections

View what's stored in the knowledge base without searching.

```typescript
dev({ action: 'collections' })

// Returns:
{
  tableExists: true,
  collections: [
    { name: 'sessions', count: 12, description: 'Auto-saved conversation summaries', lastUpdated: '...' },
    { name: 'decisions', count: 5, description: 'Explicit architectural decisions', lastUpdated: '...' },
    { name: 'preferences', count: 8, description: 'Personal coding style and patterns', lastUpdated: '...' },
    { name: 'projects', count: 0, description: 'Project metadata and pitch decks' },
    { name: 'notes', count: 3, description: 'General notes and observations', lastUpdated: '...' },
    { name: 'communications', count: 0, description: 'Teams and email content (future)' }
  ],
  total: 28
}
```

#### preferences - Coding Preferences

Shorthand for preference-related operations.

```typescript
// Get preferences matching query
dev({ action: 'preferences', query: 'code style' })
```

#### decisions - Decision Journal

Shorthand for decision-related operations.

```typescript
// Search decisions
dev({ action: 'decisions', query: 'database choice' })
```

---

### Server Control

#### restart - Safe Restart

Trigger a server restart via file watcher (no process killing).

```typescript
dev({ action: 'restart' })

// Returns:
{
  success: true,
  message: 'Server restart triggered via file watcher',
  note: 'Server will reload in 1-3 seconds.'
}
```

---

### File Structure

```
tools/dev/
├── index.ts                 # Main entry point, action dispatcher, JMESPath
├── types.ts                 # TypeScript interfaces
├── actions/
│   ├── status.ts            # Quick overview
│   ├── logs.ts              # Log introspection
│   ├── config.ts            # Config access
│   ├── health.ts            # Service health
│   ├── features.ts          # Feature registry
│   ├── db.ts                # Database state
│   ├── connections.ts       # Active connections
│   ├── consult.ts           # Multi-model consultation
│   ├── recall.ts            # RAG search
│   ├── remember.ts          # Store to knowledge base
│   ├── preferences.ts       # Personal preferences
│   ├── decisions.ts         # Decision journal
│   ├── collections.ts       # List collections
│   └── restart.ts           # Server restart
└── lib/
    ├── openrouter.ts        # OpenRouter API client
    ├── embeddings.ts        # Embedding generation
    └── vectordb.ts          # pgvector operations
```

---

### Configuration

#### Feature Flag

Located in `config/features/index.json` under `dev-tools`:

```json
{
  "dev-tools": {
    "enabled": true,
    "config": {
      "public": {
        "forceEnable": false,
        "allowSecretAccess": false,
        "allowUnsafeRuntime": false,
        "councilDefaultMode": "standard",
        "councilModels": [
          "openai/gpt-4o-mini",
          "google/gemini-2.0-flash-thinking-exp:free",
          "meta-llama/llama-3.3-70b-instruct"
        ],
        "councilChairman": "openai/gpt-4o-mini",
        "memoryAutoSaveSessions": true,
        "memoryEmbeddingModel": "text-embedding-3-small",
        "memoryCollections": ["sessions", "decisions", "preferences", "projects", "notes"]
      }
    }
  }
}
```

#### Environment Variables

```bash
# Enable in production (use with caution)
DEV_TOOLS_FORCE_ENABLE=true

# OpenRouter API key (for council + embeddings)
OPENROUTER_API_KEY=sk-or-...
```

---

### Database Schema

```sql
-- Vector store for RAG
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection TEXT NOT NULL,
  project TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

Collections:

- `sessions` - Auto-saved conversation summaries
- `decisions` - Explicit architectural decisions
- `preferences` - Personal coding style patterns
- `projects` - Project metadata, pitch decks
- `notes` - General notes
- `communications` - Teams, email (future)

---

### Security Considerations

#### Production Safety

Dev tools are **disabled in production** by default. To enable:

1. Set `DEV_TOOLS_FORCE_ENABLE=true` in environment
2. Or set `forceEnable: true` in feature config

#### Access Control by Action

| Action | Dev | Staging | Production |
|--------|-----|---------|------------|
| status | Yes | Yes | Yes |
| logs | Yes | Yes | Filtered |
| config | Yes | Yes | No secrets |
| health | Yes | Yes | Yes |
| features | Yes | Yes | Yes |
| db | Yes | Read-only | No |
| connections | Yes | Yes | Limited |
| consult | Yes | Yes | Yes |
| recall/remember | Yes | Yes | Yes |
| collections | Yes | Yes | Yes |
| restart | Yes | No | No |

#### Secret Handling

- Secrets redacted by default in config output
- Explicit `allowSecretAccess` required in config
- Secrets never stored in knowledge base

---

### Usage Examples

#### Quick health check

```typescript
dev({ action: 'status' })
```

#### Debug a failing request

```typescript
// Check recent error logs
dev({ action: 'logs', query: 'error', options: { since: '5m', level: 'error' } })

// Check service health
dev({ action: 'health', options: { jmespath: 'services' } })
```

#### Architectural decision

```typescript
dev({
  action: 'consult',
  query: 'Redis vs Memcached for session storage. We use Node.js with Supabase.',
  options: { mode: 'standard' }
})
```

#### Remember a preference

```typescript
dev({
  action: 'remember',
  query: 'User prefers functional style with arrow functions and early returns.',
  options: { collection: 'preferences', importance: 'high' }
})
```

#### Recall past decisions

```typescript
dev({
  action: 'recall',
  query: 'why Supabase',
  options: { collections: ['decisions'] }
})
```

#### Clear log buffer

```typescript
dev({ action: 'logs', options: { clear: true } })
```

---

### Prior Art & Inspiration

| Project | What we take from it |
|---------|---------------------|
| [Karpathy's LLM Council](https://github.com/karpathy/llm-council) | Multi-model workflow with peer review |
| [Wallaby MCP](https://wallabyjs.com/docs/features/mcp/) | Runtime value inspection pattern |
| [mem0](https://github.com/mem0ai/mem0) | Preference and interaction memory |
| [JMESPath](https://jmespath.org/) | JSON query language for filtering |

---

### Future Enhancements

#### Phase 4: Runtime Inspection

- Observable registry for live value inspection
- Node.js inspector integration (dev only)
- Expression evaluation with safety checks

#### Phase 5: Browser Bridge

- WebSocket server for browser communication
- DOM query access
- React/Vue state inspection

#### Phase 6: External Integrations

- MS Graph OAuth (Teams + Outlook)
- Meeting transcript processing
- Calendar integration

