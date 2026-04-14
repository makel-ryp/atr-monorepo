"""
inventory_calc.py
─────────────────
Calculates per-SKU velocity metrics, forecasts, reorder flags,
and writes everything to SQLite via db_writer.

Data is received from run_pipeline.py via function parameters.
No Google Sheets reads.
"""

import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta
from logging.handlers import RotatingFileHandler
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from sku_allowlist import is_active_sku  # noqa: E402
from sku_params import get_params, order_deadline_date, season_adjusted_velocity  # noqa: E402
import db_writer  # noqa: E402

os.makedirs("logs", exist_ok=True)
_handlers = [
    logging.StreamHandler(sys.stdout),
    RotatingFileHandler("logs/pipeline.log", maxBytes=5 * 1024 * 1024, backupCount=3),
]
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=_handlers,
)
log = logging.getLogger("inventory_calc")

DEFAULT_REORDER_THRESHOLD_DAYS = 135


# ── Sales aggregation ─────────────────────────────────────────────────────────
def _parse_date(val: Any) -> date | None:
    if not val:
        return None
    s = str(val).strip()[:10]
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def aggregate_sales(
    shopify_rows: list[dict],
    amazon_rows: list[dict],
    edi_rows: list[dict] | None = None,
    today: date | None = None,
) -> dict[str, dict]:
    if today is None:
        today = date.today()
    if edi_rows is None:
        edi_rows = []

    cutoffs = {
        "30d": today - timedelta(days=30),
        "60d": today - timedelta(days=60),
        "90d": today - timedelta(days=90),
    }

    data: dict[str, dict] = defaultdict(lambda: {
        "shopify_30d": 0, "shopify_60d": 0, "shopify_90d": 0,
        "amazon_30d":  0, "amazon_60d":  0, "amazon_90d":  0,
        "edi_30d":     0, "edi_60d":     0, "edi_90d":     0,
        "product_title": "",
        "variant_title": "",
    })

    def _add(rows: list[dict], prefix: str, qty_field: str = "quantity") -> None:
        for row in rows:
            sku = str(row.get("sku", "")).strip().lstrip("0") or str(row.get("sku", "")).strip()
            if not sku:
                continue
            if qty_field == "edi_qty":
                raw_qty = row.get("shipped_qty") or row.get("ordered_qty") or 0
            else:
                raw_qty = row.get(qty_field, 0) or 0
            try:
                qty = int(float(str(raw_qty).strip() or "0"))
            except (ValueError, TypeError):
                qty = 0
            if qty <= 0:
                continue

            date_val = row.get("date") or row.get("expected_date") or ""
            row_date = _parse_date(date_val)
            if row_date is None or row_date < cutoffs["90d"]:
                continue

            title = str(row.get("product_title", "")).strip()
            if title:
                data[sku]["product_title"] = title
            variant = str(row.get("variant_title", "")).strip()
            if variant:
                data[sku]["variant_title"] = variant

            data[sku][f"{prefix}_90d"] += qty
            if row_date >= cutoffs["60d"]:
                data[sku][f"{prefix}_60d"] += qty
            if row_date >= cutoffs["30d"]:
                data[sku][f"{prefix}_30d"] += qty

    _add(shopify_rows, "shopify", qty_field="quantity")
    _add(amazon_rows,  "amazon",  qty_field="quantity")
    _add(edi_rows,     "edi",     qty_field="edi_qty")

    for sku, d in data.items():
        d["total_30d"] = d["shopify_30d"] + d["amazon_30d"] + d["edi_30d"]
        d["total_60d"] = d["shopify_60d"] + d["amazon_60d"] + d["edi_60d"]
        d["total_90d"] = d["shopify_90d"] + d["amazon_90d"] + d["edi_90d"]

    return dict(data)


# ── Metrics ───────────────────────────────────────────────────────────────────
def calculate_metrics(
    sku: str,
    sales: dict,
    shopify_stock: float,
    amazon_fba_stock: float,
    forecast_data: dict | None = None,
    sps_committed_qty: float = 0.0,
) -> dict:
    current_stock   = shopify_stock + amazon_fba_stock
    # effective_stock is what's actually free to sell — gross minus open SPS PO commitments
    effective_stock = max(0.0, current_stock - sps_committed_qty)

    s30 = sales.get("total_30d", 0)
    s60 = sales.get("total_60d", 0)
    s90 = sales.get("total_90d", 0)

    middle_30 = s60 - s30
    oldest_30  = s90 - s60
    wma_30d    = s30 * 0.5 + middle_30 * 0.3 + oldest_30 * 0.2
    forecast_30 = round(wma_30d, 1)
    forecast_60 = round(wma_30d * 2, 1)
    forecast_90 = round(wma_30d * 3, 1)

    avg_weekly  = round(s90 / 13, 2) if s90 > 0 else 0.0
    avg_monthly = round(s90 / 3,  2) if s90 > 0 else 0.0
    daily_rate  = avg_weekly / 7 if avg_weekly > 0 else 0.0

    reorder_threshold = int(round(avg_monthly * 4.5, 0)) if avg_monthly > 0 else DEFAULT_REORDER_THRESHOLD_DAYS

    note = ""
    if s90 == 0 and effective_stock == 0:
        days_of_stock   = 0.0
        months_of_stock = 0.0
        reorder_flag    = False
        note = "no_stock_no_sales"
    elif s90 == 0 and effective_stock > 0:
        days_of_stock   = 9999.0
        months_of_stock = 9999.0
        reorder_flag    = False
        note = "no_recent_sales"
    else:
        days_of_stock   = round(effective_stock / daily_rate,  1) if daily_rate  > 0 else 9999.0
        months_of_stock = round(effective_stock / avg_monthly, 1) if avg_monthly > 0 else 9999.0
        reorder_flag = effective_stock < reorder_threshold

    reorder_qty_9mo  = int(max(0, round(avg_monthly * 13.5 - effective_stock, 0))) if avg_monthly > 0 else 0
    reorder_qty_12mo = int(max(0, round(avg_monthly * 15.5 - effective_stock, 0))) if avg_monthly > 0 else 0
    recommended_reorder = reorder_qty_9mo if reorder_flag else 0

    forecast_lower_90 = ""
    forecast_upper_90 = ""
    forecast_method   = "wma"
    if forecast_data:
        forecast_30 = forecast_data.get("forecast_30d", forecast_30)
        forecast_60 = forecast_data.get("forecast_60d", forecast_60)
        forecast_90 = forecast_data.get("forecast_90d", forecast_90)
        forecast_lower_90 = forecast_data.get("forecast_lower_90d", "")
        forecast_upper_90 = forecast_data.get("forecast_upper_90d", "")
        forecast_method   = forecast_data.get("forecast_method", "wma")

    avg_daily_rate = avg_monthly / 30 if avg_monthly > 0 else 0.0
    deadline = order_deadline_date(sku, effective_stock, avg_daily_rate)
    stockout_date = deadline["stockout_date"]
    order_by_date = deadline["order_by_date"]
    days_until_order_deadline = deadline["days_until_order_deadline"]
    order_status = deadline["status"]

    velocity_season_adjusted = season_adjusted_velocity(sku, avg_monthly)
    sku_p = get_params(sku)
    reorder_qty_9mo_adj  = max(0, velocity_season_adjusted * sku_p["target_stock_months_9mo"]  - effective_stock)
    reorder_qty_12mo_adj = max(0, velocity_season_adjusted * sku_p["target_stock_months_12mo"] - effective_stock)
    max_units = avg_monthly * sku_p["max_stock_months"]
    reorder_qty_9mo_adj  = int(round(min(reorder_qty_9mo_adj,  max(0, max_units - effective_stock)), 0))
    reorder_qty_12mo_adj = int(round(min(reorder_qty_12mo_adj, max(0, max_units - effective_stock)), 0))

    return {
        "sku": sku,
        "product_title": sales.get("product_title", ""),
        "variant_title": sales.get("variant_title", ""),
        "shopify_stock":      shopify_stock,
        "amazon_fba_stock":   amazon_fba_stock,
        "current_stock":      current_stock,
        "sps_committed_qty":  sps_committed_qty,
        "effective_stock":    effective_stock,
        "shopify_30d": sales.get("shopify_30d", 0),
        "shopify_60d": sales.get("shopify_60d", 0),
        "shopify_90d": sales.get("shopify_90d", 0),
        "amazon_30d":  sales.get("amazon_30d",  0),
        "amazon_60d":  sales.get("amazon_60d",  0),
        "amazon_90d":  sales.get("amazon_90d",  0),
        "edi_30d":     sales.get("edi_30d",     0),
        "edi_60d":     sales.get("edi_60d",     0),
        "edi_90d":     sales.get("edi_90d",     0),
        "total_30d":   s30,
        "total_60d":   s60,
        "total_90d":   s90,
        "avg_weekly_velocity":  avg_weekly,
        "avg_monthly_velocity": avg_monthly,
        "days_of_stock":        days_of_stock,
        "months_of_stock":      months_of_stock,
        "reorder_flag":      str(reorder_flag),
        "reorder_threshold": reorder_threshold,
        "forecast_30d":      forecast_30,
        "forecast_60d":      forecast_60,
        "forecast_90d":      forecast_90,
        "reorder_qty_9mo":     reorder_qty_9mo,
        "reorder_qty_12mo":    reorder_qty_12mo,
        "forecast_lower_90d":  forecast_lower_90,
        "forecast_upper_90d":  forecast_upper_90,
        "forecast_method":     forecast_method,
        "note":                note,
        "stockout_date":              stockout_date,
        "order_by_date":              order_by_date,
        "days_until_order_deadline":  days_until_order_deadline,
        "order_status":               order_status,
        "velocity_season_adjusted":   round(velocity_season_adjusted, 2),
        "reorder_qty_9mo_adj":        reorder_qty_9mo_adj,
        "reorder_qty_12mo_adj":       reorder_qty_12mo_adj,
        "_recommended_reorder": recommended_reorder,
    }


def _get_forecasts(shopify_rows, amazon_rows, edi_rows) -> dict:
    try:
        from forecast import forecast_all_skus  # noqa: PLC0415
        return forecast_all_skus(shopify_rows, amazon_rows, edi_rows)
    except ImportError:
        log.debug("forecast.py not available — using WMA forecasts only.")
        return {}
    except Exception as exc:
        log.warning("Forecast module failed (%s) — falling back to WMA.", exc)
        return {}


# ── Main ──────────────────────────────────────────────────────────────────────
def run(
    dry_run: bool = False,
    shopify_rows: list | None = None,
    amazon_rows: list | None = None,
    edi_rows: list | None = None,
    stock_by_sku: dict | None = None,
) -> dict:
    """
    Calculate inventory metrics and write to SQLite.

    Data is received from run_pipeline.py. If rows are not provided (dry-run or
    incomplete pipeline), returns a dry-run result without writing anything.
    """
    log.info("=== Inventory Calculator started ===")

    shopify_rows = shopify_rows or []
    amazon_rows  = amazon_rows  or []
    edi_rows     = edi_rows     or []
    stock_by_sku = stock_by_sku or {}

    # stock_by_sku format: {"sku": {"shopify_stock": N, "amazon_fba_stock": N}}
    shopify_stock_map: dict[str, float] = {}
    amazon_fba_stock_map: dict[str, float] = {}
    for sku, v in stock_by_sku.items():
        shopify_stock_map[sku]     = float(v.get("shopify_stock", 0))
        amazon_fba_stock_map[sku]  = float(v.get("amazon_fba_stock", 0))

    forecasts = _get_forecasts(shopify_rows, amazon_rows, edi_rows)

    try:
        from rolling_windows import compute_all_rolling_windows  # noqa: PLC0415
        rolling = compute_all_rolling_windows(shopify_rows, amazon_rows, edi_rows)
        log.info("Rolling windows computed for %d SKUs.", len(rolling))
    except Exception as exc:
        log.warning("Rolling windows computation failed (%s) — skipping.", exc)
        rolling = {}

    # ── Open SPS PO commitments ───────────────────────────────────────────────
    # Query edi_orders for EDI 850 POs where ordered_qty > shipped_qty.
    # These units are committed to the retailer and reduce free-to-sell stock.
    sps_committed_map: dict[str, float] = {}
    try:
        with db_writer._connect() as conn:
            rows_raw = conn.execute("""
                SELECT sku,
                       SUM(COALESCE(ordered_qty, 0) - COALESCE(shipped_qty, 0)) AS committed
                FROM edi_orders
                WHERE doc_type = 'EDI_850'
                  AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'complete', 'closed')
                  AND COALESCE(ordered_qty, 0) > COALESCE(shipped_qty, 0)
                GROUP BY sku
            """).fetchall()
        for r in rows_raw:
            sku = str(r["sku"]).strip().lstrip("0") or str(r["sku"])
            committed = max(0.0, float(r["committed"] or 0))
            if committed > 0:
                sps_committed_map[sku] = committed
        if sps_committed_map:
            log.info(
                "Open SPS PO commitments: %d SKUs, %d total units reserved.",
                len(sps_committed_map), int(sum(sps_committed_map.values())),
            )
    except Exception as exc:
        log.warning("Could not query open SPS POs (%s) — sps_committed_qty will be 0.", exc)

    sales_by_sku = aggregate_sales(shopify_rows, amazon_rows, edi_rows)
    all_skus = set(sales_by_sku.keys()) | set(shopify_stock_map.keys()) | set(amazon_fba_stock_map.keys())
    metrics_list: list[dict] = []

    _empty_sales: dict = {
        "shopify_30d": 0, "shopify_60d": 0, "shopify_90d": 0,
        "amazon_30d":  0, "amazon_60d":  0, "amazon_90d":  0,
        "edi_30d":     0, "edi_60d":     0, "edi_90d":     0,
        "total_30d":   0, "total_60d":   0, "total_90d":   0,
        "product_title": "",
    }

    for sku in sorted(all_skus):
        if not is_active_sku(sku):
            log.debug("Skipping inactive/archived SKU: %s", sku)
            continue
        sales              = sales_by_sku.get(sku, _empty_sales)
        shopify_stock      = shopify_stock_map.get(sku, 0.0)
        amazon_stock       = amazon_fba_stock_map.get(sku, 0.0)
        sps_committed      = sps_committed_map.get(sku, 0.0)
        metrics = calculate_metrics(
            sku, sales, shopify_stock, amazon_stock,
            forecast_data=forecasts.get(sku),
            sps_committed_qty=sps_committed,
        )
        metrics_list.append(metrics)

    alerts_count = sum(1 for m in metrics_list if str(m.get("reorder_flag", "")).lower() == "true")
    log.info("SKUs with reorder flag: %d", alerts_count)

    if dry_run:
        log.info("[DRY RUN] Would write %d rows to inventory_master.", len(metrics_list))
        return {"source": "calculator", "records_pulled": len(metrics_list), "status": "dry_run"}

    db_writer.write_inventory_master(metrics_list)

    if rolling:
        today_str = date.today().isoformat()
        title_map = {str(m["sku"]): m.get("product_title", "") for m in metrics_list}
        rolling_rows = []
        for sku, data in rolling.items():
            row = {"sku": sku, "product_title": title_map.get(str(sku), ""), **data}
            rolling_rows.append(row)
        db_writer.write_rolling_windows(rolling_rows)

    log.info("=== Inventory Calculator complete ===")
    return {
        "source": "calculator",
        "records_pulled": len(metrics_list),
        "status": "ok",
        "alerts": [m for m in metrics_list if str(m.get("reorder_flag", "")).lower() == "true"],
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
