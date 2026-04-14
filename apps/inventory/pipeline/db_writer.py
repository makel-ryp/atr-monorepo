"""
db_writer.py
────────────
SQLite writer for the inventory pipeline.
Replaces gspread / Google Sheets writes.

Database path: resolved relative to this file's location.
  pipeline/ -> ../.data/hub/db.sqlite
  = apps/inventory/.data/hub/db.sqlite  (NuxtHub default location)
"""
import json
import os
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / ".data" / "hub" / "db.sqlite"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # safe for concurrent Nuxt reads
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every run."""
    with _connect() as conn:
        # Migrate existing inventory_master tables that predate sps_committed_qty
        try:
            conn.execute("ALTER TABLE inventory_master ADD COLUMN sps_committed_qty REAL DEFAULT 0")
            conn.execute("ALTER TABLE inventory_master ADD COLUMN effective_stock REAL")
        except Exception:
            pass  # columns already exist

        conn.executescript("""
            CREATE TABLE IF NOT EXISTS inventory_master (
                sku TEXT PRIMARY KEY,
                product_title TEXT, variant_title TEXT,
                shopify_stock REAL, amazon_fba_stock REAL, current_stock REAL,
                sps_committed_qty REAL DEFAULT 0, effective_stock REAL,
                shopify_30d INTEGER, shopify_60d INTEGER, shopify_90d INTEGER,
                amazon_30d INTEGER, amazon_60d INTEGER, amazon_90d INTEGER,
                edi_30d INTEGER, edi_60d INTEGER, edi_90d INTEGER,
                total_30d INTEGER, total_60d INTEGER, total_90d INTEGER,
                avg_weekly_velocity REAL, avg_monthly_velocity REAL,
                days_of_stock REAL, months_of_stock REAL,
                reorder_flag TEXT, reorder_threshold INTEGER,
                reorder_qty_9mo INTEGER, reorder_qty_12mo INTEGER,
                forecast_30d REAL, forecast_60d REAL, forecast_90d REAL,
                forecast_lower_90d TEXT, forecast_upper_90d TEXT, forecast_method TEXT,
                stockout_date TEXT, order_by_date TEXT,
                days_until_order_deadline INTEGER, order_status TEXT,
                velocity_season_adjusted REAL,
                reorder_qty_9mo_adj INTEGER, reorder_qty_12mo_adj INTEGER,
                note TEXT, run_date TEXT
            );
            CREATE TABLE IF NOT EXISTS rolling_windows (
                sku TEXT PRIMARY KEY,
                product_title TEXT,
                total_7d INTEGER, total_14d INTEGER, total_30d INTEGER,
                total_60d INTEGER, total_90d INTEGER, total_180d INTEGER,
                shopify_180d INTEGER, amazon_180d INTEGER, edi_180d INTEGER,
                current_ytd INTEGER, prior_ytd INTEGER, yoy_change_pct REAL,
                avg_daily_7d REAL, avg_daily_30d REAL, avg_daily_90d REAL,
                velocity_trend TEXT, run_date TEXT
            );
            CREATE TABLE IF NOT EXISTS forecast_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL, date TEXT NOT NULL,
                actual_units REAL, forecast_units REAL,
                forecast_lower REAL, forecast_upper REAL,
                trend REAL, weekly_seasonal REAL, yearly_seasonal REAL,
                run_date TEXT
            );
            CREATE TABLE IF NOT EXISTS stock_pipeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL, product_title TEXT, type TEXT,
                qty_to_warehouse INTEGER, qty_to_fba INTEGER, total_quantity INTEGER,
                expected_arrival_warehouse TEXT, expected_arrival_fba TEXT,
                po_number TEXT, notes TEXT,
                active TEXT DEFAULT 'TRUE', arrived_date TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS sku_params (
                sku TEXT PRIMARY KEY,
                lead_time_days INTEGER, lead_time_buffer_days INTEGER,
                min_stock_months REAL, max_stock_months REAL,
                reorder_trigger_months REAL,
                target_stock_months_9mo REAL, target_stock_months_12mo REAL,
                moq INTEGER, carton_qty INTEGER, half_carton_qty INTEGER,
                peak_months TEXT, off_peak_months TEXT, peak_multiplier REAL,
                reorder_exempt INTEGER DEFAULT 0,
                supplier_name TEXT, shipping_method TEXT, notes TEXT, updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS run_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_timestamp TEXT NOT NULL, source TEXT NOT NULL,
                records_pulled INTEGER, status TEXT, notes TEXT
            );
            CREATE TABLE IF NOT EXISTS daily_briefs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL, narrative TEXT NOT NULL,
                brief_type TEXT DEFAULT 'daily', generated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS po_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_number TEXT NOT NULL, sku TEXT NOT NULL,
                product_title TEXT, po_date TEXT,
                qty_ordered INTEGER, qty_shipped INTEGER,
                expected_arrival_warehouse TEXT, actual_arrival_warehouse TEXT,
                lead_time_days INTEGER, variance_days INTEGER,
                shipping_method TEXT, notes TEXT
            );
            CREATE TABLE IF NOT EXISTS edi_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_number TEXT NOT NULL, sku TEXT NOT NULL,
                retailer TEXT, product_title TEXT,
                ordered_qty INTEGER, shipped_qty INTEGER,
                expected_date TEXT, date TEXT, doc_type TEXT, status TEXT
            );
        """)


def write_inventory_master(rows: list[dict]) -> int:
    """Full replace — DELETE all then INSERT. Rows come from inventory_calc.calculate_metrics()."""
    today = date.today().isoformat()
    with _connect() as conn:
        conn.execute("DELETE FROM inventory_master")
        for row in rows:
            if row.get("sku", "").startswith("_"):
                continue
            row["run_date"] = today
            conn.execute("""
                INSERT OR REPLACE INTO inventory_master (
                    sku, product_title, variant_title,
                    shopify_stock, amazon_fba_stock, current_stock,
                    sps_committed_qty, effective_stock,
                    shopify_30d, shopify_60d, shopify_90d,
                    amazon_30d, amazon_60d, amazon_90d,
                    edi_30d, edi_60d, edi_90d,
                    total_30d, total_60d, total_90d,
                    avg_weekly_velocity, avg_monthly_velocity,
                    days_of_stock, months_of_stock,
                    reorder_flag, reorder_threshold,
                    reorder_qty_9mo, reorder_qty_12mo,
                    forecast_30d, forecast_60d, forecast_90d,
                    forecast_lower_90d, forecast_upper_90d, forecast_method,
                    stockout_date, order_by_date,
                    days_until_order_deadline, order_status,
                    velocity_season_adjusted,
                    reorder_qty_9mo_adj, reorder_qty_12mo_adj,
                    note, run_date
                ) VALUES (
                    :sku, :product_title, :variant_title,
                    :shopify_stock, :amazon_fba_stock, :current_stock,
                    :sps_committed_qty, :effective_stock,
                    :shopify_30d, :shopify_60d, :shopify_90d,
                    :amazon_30d, :amazon_60d, :amazon_90d,
                    :edi_30d, :edi_60d, :edi_90d,
                    :total_30d, :total_60d, :total_90d,
                    :avg_weekly_velocity, :avg_monthly_velocity,
                    :days_of_stock, :months_of_stock,
                    :reorder_flag, :reorder_threshold,
                    :reorder_qty_9mo, :reorder_qty_12mo,
                    :forecast_30d, :forecast_60d, :forecast_90d,
                    :forecast_lower_90d, :forecast_upper_90d, :forecast_method,
                    :stockout_date, :order_by_date,
                    :days_until_order_deadline, :order_status,
                    :velocity_season_adjusted,
                    :reorder_qty_9mo_adj, :reorder_qty_12mo_adj,
                    :note, :run_date
                )
            """, {k: row.get(k) for k in [
                "sku", "product_title", "variant_title",
                "shopify_stock", "amazon_fba_stock", "current_stock",
                "sps_committed_qty", "effective_stock",
                "shopify_30d", "shopify_60d", "shopify_90d",
                "amazon_30d", "amazon_60d", "amazon_90d",
                "edi_30d", "edi_60d", "edi_90d",
                "total_30d", "total_60d", "total_90d",
                "avg_weekly_velocity", "avg_monthly_velocity",
                "days_of_stock", "months_of_stock",
                "reorder_flag", "reorder_threshold",
                "reorder_qty_9mo", "reorder_qty_12mo",
                "forecast_30d", "forecast_60d", "forecast_90d",
                "forecast_lower_90d", "forecast_upper_90d", "forecast_method",
                "stockout_date", "order_by_date",
                "days_until_order_deadline", "order_status",
                "velocity_season_adjusted",
                "reorder_qty_9mo_adj", "reorder_qty_12mo_adj",
                "note", "run_date",
            ]})
    return len(rows)


def write_rolling_windows(rows: list[dict]) -> int:
    today = date.today().isoformat()
    with _connect() as conn:
        conn.execute("DELETE FROM rolling_windows")
        for row in rows:
            row["run_date"] = today
            conn.execute("""
                INSERT OR REPLACE INTO rolling_windows VALUES (
                    :sku, :product_title,
                    :total_7d, :total_14d, :total_30d, :total_60d,
                    :total_90d, :total_180d,
                    :shopify_180d, :amazon_180d, :edi_180d,
                    :current_ytd, :prior_ytd, :yoy_change_pct,
                    :avg_daily_7d, :avg_daily_30d, :avg_daily_90d,
                    :velocity_trend, :run_date
                )
            """, row)
    return len(rows)


def write_forecast_history(rows: list[dict]) -> int:
    """Full replace per run — DELETE then INSERT."""
    today = date.today().isoformat()
    with _connect() as conn:
        conn.execute("DELETE FROM forecast_history")
        for row in rows:
            row["run_date"] = today
            conn.execute("""
                INSERT INTO forecast_history
                (sku, date, actual_units, forecast_units,
                 forecast_lower, forecast_upper,
                 trend, weekly_seasonal, yearly_seasonal, run_date)
                VALUES (:sku, :date, :actual_units, :forecast_units,
                        :forecast_lower, :forecast_upper,
                        :trend, :weekly_seasonal, :yearly_seasonal, :run_date)
            """, row)
    return len(rows)


def write_run_log(source: str, records_pulled: int, status: str, notes: str = "") -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with _connect() as conn:
        conn.execute(
            "INSERT INTO run_log (run_timestamp, source, records_pulled, status, notes) VALUES (?,?,?,?,?)",
            (ts, source, records_pulled, status, notes)
        )


def write_daily_brief(narrative: str, brief_type: str = "daily") -> None:
    today = date.today().isoformat()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO daily_briefs (date, narrative, brief_type, generated_at) VALUES (?,?,?,?)",
            (today, narrative, brief_type, ts)
        )


def upsert_po_history(rows: list[dict]) -> int:
    with _connect() as conn:
        for row in rows:
            conn.execute("""
                INSERT OR REPLACE INTO po_history
                (po_number, sku, product_title, po_date, qty_ordered, qty_shipped,
                 expected_arrival_warehouse, actual_arrival_warehouse,
                 lead_time_days, variance_days, shipping_method, notes)
                VALUES (:po_number, :sku, :product_title, :po_date, :qty_ordered, :qty_shipped,
                        :expected_arrival_warehouse, :actual_arrival_warehouse,
                        :lead_time_days, :variance_days, :shipping_method, :notes)
            """, row)
    return len(rows)


def upsert_edi_orders(rows: list[dict]) -> int:
    with _connect() as conn:
        for row in rows:
            conn.execute("""
                INSERT OR REPLACE INTO edi_orders
                (po_number, sku, retailer, product_title,
                 ordered_qty, shipped_qty, expected_date, date, doc_type, status)
                VALUES (:po_number, :sku, :retailer, :product_title,
                        :ordered_qty, :shipped_qty, :expected_date, :date, :doc_type, :status)
            """, row)
    return len(rows)


def seed_sku_params(params_by_sku: dict) -> None:
    """Called once on first pipeline run to populate sku_params from sku_params.py.
    Skips SKUs already in the table (UI edits take precedence)."""
    ts = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        for sku, p in params_by_sku.items():
            conn.execute("""
                INSERT OR IGNORE INTO sku_params VALUES (
                    :sku, :lead_time_days, :lead_time_buffer_days,
                    :min_stock_months, :max_stock_months, :reorder_trigger_months,
                    :target_stock_months_9mo, :target_stock_months_12mo,
                    :moq, :carton_qty, :half_carton_qty,
                    :peak_months, :off_peak_months, :peak_multiplier,
                    :reorder_exempt, :supplier_name, :shipping_method, :notes, :updated_at
                )
            """, {
                "sku": sku,
                **{k: p.get(k) for k in [
                    "lead_time_days", "lead_time_buffer_days",
                    "min_stock_months", "max_stock_months", "reorder_trigger_months",
                    "target_stock_months_9mo", "target_stock_months_12mo",
                    "moq", "carton_qty", "half_carton_qty",
                    "supplier_name", "shipping_method", "notes",
                ]},
                "peak_months":     json.dumps(p.get("peak_months", [])),
                "off_peak_months": json.dumps(p.get("off_peak_months", [])),
                "peak_multiplier": p.get("peak_multiplier", 1.0),
                "reorder_exempt":  1 if p.get("reorder_exempt") else 0,
                "updated_at": ts,
            })


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from sku_params import SKU_PARAMS, get_params
    print(f"Initialising database at {DB_PATH}")
    init_db()
    seed_sku_params({sku: get_params(sku) for sku in SKU_PARAMS})
    print(f"Done — all 9 tables created, {len(SKU_PARAMS)} SKU params seeded.")
