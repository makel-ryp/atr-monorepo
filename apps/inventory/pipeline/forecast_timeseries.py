"""
forecast_timeseries.py
──────────────────────
Builds per-SKU daily time series combining actual sales history + WMA forecast.
Writes results to the forecast_history SQLite table via db_writer.

Prophet removed — WMA is the only forecast method.

Usage:
    python forecast_timeseries.py [--dry-run]
"""

import logging
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("forecast_timeseries")

HISTORY_DAYS = 180
FORECAST_DAYS = 180


def build_forecast_timeseries(sku: str, shopify_rows, amazon_rows, edi_rows) -> list[dict]:
    """
    Build daily time series for one SKU: HISTORY_DAYS of actuals + FORECAST_DAYS of WMA.

    Returns a list of dicts matching the forecast_history schema.
    """
    today = date.today()
    hist_start = today - timedelta(days=HISTORY_DAYS)

    # Aggregate daily actuals
    daily: dict[str, float] = {}

    def _add_rows(rows, date_field="date"):
        for row in rows:
            sku_val = str(row.get("sku", "")).strip().lstrip("0") or "0"
            if sku_val != str(sku).strip().lstrip("0"):
                continue
            d = str(row.get(date_field, ""))[:10]
            if not d or d < hist_start.isoformat():
                continue
            qty = int(row.get("quantity", 0) or row.get("shipped_qty", 0) or row.get("ordered_qty", 0) or 0)
            daily[d] = daily.get(d, 0.0) + qty

    _add_rows(shopify_rows)
    _add_rows(amazon_rows)
    _add_rows(edi_rows, date_field="expected_date")

    # Fill gaps
    cur = hist_start
    while cur <= today:
        ds = cur.isoformat()
        if ds not in daily:
            daily[ds] = 0.0
        cur += timedelta(days=1)

    sorted_dates = sorted(daily.keys())
    y_values = [daily[d] for d in sorted_dates]

    # WMA on historical window
    def _wma(series) -> float:
        s = list(series)
        s30 = sum(s[-30:]) if len(s) >= 30 else sum(s)
        s60 = sum(s[-60:]) if len(s) >= 60 else sum(s)
        s90 = sum(s[-90:]) if len(s) >= 90 else sum(s)
        m30 = s60 - s30
        o30 = s90 - s60
        return s30 * 0.5 + m30 * 0.3 + o30 * 0.2

    daily_wma = _wma(y_values) / 30 if y_values else 0.0
    run_date = today.isoformat()
    result = []

    # Historical rows (actuals; forecast = WMA projection)
    for d in sorted_dates:
        result.append({
            "sku": sku,
            "date": d,
            "actual_units": daily[d],
            "forecast_units": round(daily_wma, 2),
            "forecast_lower": None,
            "forecast_upper": None,
            "trend": None,
            "weekly_seasonal": None,
            "yearly_seasonal": None,
            "run_date": run_date,
        })

    # Forecast rows (future)
    forecast_start = (today + timedelta(days=1))
    for i in range(FORECAST_DAYS):
        d = (forecast_start + timedelta(days=i)).isoformat()
        result.append({
            "sku": sku,
            "date": d,
            "actual_units": None,
            "forecast_units": round(daily_wma, 2),
            "forecast_lower": None,
            "forecast_upper": None,
            "trend": None,
            "weekly_seasonal": None,
            "yearly_seasonal": None,
            "run_date": run_date,
        })

    return result


def build_all_timeseries(shopify_rows, amazon_rows, edi_rows) -> list[dict]:
    from sku_allowlist import ACTIVE_SKUS  # noqa: PLC0415

    all_rows = []
    for sku in sorted(ACTIVE_SKUS):
        try:
            rows = build_forecast_timeseries(sku, shopify_rows, amazon_rows, edi_rows)
            all_rows.extend(rows)
        except Exception as exc:
            log.error("Timeseries failed for SKU %s: %s", sku, exc)

    log.info("build_all_timeseries: %d rows across %d SKUs", len(all_rows), len(ACTIVE_SKUS))
    return all_rows


def run(dry_run: bool = False, shopify_rows=None, amazon_rows=None, edi_rows=None) -> dict:
    shopify_rows = shopify_rows or []
    amazon_rows = amazon_rows or []
    edi_rows = edi_rows or []

    all_rows = build_all_timeseries(shopify_rows, amazon_rows, edi_rows)

    if dry_run:
        log.info("[DRY RUN] Would write %d timeseries rows to forecast_history", len(all_rows))
        return {"source": "timeseries", "records_pulled": len(all_rows), "status": "dry_run"}

    import db_writer
    db_writer.write_forecast_history(all_rows)
    log.info("Wrote %d timeseries rows to forecast_history", len(all_rows))

    return {"source": "timeseries", "records_pulled": len(all_rows), "status": "ok"}


if __name__ == "__main__":
    import argparse
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
