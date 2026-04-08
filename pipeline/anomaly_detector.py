"""
anomaly_detector.py
───────────────────
Detect inventory anomalies from pipeline data.
Seasonal false positives are suppressed per product family rules.
"""
import datetime
from typing import Any

from sku_params import get_params

# ── Thresholds ────────────────────────────────────────────────────────────────
VELOCITY_SPIKE_RATIO   = 1.5   # 7d avg > 30d avg * 1.5
VELOCITY_DROP_RATIO    = 0.5   # 7d avg < 30d avg * 0.5
FORECAST_HIGH_RATIO    = 1.3   # actual > forecast * 1.3
FORECAST_LOW_RATIO     = 0.7   # actual < forecast * 0.7
YOY_DECLINE_THRESHOLD  = -20   # yoy_change_pct < -20%


def _safe(val, default=0.0):
    try: return float(val) if val not in ("",None,"N/A") else default
    except (TypeError,ValueError): return default

def _phase(month, params):
    if month in params.get("peak_months",[]): return "peak"
    if month in params.get("off_peak_months",[]): return "off_peak"
    return "shoulder"


def detect_anomalies(
    inventory_df=None,
    rolling_df=None,
    history_df=None,
    today: datetime.date | None = None,
) -> list[dict[str,Any]]:
    """
    Run all anomaly checks. Accepts pandas DataFrames or lists of dicts.
    Returns flat list of anomaly dicts.
    """
    import pandas as pd
    today = today or datetime.date.today()
    month = today.month
    results: list[dict] = []

    # Normalise to list-of-dicts
    if inventory_df is None: inventory_df = []
    if rolling_df is None: rolling_df = []
    inv_rows = inventory_df.to_dict("records") if hasattr(inventory_df,"to_dict") else list(inventory_df)
    roll_rows = rolling_df.to_dict("records") if hasattr(rolling_df,"to_dict") else list(rolling_df)

    roll_by_sku = {
        str(r.get("sku","")).strip().lstrip("0") or "0": r
        for r in roll_rows
    }

    # Active pipeline entries (for PIPELINE_LATE)
    pipeline_rows: list[dict] = []
    try:
        import sqlite3, pathlib
        db_path = pathlib.Path(__file__).parent.parent / ".data" / "hub" / "db.sqlite"
        with sqlite3.connect(str(db_path)) as _conn:
            _conn.row_factory = sqlite3.Row
            _cur = _conn.execute(
                "SELECT * FROM stock_pipeline WHERE upper(active) = 'TRUE'"
            )
            pipeline_rows = [dict(r) for r in _cur.fetchall()]
    except Exception:
        pass

    for r in inv_rows:
        sku = str(r.get("sku","")).strip().lstrip("0") or "0"
        if sku == "52": continue  # exempt
        title = r.get("product_title","")
        params = get_params(sku)
        phase = _phase(month, params)

        rw = roll_by_sku.get(sku, {})
        avg_7d  = _safe(rw.get("avg_daily_7d",0))
        avg_30d = _safe(rw.get("avg_daily_30d",0))
        yoy     = _safe(rw.get("yoy_change_pct",0))
        order_status = str(r.get("order_status","")).lower()
        months_w_pipe = _safe(r.get("months_of_stock",0))

        # ── VELOCITY_SPIKE ────────────────────────────────────────────────────
        if avg_30d > 0 and avg_7d > avg_30d * VELOCITY_SPIKE_RATIO:
            if phase != "peak":
                results.append({
                    "sku":sku,"product_title":title,"type":"VELOCITY_SPIKE",
                    "severity":"warning" if phase=="off_peak" else "info",
                    "message":(
                        f"7-day velocity ({avg_7d:.1f}/day) is "
                        f"{avg_7d/avg_30d:.1f}x the 30-day average ({avg_30d:.1f}/day)."
                        + (" Off-peak period — unusual." if phase=="off_peak" else "")
                    ),
                    "data":{"avg_daily_7d":avg_7d,"avg_daily_30d":avg_30d,"phase":phase},
                })

        # ── VELOCITY_DROP ─────────────────────────────────────────────────────
        if avg_30d > 0 and avg_7d < avg_30d * VELOCITY_DROP_RATIO:
            if phase != "off_peak":
                results.append({
                    "sku":sku,"product_title":title,"type":"VELOCITY_DROP",
                    "severity":"warning" if phase=="peak" else "info",
                    "message":(
                        f"7-day velocity ({avg_7d:.1f}/day) is only "
                        f"{avg_7d/avg_30d:.0%} of 30-day average ({avg_30d:.1f}/day)."
                        + (" Drop during PEAK season — investigate." if phase=="peak" else "")
                    ),
                    "data":{"avg_daily_7d":avg_7d,"avg_daily_30d":avg_30d,"phase":phase},
                })

        # ── FORECAST_DIVERGENCE ───────────────────────────────────────────────
        actual_30 = _safe(r.get("total_30d",0))
        forecast_30 = _safe(r.get("forecast_30d",0))
        if forecast_30 > 0:
            ratio = actual_30 / forecast_30
            if ratio > FORECAST_HIGH_RATIO or ratio < FORECAST_LOW_RATIO:
                direction = "above" if ratio > 1 else "below"
                results.append({
                    "sku":sku,"product_title":title,"type":"FORECAST_DIVERGENCE",
                    "severity":"info",
                    "message":(
                        f"Actual 30-day sales ({actual_30:.0f}) are "
                        f"{abs(ratio-1):.0%} {direction} forecast ({forecast_30:.0f})."
                    ),
                    "data":{"actual_30d":actual_30,"forecast_30d":forecast_30,"ratio":ratio},
                })

        # ── STOCKOUT_IMMINENT_NO_PIPELINE ─────────────────────────────────────
        if order_status == "critical":
            has_pipeline = sku in {
                str(p.get("sku","")).strip().lstrip("0") for p in pipeline_rows
            }
            if not has_pipeline:
                days = int(_safe(r.get("days_until_order_deadline",0)))
                results.append({
                    "sku":sku,"product_title":title,"type":"STOCKOUT_IMMINENT_NO_PIPELINE",
                    "severity":"critical",
                    "message":(
                        f"Order deadline in {days} days — no stock in transit. "
                        f"Order immediately."
                    ),
                    "data":{"days_until_deadline":days,"pipeline_exists":False},
                })

        # ── OVERSTOCK ─────────────────────────────────────────────────────────
        max_months = _safe(params.get("max_stock_months",15.5))
        if months_w_pipe > max_months:
            results.append({
                "sku":sku,"product_title":title,"type":"OVERSTOCK",
                "severity":"info",
                "message":(
                    f"Stock level ({months_w_pipe:.1f} months) exceeds max "
                    f"({max_months:.1f} months)."
                ),
                "data":{"months_of_stock":months_w_pipe,"max_stock_months":max_months},
            })

        # ── YOY_DECLINE ───────────────────────────────────────────────────────
        if yoy < YOY_DECLINE_THRESHOLD:
            results.append({
                "sku":sku,"product_title":title,"type":"YOY_DECLINE",
                "severity":"info",
                "message":f"YoY sales decline of {yoy:.1f}% vs same period last year.",
                "data":{"yoy_change_pct":yoy},
            })

    # ── PIPELINE_LATE ─────────────────────────────────────────────────────────
    for p in pipeline_rows:
        sku = str(p.get("sku","")).strip().lstrip("0") or "0"
        eta_str = str(p.get("expected_arrival_warehouse","")).strip()
        if not eta_str: continue
        try:
            eta = datetime.date.fromisoformat(eta_str)
        except ValueError:
            continue
        if eta < today:
            days_late = (today - eta).days
            results.append({
                "sku":sku,"product_title":p.get("product_title",""),"type":"PIPELINE_LATE",
                "severity":"warning",
                "message":(
                    f"Shipment (PO: {p.get('po_number','?')}) expected "
                    f"{eta_str} — now {days_late} days overdue."
                ),
                "data":{"expected":eta_str,"days_late":days_late},
            })

    # Sort: critical first, then warning, then info
    _sev = {"critical":0,"warning":1,"info":2}
    results.sort(key=lambda x: _sev.get(x.get("severity","info"),2))
    return results


def format_anomalies_for_email(anomalies: list[dict]) -> str:
    """HTML block for email — critical + warning only."""
    items = [a for a in anomalies if a.get("severity") in ("critical","warning")]
    if not items: return ""
    rows = "".join(
        f'<tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">'
        f'<strong>[{a["severity"].upper()}]</strong></td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #ddd;">'
        f'SKU {a["sku"]} {a["product_title"]}</td>'
        f'<td style="padding:6px 10px;border-bottom:1px solid #ddd;">'
        f'{a["message"]}</td></tr>'
        for a in items
    )
    return (
        f'<h3 style="color:#c0392b">Anomalies ({len(items)})</h3>'
        f'<table style="border-collapse:collapse;width:100%">'
        f'<tr><th style="text-align:left;padding:6px 10px;background:#f4f4f4">Severity</th>'
        f'<th style="text-align:left;padding:6px 10px;background:#f4f4f4">SKU</th>'
        f'<th style="text-align:left;padding:6px 10px;background:#f4f4f4">Detail</th></tr>'
        f'{rows}</table>'
    )


def format_anomalies_for_context(anomalies: list[dict]) -> str:
    """Plain text for AI advisor — all severities."""
    if not anomalies: return "No anomalies detected."
    lines = [f"ANOMALIES ({len(anomalies)} detected):"]
    for a in anomalies:
        lines.append(f"  [{a['severity'].upper()}] {a['type']} — SKU {a['sku']} {a['product_title']}: {a['message']}")
    return "\n".join(lines)


if __name__ == "__main__":
    print("anomaly_detector: import OK")
