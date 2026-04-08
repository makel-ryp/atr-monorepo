"""
sku_params.py
─────────────
Per-SKU parameter defaults and overrides for the inventory pipeline.

Provides:
  - DEFAULT_PARAMS: fallback values for all pipeline parameters
  - SKU_PARAMS: per-SKU overrides (merged on top of DEFAULT_PARAMS)
  - get_params(sku, sheet_params): resolve merged params for a given SKU
  - order_deadline_date(sku, current_stock, avg_daily_rate): deadline calc
  - season_adjusted_velocity(sku, avg_monthly_velocity, target_month): seasonal adj
  - load_params_from_sheet(sh): read SKU_Params tab and return {sku: params_dict}
"""

DEFAULT_PARAMS = {
    "lead_time_days": 135,
    "lead_time_buffer_days": 14,
    "min_stock_units": 0,
    "min_stock_months": 4.5,
    "max_stock_months": 15.5,
    "reorder_trigger_months": 4.5,
    "order_multiple": 1,
    "min_order_qty": 0,
    "max_order_qty": 0,
    "target_stock_months_9mo": 13.5,
    "target_stock_months_12mo": 15.5,
    "forecast_horizon_days": 180,
    "peak_months": [],
    "off_peak_months": [],
    "peak_multiplier": 1.0,
    "supplier_name": "",
    "country_of_origin": "",
    "shipping_method": "sea",
    "reorder_exempt": False,
    "moq": 0,
    "carton_qty": 1,
    "half_carton_qty": 0,
    "notes": "",
}

# ── PRODUCT FAMILIES ──────────────────────────────────────────────────────────
# RYPSTICK + RYPR RADAR (SKUs 2, 3, 4, 5, 12):  OUT-OF-SEASON trainer
#   People train when NOT playing → peaks Oct–Mar, off-peak Jun–Aug
# BUTTERBLADE (SKUs 40, 41, 42, 46, 47, 48):    IN-SEASON putting trainer
#   Used while actively playing → peaks Apr–Sep, off-peak Nov–Feb
# FOAMIES (SKU 52): reorder exempt, no seasonality
# ─────────────────────────────────────────────────────────────────────────────

SKU_PARAMS: dict[str, dict] = {
    # ── Rypstick swing-speed trainers ─────────────────────────────────────────
    "2": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [10, 11, 12, 1, 2, 3], "off_peak_months": [6, 7, 8],
        "peak_multiplier": 1.35,
        "notes": "Swing speed trainer — out-of-season product, peaks Oct-Mar",
    },
    "3": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [10, 11, 12, 1, 2, 3], "off_peak_months": [6, 7, 8],
        "peak_multiplier": 1.35,
        "notes": "Swing speed trainer — out-of-season product, peaks Oct-Mar",
    },
    "4": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [10, 11, 12, 1, 2, 3], "off_peak_months": [6, 7, 8],
        "peak_multiplier": 1.35,
        "notes": "Swing speed trainer — out-of-season product, peaks Oct-Mar",
    },
    "5": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [10, 11, 12, 1, 2, 3], "off_peak_months": [6, 7, 8],
        "peak_multiplier": 1.35,
        "notes": "Swing speed trainer — out-of-season product, peaks Oct-Mar",
    },
    # ── Rypr Radar speed device ───────────────────────────────────────────────
    "12": {
        "lead_time_days": 135, "moq": 100, "carton_qty": 20, "half_carton_qty": 0,
        "peak_months": [10, 11, 12, 1, 2, 3], "off_peak_months": [6, 7, 8],
        "peak_multiplier": 1.35,
        "notes": "Speed measurement device — bought with Rypstick, same seasonality",
    },
    # ── ButterBlade putting trainers ──────────────────────────────────────────
    "40": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    "41": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    "42": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    "46": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    "47": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    "48": {
        "lead_time_days": 135, "moq": 300, "carton_qty": 50, "half_carton_qty": 25,
        "peak_months": [4, 5, 6, 7, 8, 9], "off_peak_months": [11, 12, 1, 2],
        "peak_multiplier": 1.30,
        "notes": "Putting trainer — in-season product, peaks Apr-Sep",
    },
    # ── Foamies — lifetime supply, reorder exempt ─────────────────────────────
    "52": {
        "reorder_exempt": True, "moq": 0, "carton_qty": 1,
        "peak_months": [], "off_peak_months": [], "peak_multiplier": 1.0,
        "notes": "Foamies — 475 months stock, lifetime supply, reorder exempt",
    },
}


def get_params(sku: str, sheet_params=None) -> dict:
    base = dict(DEFAULT_PARAMS)
    norm = str(sku).strip().lstrip("0") or "0"
    base.update(SKU_PARAMS.get(norm, {}))
    if sheet_params and norm in sheet_params:
        base.update(sheet_params[norm])
    return base


def order_deadline_date(sku, current_stock, avg_daily_rate) -> dict:
    from datetime import date, timedelta
    params = get_params(sku)
    lead = params["lead_time_days"] + params["lead_time_buffer_days"]
    if avg_daily_rate <= 0:
        return {"stockout_date": "N/A", "order_by_date": "N/A", "days_until_order_deadline": 9999, "status": "ok"}
    days_of_stock = current_stock / avg_daily_rate
    stockout_date = date.today() + timedelta(days=days_of_stock)
    order_by_date = stockout_date - timedelta(days=lead)
    days_until = (order_by_date - date.today()).days
    months_of_stock = days_of_stock / 30
    if months_of_stock > params["max_stock_months"]:
        status = "overstock"
    elif days_until <= 0:
        status = "critical"
    elif days_until <= 14:
        status = "warning"
    else:
        status = "ok"
    return {"stockout_date": stockout_date.isoformat(), "order_by_date": order_by_date.isoformat(), "days_until_order_deadline": days_until, "status": status}


def season_adjusted_velocity(sku, avg_monthly_velocity, target_month=None) -> float:
    import datetime
    params = get_params(sku)
    month = target_month or datetime.date.today().month
    if month in params.get("peak_months", []):
        return avg_monthly_velocity * params.get("peak_multiplier", 1.0)
    if month in params.get("off_peak_months", []):
        mult = params.get("peak_multiplier", 1.0)
        return avg_monthly_velocity / mult if mult > 0 else avg_monthly_velocity
    return avg_monthly_velocity


def load_params_from_sheet(sh) -> dict:
    """Read SKU_Params tab and return {sku: params_dict}. Falls back to DEFAULT_PARAMS + SKU_PARAMS for missing fields."""
    try:
        ws = sh.worksheet("SKU_Params")
        rows = ws.get_all_records()
    except Exception:
        return {}
    result = {}
    for row in rows:
        sku = str(row.get("sku", "")).strip().lstrip("0") or "0"
        if not sku:
            continue
        params = dict(DEFAULT_PARAMS)
        params.update(SKU_PARAMS.get(sku, {}))
        for k, v in row.items():
            if k in ("sku", "product_name") or k not in DEFAULT_PARAMS:
                continue
            if k in ("peak_months", "off_peak_months"):
                params[k] = [int(x.strip()) for x in str(v).split(",") if x.strip().isdigit()]
            elif k in ("lead_time_days", "lead_time_buffer_days", "min_stock_units", "order_multiple", "min_order_qty", "max_order_qty", "forecast_horizon_days"):
                try:
                    params[k] = int(v)
                except (ValueError, TypeError):
                    pass
            elif k in ("min_stock_months", "max_stock_months", "reorder_trigger_months", "target_stock_months_9mo", "target_stock_months_12mo", "peak_multiplier"):
                try:
                    params[k] = float(v)
                except (ValueError, TypeError):
                    pass
            else:
                params[k] = str(v)
        result[sku] = params
    return result


if __name__ == "__main__":
    # Basic smoke test
    p = get_params("41")
    print("get_params('41'):", p)
    d = order_deadline_date("41", 500, 10)
    print("order_deadline_date('41', 500, 10):", d)
    v = season_adjusted_velocity("41", 100, 6)
    print("season_adjusted_velocity('41', 100, 6):", v)
