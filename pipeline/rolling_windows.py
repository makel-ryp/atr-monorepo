"""
rolling_windows.py
──────────────────
Computes rolling sales windows (7d, 14d, 30d, 60d, 90d, 180d, YTD) per SKU
across all channels, plus velocity trend classification.

Usage:
    from rolling_windows import compute_all_rolling_windows
    rolling = compute_all_rolling_windows(shopify_rows, amazon_rows, edi_rows)
"""

import logging
from datetime import date, timedelta
from collections import defaultdict

log = logging.getLogger("rolling_windows")


def compute_rolling_windows(sku, shopify_rows, amazon_rows, edi_rows, today=None) -> dict:
    today = today or date.today()
    norm_sku = str(sku).strip().lstrip("0") or "0"

    def make_daily(rows, channel):
        daily = defaultdict(int)
        for row in rows:
            row_sku = str(row.get("sku", "")).strip().lstrip("0") or "0"
            if row_sku != norm_sku:
                continue
            d_str = str(row.get("date", ""))[:10]
            try:
                d = date.fromisoformat(d_str)
            except ValueError:
                continue
            qty = int(row.get("quantity", 0) or 0)
            daily[d] += qty
        return daily

    shopify_daily = make_daily(shopify_rows, "shopify")
    amazon_daily = make_daily(amazon_rows, "amazon")
    edi_daily = make_daily(edi_rows, "edi")

    def sum_window(daily, days):
        cutoff = today - timedelta(days=days)
        return sum(v for d, v in daily.items() if d > cutoff)

    def sum_channel_window(channel_daily, days):
        cutoff = today - timedelta(days=days)
        return sum(v for d, v in channel_daily.items() if d > cutoff)

    all_daily = defaultdict(int)
    for d, v in shopify_daily.items():
        all_daily[d] += v
    for d, v in amazon_daily.items():
        all_daily[d] += v
    for d, v in edi_daily.items():
        all_daily[d] += v

    total_7d = sum_window(all_daily, 7)
    total_14d = sum_window(all_daily, 14)
    total_30d = sum_window(all_daily, 30)
    total_60d = sum_window(all_daily, 60)
    total_90d = sum_window(all_daily, 90)
    total_180d = sum_window(all_daily, 180)

    shopify_180d = sum_channel_window(shopify_daily, 180)
    amazon_180d = sum_channel_window(amazon_daily, 180)
    edi_180d = sum_channel_window(edi_daily, 180)

    # YTD
    year_start = date(today.year, 1, 1)
    prior_year_start = date(today.year - 1, 1, 1)
    ytd_cutoff = today
    prior_ytd_cutoff = date(today.year - 1, today.month, today.day)

    current_ytd = sum(v for d, v in all_daily.items() if year_start <= d <= ytd_cutoff)
    current_ytd_days = (ytd_cutoff - year_start).days + 1

    prior_ytd = sum(v for d, v in all_daily.items() if prior_year_start <= d <= prior_ytd_cutoff)
    prior_ytd_days = current_ytd_days

    if prior_ytd > 0:
        yoy_change_pct = round((current_ytd - prior_ytd) / prior_ytd * 100, 1)
    else:
        yoy_change_pct = 0.0

    # Monthly breakdown last 12 months
    monthly_12mo = []
    for i in range(11, -1, -1):
        ref = date(today.year, today.month, 1) - timedelta(days=i * 30)
        mo_start = date(ref.year, ref.month, 1)
        if ref.month == 12:
            mo_end = date(ref.year + 1, 1, 1) - timedelta(days=1)
        else:
            mo_end = date(ref.year, ref.month + 1, 1) - timedelta(days=1)
        mo_str = mo_start.strftime("%Y-%m")
        s = sum(v for d, v in shopify_daily.items() if mo_start <= d <= mo_end)
        a = sum(v for d, v in amazon_daily.items() if mo_start <= d <= mo_end)
        e = sum(v for d, v in edi_daily.items() if mo_start <= d <= mo_end)
        monthly_12mo.append({"month": mo_str, "units": s + a + e, "shopify": s, "amazon": a, "edi": e})

    # Velocity
    avg_daily_7d = round(total_7d / 7, 2) if total_7d else 0
    avg_daily_30d = round(total_30d / 30, 2) if total_30d else 0
    avg_daily_90d = round(total_90d / 90, 2) if total_90d else 0

    if avg_daily_7d > avg_daily_30d * 1.1 and avg_daily_30d > avg_daily_90d * 1.05:
        velocity_trend = "accelerating"
    elif avg_daily_7d < avg_daily_30d * 0.9 and avg_daily_30d < avg_daily_90d * 0.95:
        velocity_trend = "decelerating"
    else:
        velocity_trend = "stable"

    return {
        "total_7d": total_7d, "total_14d": total_14d,
        "total_30d": total_30d, "total_60d": total_60d,
        "total_90d": total_90d, "total_180d": total_180d,
        "shopify_180d": shopify_180d, "amazon_180d": amazon_180d, "edi_180d": edi_180d,
        "current_ytd": current_ytd, "current_ytd_days": current_ytd_days,
        "prior_ytd": prior_ytd, "prior_ytd_days": prior_ytd_days,
        "yoy_change_pct": yoy_change_pct,
        "monthly_12mo": monthly_12mo,
        "avg_daily_7d": avg_daily_7d,
        "avg_daily_30d": avg_daily_30d,
        "avg_daily_90d": avg_daily_90d,
        "velocity_trend": velocity_trend,
    }


def compute_all_rolling_windows(shopify_rows, amazon_rows, edi_rows) -> dict:
    from sku_allowlist import ACTIVE_SKUS
    result = {}
    for sku in sorted(ACTIVE_SKUS):
        try:
            result[sku] = compute_rolling_windows(sku, shopify_rows, amazon_rows, edi_rows)
        except Exception as e:
            log.error("Rolling windows failed for SKU %s: %s", sku, e)
    return result
