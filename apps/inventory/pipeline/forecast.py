"""
forecast.py
───────────
WMA-based demand forecasting for the inventory pipeline.
Prophet removed — WMA is the only forecast method.

Provides:
    build_daily_series(sku, shopify_rows, amazon_rows, edi_rows) -> pd.DataFrame
    forecast_sku(sku, daily_df, periods) -> dict
    forecast_all_skus(shopify_rows, amazon_rows, edi_rows) -> dict[str, dict]
"""

import logging
from datetime import date

import pandas as pd

log = logging.getLogger(__name__)


def _norm_sku(raw) -> str:
    """Strip whitespace and leading zeros, preserve at least '0'."""
    return str(raw).strip().lstrip("0") or "0"


def build_daily_series(sku: str, shopify_rows, amazon_rows, edi_rows) -> pd.DataFrame:
    """
    Aggregate Shopify, Amazon, and EDI rows into a daily demand series for one SKU.

    Returns a DataFrame with columns:
        ds  (datetime64)  — date
        y   (float)       — total units sold / expected that day
    """
    daily: dict[str, float] = {}
    norm_target = _norm_sku(sku)

    for rows in (shopify_rows, amazon_rows):
        for row in rows:
            if _norm_sku(row.get("sku", "")) != norm_target:
                continue
            row_date = str(row.get("date", "")).strip()
            if not row_date:
                continue
            qty = int(row.get("quantity", 0) or 0)
            daily[row_date] = daily.get(row_date, 0.0) + qty

    for row in edi_rows:
        if _norm_sku(row.get("sku", "")) != norm_target:
            continue
        row_date = str(row.get("expected_date") or row.get("date") or "").strip()
        if not row_date:
            continue
        qty = int(row.get("shipped_qty") or row.get("ordered_qty") or 0)
        daily[row_date] = daily.get(row_date, 0.0) + qty

    if not daily:
        return pd.DataFrame({"ds": pd.Series(dtype="datetime64[ns]"), "y": pd.Series(dtype=float)})

    min_date = min(daily.keys())
    today_str = date.today().isoformat()
    date_range = pd.date_range(start=min_date, end=today_str, freq="D")
    y_values = [daily.get(d.strftime("%Y-%m-%d"), 0.0) for d in date_range]

    df = pd.DataFrame({"ds": date_range, "y": y_values})
    df["y"] = df["y"].astype(float)
    return df


def forecast_sku(sku: str, daily_df: pd.DataFrame, periods: int = 90) -> dict:
    """
    WMA demand forecast for a single SKU.

    Returns a dict with keys:
        forecast_30d, forecast_60d, forecast_90d,
        forecast_lower_90d, forecast_upper_90d, forecast_method
    """
    y = daily_df["y"].values if len(daily_df) > 0 else []

    def _window_sum(series, days: int) -> float:
        return float(sum(series[-days:])) if len(series) >= days else float(sum(series))

    s30 = _window_sum(y, 30)
    s60 = _window_sum(y, 60)
    s90 = _window_sum(y, 90)

    middle_30 = s60 - s30
    oldest_30 = s90 - s60
    wma = s30 * 0.5 + middle_30 * 0.3 + oldest_30 * 0.2

    log.info(
        "WMA forecast for SKU %s: wma=%.1f (s30=%.0f s60=%.0f s90=%.0f)",
        sku, wma, s30, s60, s90,
    )
    return {
        "forecast_30d": round(wma, 1),
        "forecast_60d": round(wma * 2, 1),
        "forecast_90d": round(wma * 3, 1),
        "forecast_lower_90d": "",
        "forecast_upper_90d": "",
        "forecast_method": "wma",
    }


def forecast_all_skus(shopify_rows, amazon_rows, edi_rows) -> dict[str, dict]:
    """
    Run WMA forecasts for every active SKU in the allowlist.
    Returns a dict mapping sku -> forecast result dict.
    """
    from sku_allowlist import ACTIVE_SKUS  # noqa: PLC0415

    result: dict[str, dict] = {}
    for sku in ACTIVE_SKUS:
        try:
            daily_df = build_daily_series(sku, shopify_rows, amazon_rows, edi_rows)
            result[sku] = forecast_sku(sku, daily_df)
        except Exception as exc:
            log.warning("Forecast failed for SKU %s: %s", sku, exc)
            result[sku] = {
                "forecast_30d": 0,
                "forecast_60d": 0,
                "forecast_90d": 0,
                "forecast_lower_90d": "",
                "forecast_upper_90d": "",
                "forecast_method": "wma",
            }

    log.info("forecast_all_skus complete: %d SKUs processed.", len(result))
    return result
