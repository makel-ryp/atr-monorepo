import { pgTable, text, integer, real, serial } from 'drizzle-orm/pg-core'

// ── inventory_master ────────────────────────────────────────────────────────
export const inventoryMaster = pgTable('inventory_master', {
  sku:                        text('sku').primaryKey(),
  product_title:              text('product_title'),
  variant_title:              text('variant_title'),
  shopify_stock:              real('shopify_stock'),
  amazon_fba_stock:           real('amazon_fba_stock'),
  current_stock:              real('current_stock'),
  sps_committed_qty:          real('sps_committed_qty'),
  effective_stock:            real('effective_stock'),
  shopify_30d:                integer('shopify_30d'),
  shopify_60d:                integer('shopify_60d'),
  shopify_90d:                integer('shopify_90d'),
  amazon_30d:                 integer('amazon_30d'),
  amazon_60d:                 integer('amazon_60d'),
  amazon_90d:                 integer('amazon_90d'),
  edi_30d:                    integer('edi_30d'),
  edi_60d:                    integer('edi_60d'),
  edi_90d:                    integer('edi_90d'),
  total_30d:                  integer('total_30d'),
  total_60d:                  integer('total_60d'),
  total_90d:                  integer('total_90d'),
  avg_weekly_velocity:        real('avg_weekly_velocity'),
  avg_monthly_velocity:       real('avg_monthly_velocity'),
  days_of_stock:              real('days_of_stock'),
  months_of_stock:            real('months_of_stock'),
  reorder_flag:               text('reorder_flag'),
  reorder_threshold:          integer('reorder_threshold'),
  reorder_qty_9mo:            integer('reorder_qty_9mo'),
  reorder_qty_12mo:           integer('reorder_qty_12mo'),
  forecast_30d:               real('forecast_30d'),
  forecast_60d:               real('forecast_60d'),
  forecast_90d:               real('forecast_90d'),
  forecast_lower_90d:         text('forecast_lower_90d'),
  forecast_upper_90d:         text('forecast_upper_90d'),
  forecast_method:            text('forecast_method'),
  stockout_date:              text('stockout_date'),
  order_by_date:              text('order_by_date'),
  days_until_order_deadline:  integer('days_until_order_deadline'),
  order_status:               text('order_status'),
  velocity_season_adjusted:   real('velocity_season_adjusted'),
  reorder_qty_9mo_adj:        integer('reorder_qty_9mo_adj'),
  reorder_qty_12mo_adj:       integer('reorder_qty_12mo_adj'),
  note:                       text('note'),
  run_date:                   text('run_date'),
})

// ── rolling_windows ─────────────────────────────────────────────────────────
export const rollingWindows = pgTable('rolling_windows', {
  sku:              text('sku').primaryKey(),
  product_title:    text('product_title'),
  total_7d:         integer('total_7d'),
  total_14d:        integer('total_14d'),
  total_30d:        integer('total_30d'),
  total_60d:        integer('total_60d'),
  total_90d:        integer('total_90d'),
  total_180d:       integer('total_180d'),
  shopify_180d:     integer('shopify_180d'),
  amazon_180d:      integer('amazon_180d'),
  edi_180d:         integer('edi_180d'),
  current_ytd:      integer('current_ytd'),
  prior_ytd:        integer('prior_ytd'),
  yoy_change_pct:   real('yoy_change_pct'),
  avg_daily_7d:     real('avg_daily_7d'),
  avg_daily_30d:    real('avg_daily_30d'),
  avg_daily_90d:    real('avg_daily_90d'),
  velocity_trend:   text('velocity_trend'),
  run_date:         text('run_date'),
})

// ── forecast_history ─────────────────────────────────────────────────────────
export const forecastHistory = pgTable('forecast_history', {
  id:               serial('id').primaryKey(),
  sku:              text('sku').notNull(),
  date:             text('date').notNull(),
  actual_units:     real('actual_units'),
  forecast_units:   real('forecast_units'),
  forecast_lower:   real('forecast_lower'),
  forecast_upper:   real('forecast_upper'),
  trend:            real('trend'),
  weekly_seasonal:  real('weekly_seasonal'),
  yearly_seasonal:  real('yearly_seasonal'),
  run_date:         text('run_date'),
})

// ── stock_pipeline ───────────────────────────────────────────────────────────
export const stockPipeline = pgTable('stock_pipeline', {
  id:                         serial('id').primaryKey(),
  sku:                        text('sku').notNull(),
  product_title:              text('product_title'),
  type:                       text('type'),
  qty_to_warehouse:           integer('qty_to_warehouse'),
  qty_to_fba:                 integer('qty_to_fba'),
  total_quantity:             integer('total_quantity'),
  expected_arrival_warehouse: text('expected_arrival_warehouse'),
  expected_arrival_fba:       text('expected_arrival_fba'),
  po_number:                  text('po_number'),
  notes:                      text('notes'),
  active:                     text('active').default('TRUE'),
  arrived_date:               text('arrived_date'),
  created_at:                 text('created_at'),
})

// ── sku_params ───────────────────────────────────────────────────────────────
export const skuParams = pgTable('sku_params', {
  sku:                       text('sku').primaryKey(),
  lead_time_days:            integer('lead_time_days'),
  lead_time_buffer_days:     integer('lead_time_buffer_days'),
  min_stock_months:          real('min_stock_months'),
  max_stock_months:          real('max_stock_months'),
  reorder_trigger_months:    real('reorder_trigger_months'),
  target_stock_months_9mo:   real('target_stock_months_9mo'),
  target_stock_months_12mo:  real('target_stock_months_12mo'),
  moq:                       integer('moq'),
  carton_qty:                integer('carton_qty'),
  half_carton_qty:           integer('half_carton_qty'),
  peak_months:               text('peak_months'),
  off_peak_months:           text('off_peak_months'),
  peak_multiplier:           real('peak_multiplier'),
  reorder_exempt:            integer('reorder_exempt').default(0),
  supplier_name:             text('supplier_name'),
  shipping_method:           text('shipping_method'),
  notes:                     text('notes'),
  updated_at:                text('updated_at'),
})

// ── run_log ──────────────────────────────────────────────────────────────────
export const runLog = pgTable('run_log', {
  id:              serial('id').primaryKey(),
  run_timestamp:   text('run_timestamp').notNull(),
  source:          text('source').notNull(),
  records_pulled:  integer('records_pulled'),
  status:          text('status'),
  notes:           text('notes'),
})

// ── daily_briefs ─────────────────────────────────────────────────────────────
export const dailyBriefs = pgTable('daily_briefs', {
  id:           serial('id').primaryKey(),
  date:         text('date').notNull(),
  narrative:    text('narrative').notNull(),
  brief_type:   text('brief_type').default('daily'),
  generated_at: text('generated_at'),
})

// ── po_history ───────────────────────────────────────────────────────────────
export const poHistory = pgTable('po_history', {
  id:                         serial('id').primaryKey(),
  po_number:                  text('po_number').notNull(),
  sku:                        text('sku').notNull(),
  product_title:              text('product_title'),
  po_date:                    text('po_date'),
  qty_ordered:                integer('qty_ordered'),
  qty_shipped:                integer('qty_shipped'),
  expected_arrival_warehouse: text('expected_arrival_warehouse'),
  actual_arrival_warehouse:   text('actual_arrival_warehouse'),
  lead_time_days:             integer('lead_time_days'),
  variance_days:              integer('variance_days'),
  shipping_method:            text('shipping_method'),
  notes:                      text('notes'),
})

// ── edi_orders ───────────────────────────────────────────────────────────────
export const ediOrders = pgTable('edi_orders', {
  id:            serial('id').primaryKey(),
  po_number:     text('po_number').notNull(),
  sku:           text('sku').notNull(),
  retailer:      text('retailer'),
  product_title: text('product_title'),
  ordered_qty:   integer('ordered_qty'),
  shipped_qty:   integer('shipped_qty'),
  expected_date: text('expected_date'),
  date:          text('date'),
  doc_type:      text('doc_type'),
  status:        text('status'),
})
