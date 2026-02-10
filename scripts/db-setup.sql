-- ADR-005: Runtime Configuration Service — Database Schema (Extensible Layer Model)
-- Run this in your Supabase SQL Editor or via scripts/db-setup.ts

-- Drop existing ethicaladults.com tables (cleanup)
DROP TABLE IF EXISTS public.llm_calls CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.settings_audit CASCADE;
DROP TABLE IF EXISTS public.settings_users CASCADE;
DROP TABLE IF EXISTS public.settings_blob CASCADE;
DROP TABLE IF EXISTS public.knowledge_embeddings CASCADE;

-- Drop new tables if re-running
DROP TABLE IF EXISTS public.config_history CASCADE;
DROP TABLE IF EXISTS public.config_layers CASCADE;

-- ============================================================
-- config_layers: One row per (app, environment, layer, key) tuple
-- No CHECK constraint on layer_name — freeform for extensibility
-- ============================================================
CREATE TABLE public.config_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  layer_name TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  config_data JSONB NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, environment, layer_name, layer_key)
);

CREATE INDEX idx_config_layers_app_env ON public.config_layers (app_id, environment);
CREATE INDEX idx_config_layers_name ON public.config_layers (layer_name);

-- ============================================================
-- config_history: Immutable audit trail for all config changes
-- ============================================================
CREATE TABLE public.config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  layer_name TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'rollback')),
  config_before JSONB,
  config_after JSONB,
  config_diff JSONB,
  changed_by TEXT NOT NULL DEFAULT 'system',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason TEXT,
  rollback_of UUID REFERENCES public.config_history(id)
);

CREATE INDEX idx_config_history_layer ON public.config_history (app_id, environment, layer_name, layer_key);
CREATE INDEX idx_config_history_changed_at ON public.config_history (changed_at DESC);

-- ============================================================
-- Row Level Security (allow service_role full access)
-- ============================================================
ALTER TABLE public.config_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to config_layers"
  ON public.config_layers FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to config_history"
  ON public.config_history FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- Enable Supabase Realtime on config_layers
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.config_layers;

-- ============================================================
-- Seed: core defaults (app_id='*', environment='*')
-- ============================================================
INSERT INTO public.config_layers (app_id, environment, layer_name, layer_key, config_data, created_by, updated_by)
VALUES (
  '*',
  '*',
  'core',
  'default',
  '{
    "$meta": {
      "mergeOrder": ["core", "core:org", "core:app", "user"],
      "lock": ["$meta.mergeOrder"]
    },
    "logging": {
      "level": "info"
    },
    "ui": {
      "theme": "light",
      "density": "comfortable"
    }
  }'::jsonb,
  'db-setup',
  'db-setup'
)
ON CONFLICT (app_id, environment, layer_name, layer_key) DO UPDATE
SET config_data = EXCLUDED.config_data,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

-- Seed: core:org defaults
INSERT INTO public.config_layers (app_id, environment, layer_name, layer_key, config_data, created_by, updated_by)
VALUES (
  '*',
  '*',
  'core:org',
  'default',
  '{
    "org": {
      "name": "App Agent",
      "tagline": "AI-native application framework"
    }
  }'::jsonb,
  'db-setup',
  'db-setup'
)
ON CONFLICT (app_id, environment, layer_name, layer_key) DO UPDATE
SET config_data = EXCLUDED.config_data,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
