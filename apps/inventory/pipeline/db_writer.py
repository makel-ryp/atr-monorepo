"""
db_writer.py
────────────
PostgreSQL writer for the inventory pipeline (Neon-compatible).

Reads DATABASE_URL from the environment — set this in apps/inventory/.env
or in Railway / Mac Mini environment variables.

Replaces the previous SQLite implementation.
"""
import json
import os
import psycopg2
import psycopg2.extras
from datetime import date, datetime, timezone
from urllib.parse import urlparse

# ── Connection ────────────────────────────────────────────────────────────────

_conn = None


def _get_conn() -> psycopg2.extensions.connection:
    """Return a module-level singleton connection, reconnecting if closed."""
    global _conn
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(url)
        _conn.autocommit = False
    return _conn


def close_conn() -> None:
    """Call at end of pipeline run to cleanly close the connection."""
    global _conn
    if _conn and not _conn.closed:
        _conn.close()
    _conn = None


# ── Schema initialisation ─────────────────────────────────────────────────────

def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every run."""
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS inventory_master (
                sku TEXT PRIMARY KEY,
                product_title TEXT, variant_title TEXT,
                shopify_stock DOUBLE PRECISION, amazon_fba_stock DOUBLE PRECISION,
                current_stock DOUBLE PRECISION,
                sps_committed_qty DOUBLE PRECISION DEFAULT 0,
                effective_stock DOUBLE PRECISION,
                shopify_30d INTEGER, shopify_60d INTEGER, shopify_90d INTEGER,
                amazon_30d INTEGER, amazon_60d INTEGER, amazon_90d INTEGER,
                edi_30d INTEGER, edi_60d INTEGER, edi_90d INTEGER,
                total_30d INTEGER, total_60d INTEGER, total_90d INTEGER,
                avg_weekly_velocity DOUBLE PRECISION, avg_monthly_velocity DOUBLE PRECISION,
                days_of_stock DOUBLE PRECISION, months_of_stock DOUBLE PRECISION,
                reorder_flag TEXT, reorder_threshold INTEGER,
                reorder_qty_9mo INTEGER, reorder_qty_12mo INTEGER,
                forecast_30d DOUBLE PRECISION, forecast_60d DOUBLE PRECISION,
                forecast_90d DOUBLE PRECISION,
                forecast_lower_90d TEXT, forecast_upper_90d TEXT, forecast_method TEXT,
                stockout_date TEXT, order_by_date TEXT,
                days_until_order_deadline INTEGER, order_status TEXT,
                velocity_season_adjusted DOUBLE PRECISION,
                reorder_qty_9mo_adj INTEGER, reorder_qty_12mo_adj INTEGER,
                note TEXT, run_date TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS rolling_windows (
                sku TEXT PRIMARY KEY,
                product_title TEXT,
                total_7d INTEGER, total_14d INTEGER, total_30d INTEGER,
                total_60d INTEGER, total_90d INTEGER, total_180d INTEGER,
                shopify_180d INTEGER, amazon_180d INTEGER, edi_180d INTEGER,
                current_ytd INTEGER, prior_ytd INTEGER,
                yoy_change_pct DOUBLE PRECISION,
                avg_daily_7d DOUBLE PRECISION, avg_daily_30d DOUBLE PRECISION,
                avg_daily_90d DOUBLE PRECISION,
                velocity_trend TEXT, run_date TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS forecast_history (
                id SERIAL PRIMARY KEY,
                sku TEXT NOT NULL, date TEXT NOT NULL,
                actual_units DOUBLE PRECISION, forecast_units DOUBLE PRECISION,
                forecast_lower DOUBLE PRECISION, forecast_upper DOUBLE PRECISION,
                trend DOUBLE PRECISION, weekly_seasonal DOUBLE PRECISION,
                yearly_seasonal DOUBLE PRECISION, run_date TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS stock_pipeline (
                id SERIAL PRIMARY KEY,
                sku TEXT NOT NULL, product_title TEXT, type TEXT,
                qty_to_warehouse INTEGER, qty_to_fba INTEGER, total_quantity INTEGER,
                expected_arrival_warehouse TEXT, expected_arrival_fba TEXT,
                po_number TEXT, notes TEXT,
                active TEXT DEFAULT 'TRUE', arrived_date TEXT, created_at TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS sku_params (
                sku TEXT PRIMARY KEY,
                lead_time_days INTEGER, lead_time_buffer_days INTEGER,
                min_stock_months DOUBLE PRECISION, max_stock_months DOUBLE PRECISION,
                reorder_trigger_months DOUBLE PRECISION,
                target_stock_months_9mo DOUBLE PRECISION,
                target_stock_months_12mo DOUBLE PRECISION,
                moq INTEGER, carton_qty INTEGER, half_carton_qty INTEGER,
                peak_months TEXT, off_peak_months TEXT,
                peak_multiplier DOUBLE PRECISION,
                reorder_exempt INTEGER DEFAULT 0,
                supplier_name TEXT, shipping_method TEXT,
                notes TEXT, updated_at TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS run_log (
                id SERIAL PRIMARY KEY,
                run_timestamp TEXT NOT NULL, source TEXT NOT NULL,
                records_pulled INTEGER, status TEXT, notes TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS daily_briefs (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL, narrative TEXT NOT NULL,
                brief_type TEXT DEFAULT 'daily', generated_at TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS po_history (
                id SERIAL PRIMARY KEY,
                po_number TEXT NOT NULL, sku TEXT NOT NULL,
                product_title TEXT, po_date TEXT,
                qty_ordered INTEGER, qty_shipped INTEGER,
                expected_arrival_warehouse TEXT, actual_arrival_warehouse TEXT,
                lead_time_days INTEGER, variance_days INTEGER,
                shipping_method TEXT, notes TEXT
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS edi_orders (
                id SERIAL PRIMARY KEY,
                po_number TEXT NOT NULL, sku TEXT NOT NULL,
                retailer TEXT, product_title TEXT,
                ordered_qty INTEGER, shipped_qty INTEGER,
                expected_date TEXT, date TEXT, doc_type TEXT, status TEXT
            )
        """)

        # Add columns that may be missing from older schemas
        for col_sql in [
            "ALTER TABLE inventory_master ADD COLUMN IF NOT EXISTS sps_committed_qty DOUBLE PRECISION DEFAULT 0",
            "ALTER TABLE inventory_master ADD COLUMN IF NOT EXISTS effective_stock DOUBLE PRECISION",
        ]:
            cur.execute(col_sql)

    conn.commit()


# ── Writers ───────────────────────────────────────────────────────────────────

def write_inventory_master(rows: list[dict]) -> int:
    """Full replace — DELETE all then INSERT. Rows from inventory_calc.calculate_metrics()."""
    today = date.today().isoformat()
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM inventory_master")
        for row in rows:
            if row.get("sku", "").startswith("_"):
                continue
            row["run_date"] = today
            cur.execute("""
                INSERT INTO inventory_master (
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
                    %(sku)s, %(product_title)s, %(variant_title)s,
                    %(shopify_stock)s, %(amazon_fba_stock)s, %(current_stock)s,
                    %(sps_committed_qty)s, %(effective_stock)s,
                    %(shopify_30d)s, %(shopify_60d)s, %(shopify_90d)s,
                    %(amazon_30d)s, %(amazon_60d)s, %(amazon_90d)s,
                    %(edi_30d)s, %(edi_60d)s, %(edi_90d)s,
                    %(total_30d)s, %(total_60d)s, %(total_90d)s,
                    %(avg_weekly_velocity)s, %(avg_monthly_velocity)s,
                    %(days_of_stock)s, %(months_of_stock)s,
                    %(reorder_flag)s, %(reorder_threshold)s,
                    %(reorder_qty_9mo)s, %(reorder_qty_12mo)s,
                    %(forecast_30d)s, %(forecast_60d)s, %(forecast_90d)s,
                    %(forecast_lower_90d)s, %(forecast_upper_90d)s, %(forecast_method)s,
                    %(stockout_date)s, %(order_by_date)s,
                    %(days_until_order_deadline)s, %(order_status)s,
                    %(velocity_season_adjusted)s,
                    %(reorder_qty_9mo_adj)s, %(reorder_qty_12mo_adj)s,
                    %(note)s, %(run_date)s
                )
                ON CONFLICT (sku) DO UPDATE SET
                    product_title=EXCLUDED.product_title,
                    variant_title=EXCLUDED.variant_title,
                    shopify_stock=EXCLUDED.shopify_stock,
                    amazon_fba_stock=EXCLUDED.amazon_fba_stock,
                    current_stock=EXCLUDED.current_stock,
                    sps_committed_qty=EXCLUDED.sps_committed_qty,
                    effective_stock=EXCLUDED.effective_stock,
                    shopify_30d=EXCLUDED.shopify_30d, shopify_60d=EXCLUDED.shopify_60d,
                    shopify_90d=EXCLUDED.shopify_90d,
                    amazon_30d=EXCLUDED.amazon_30d, amazon_60d=EXCLUDED.amazon_60d,
                    amazon_90d=EXCLUDED.amazon_90d,
                    edi_30d=EXCLUDED.edi_30d, edi_60d=EXCLUDED.edi_60d,
                    edi_90d=EXCLUDED.edi_90d,
                    total_30d=EXCLUDED.total_30d, total_60d=EXCLUDED.total_60d,
                    total_90d=EXCLUDED.total_90d,
                    avg_weekly_velocity=EXCLUDED.avg_weekly_velocity,
                    avg_monthly_velocity=EXCLUDED.avg_monthly_velocity,
                    days_of_stock=EXCLUDED.days_of_stock,
                    months_of_stock=EXCLUDED.months_of_stock,
                    reorder_flag=EXCLUDED.reorder_flag,
                    reorder_threshold=EXCLUDED.reorder_threshold,
                    reorder_qty_9mo=EXCLUDED.reorder_qty_9mo,
                    reorder_qty_12mo=EXCLUDED.reorder_qty_12mo,
                    forecast_30d=EXCLUDED.forecast_30d, forecast_60d=EXCLUDED.forecast_60d,
                    forecast_90d=EXCLUDED.forecast_90d,
                    forecast_lower_90d=EXCLUDED.forecast_lower_90d,
                    forecast_upper_90d=EXCLUDED.forecast_upper_90d,
                    forecast_method=EXCLUDED.forecast_method,
                    stockout_date=EXCLUDED.stockout_date,
                    order_by_date=EXCLUDED.order_by_date,
                    days_until_order_deadline=EXCLUDED.days_until_order_deadline,
                    order_status=EXCLUDED.order_status,
                    velocity_season_adjusted=EXCLUDED.velocity_season_adjusted,
                    reorder_qty_9mo_adj=EXCLUDED.reorder_qty_9mo_adj,
                    reorder_qty_12mo_adj=EXCLUDED.reorder_qty_12mo_adj,
                    note=EXCLUDED.note, run_date=EXCLUDED.run_date
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
    conn.commit()
    return len(rows)


def write_rolling_windows(rows: list[dict]) -> int:
    today = date.today().isoformat()
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM rolling_windows")
        for row in rows:
            row["run_date"] = today
            cur.execute("""
                INSERT INTO rolling_windows VALUES (
                    %(sku)s, %(product_title)s,
                    %(total_7d)s, %(total_14d)s, %(total_30d)s, %(total_60d)s,
                    %(total_90d)s, %(total_180d)s,
                    %(shopify_180d)s, %(amazon_180d)s, %(edi_180d)s,
                    %(current_ytd)s, %(prior_ytd)s, %(yoy_change_pct)s,
                    %(avg_daily_7d)s, %(avg_daily_30d)s, %(avg_daily_90d)s,
                    %(velocity_trend)s, %(run_date)s
                )
                ON CONFLICT (sku) DO UPDATE SET
                    product_title=EXCLUDED.product_title,
                    total_7d=EXCLUDED.total_7d, total_14d=EXCLUDED.total_14d,
                    total_30d=EXCLUDED.total_30d, total_60d=EXCLUDED.total_60d,
                    total_90d=EXCLUDED.total_90d, total_180d=EXCLUDED.total_180d,
                    shopify_180d=EXCLUDED.shopify_180d, amazon_180d=EXCLUDED.amazon_180d,
                    edi_180d=EXCLUDED.edi_180d,
                    current_ytd=EXCLUDED.current_ytd, prior_ytd=EXCLUDED.prior_ytd,
                    yoy_change_pct=EXCLUDED.yoy_change_pct,
                    avg_daily_7d=EXCLUDED.avg_daily_7d, avg_daily_30d=EXCLUDED.avg_daily_30d,
                    avg_daily_90d=EXCLUDED.avg_daily_90d,
                    velocity_trend=EXCLUDED.velocity_trend, run_date=EXCLUDED.run_date
            """, row)
    conn.commit()
    return len(rows)


def write_forecast_history(rows: list[dict]) -> int:
    """Full replace per run — DELETE then INSERT."""
    today = date.today().isoformat()
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM forecast_history")
        for row in rows:
            row["run_date"] = today
            cur.execute("""
                INSERT INTO forecast_history
                (sku, date, actual_units, forecast_units,
                 forecast_lower, forecast_upper,
                 trend, weekly_seasonal, yearly_seasonal, run_date)
                VALUES (%(sku)s, %(date)s, %(actual_units)s, %(forecast_units)s,
                        %(forecast_lower)s, %(forecast_upper)s,
                        %(trend)s, %(weekly_seasonal)s, %(yearly_seasonal)s, %(run_date)s)
            """, row)
    conn.commit()
    return len(rows)


def write_run_log(source: str, records_pulled: int, status: str, notes: str = "") -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO run_log (run_timestamp, source, records_pulled, status, notes) VALUES (%s,%s,%s,%s,%s)",
            (ts, source, records_pulled, status, notes)
        )
    conn.commit()


def write_daily_brief(narrative: str, brief_type: str = "daily") -> None:
    today = date.today().isoformat()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO daily_briefs (date, narrative, brief_type, generated_at) VALUES (%s,%s,%s,%s)",
            (today, narrative, brief_type, ts)
        )
    conn.commit()


def upsert_po_history(rows: list[dict]) -> int:
    conn = _get_conn()
    with conn.cursor() as cur:
        for row in rows:
            cur.execute("""
                INSERT INTO po_history
                (po_number, sku, product_title, po_date, qty_ordered, qty_shipped,
                 expected_arrival_warehouse, actual_arrival_warehouse,
                 lead_time_days, variance_days, shipping_method, notes)
                VALUES (%(po_number)s, %(sku)s, %(product_title)s, %(po_date)s,
                        %(qty_ordered)s, %(qty_shipped)s,
                        %(expected_arrival_warehouse)s, %(actual_arrival_warehouse)s,
                        %(lead_time_days)s, %(variance_days)s, %(shipping_method)s, %(notes)s)
            """, row)
    conn.commit()
    return len(rows)


def upsert_edi_orders(rows: list[dict]) -> int:
    conn = _get_conn()
    with conn.cursor() as cur:
        for row in rows:
            cur.execute("""
                INSERT INTO edi_orders
                (po_number, sku, retailer, product_title,
                 ordered_qty, shipped_qty, expected_date, date, doc_type, status)
                VALUES (%(po_number)s, %(sku)s, %(retailer)s, %(product_title)s,
                        %(ordered_qty)s, %(shipped_qty)s, %(expected_date)s,
                        %(date)s, %(doc_type)s, %(status)s)
            """, row)
    conn.commit()
    return len(rows)


def seed_sku_params(params_by_sku: dict) -> None:
    """Called once on first pipeline run to populate sku_params.
    Skips SKUs already in the table — UI edits take precedence."""
    ts = datetime.now(timezone.utc).isoformat()
    conn = _get_conn()
    with conn.cursor() as cur:
        for sku, p in params_by_sku.items():
            cur.execute("""
                INSERT INTO sku_params VALUES (
                    %(sku)s, %(lead_time_days)s, %(lead_time_buffer_days)s,
                    %(min_stock_months)s, %(max_stock_months)s, %(reorder_trigger_months)s,
                    %(target_stock_months_9mo)s, %(target_stock_months_12mo)s,
                    %(moq)s, %(carton_qty)s, %(half_carton_qty)s,
                    %(peak_months)s, %(off_peak_months)s, %(peak_multiplier)s,
                    %(reorder_exempt)s, %(supplier_name)s, %(shipping_method)s,
                    %(notes)s, %(updated_at)s
                )
                ON CONFLICT (sku) DO NOTHING
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
    conn.commit()


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from sku_params import SKU_PARAMS, get_params
    print(f"Initialising PostgreSQL database at {os.environ.get('DATABASE_URL', '(DATABASE_URL not set)')}")
    init_db()
    seed_sku_params({sku: get_params(sku) for sku in SKU_PARAMS})
    close_conn()
    print(f"Done — all tables created, {len(SKU_PARAMS)} SKU params seeded.")
