"""
advisor_context.py
──────────────────
Builds AI advisor system prompt + live inventory snapshot.
Reads from SQLite via db_writer.DB_PATH — no Google Sheets.

Functions:
  build_inventory_snapshot() -> str   plain-text snapshot
  build_system_prompt()      -> str   full prompt for Claude
  get_reorder_suggestions()  -> list  structured action items
"""

import datetime
import sqlite3
from pathlib import Path

import db_writer

DB_PATH = db_writer.DB_PATH

# ── Season helpers ────────────────────────────────────────────────────────────
_MONTH_NAMES = {
    1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
    7:"July",8:"August",9:"September",10:"October",11:"November",12:"December",
}

_RYP_PEAK  = {10,11,12,1,2,3}
_RYP_OFFPK = {6,7,8}
_BB_PEAK   = {4,5,6,7,8,9}
_BB_OFFPK  = {11,12,1,2}

def _ryp_phase(m):
    if m in _RYP_PEAK:  return f"PEAK (+35% velocity) — {_MONTH_NAMES[m]}"
    if m in _RYP_OFFPK: return f"OFF-PEAK (-26% velocity) — {_MONTH_NAMES[m]}"
    return f"SHOULDER (base velocity) — {_MONTH_NAMES[m]}"

def _bb_phase(m):
    if m in _BB_PEAK:   return f"PEAK (+30% velocity) — {_MONTH_NAMES[m]}"
    if m in _BB_OFFPK:  return f"OFF-PEAK (-23% velocity) — {_MONTH_NAMES[m]}"
    return f"SHOULDER (base velocity) — {_MONTH_NAMES[m]}"

def _safe(val, default=0):
    try: return float(val) if val not in ("", None, "N/A") else default
    except (TypeError, ValueError): return default

def _fmt_date(val):
    if not val or str(val).strip() in ("", "N/A", "None"): return "not set"
    return str(val).strip()


# ── SQLite helpers ────────────────────────────────────────────────────────────
def _read_table(table: str) -> list[dict]:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
        conn.close()
        return [dict(r) for r in rows]
    except Exception as exc:
        return []


# ── Static company context ────────────────────────────────────────────────────
_STATIC = """\
COMPANY: Rypstick Golf
Products: golf training aids
Channels: Shopify DTC, Amazon FBA (no FBM), B2B via EDI/SPS Commerce
Currency: USD

BUSINESS RULES:
- Lead time: 135 days order to warehouse receipt
- Lead time buffer: 14 days safety margin
- FBA check-in: additional 7 days after warehouse receipt
- Total lead time to FBA availability: 156 days
- Reorder trigger: months_of_stock < 4.5 months
- Max stock: never exceed 15.5 months
- Min order: always meet MOQ, round up to carton size

ORDER QUANTITIES (MOQ / Carton / Half-Carton):
- Rypstick (SKUs 2,3,4,5):            MOQ 300 / Carton 50 / Half 25
- ButterBlade (SKUs 40,41,42,46,47,48): MOQ 300 / Carton 50 / Half 25
- Ryp Radar (SKU 12):                  MOQ 100 / Carton 20
- Foamies (SKU 52):                    REORDER EXEMPT — 475 months on hand

PRODUCT SEASONALITY (critical for correct interpretation):

RYPSTICK + RYPR RADAR (SKUs 2, 3, 4, 5, 12):
  Out-of-season training product. People train when NOT on the course.
  Peak season:    October to March   (+35% velocity)
  Off-peak:       June to August     (-26% velocity)
  Shoulder:       April, May, September (base velocity)
  Low summer velocity = EXPECTED. High summer velocity = anomaly.

BUTTERBLADE (SKUs 40, 41, 42, 46, 47, 48):
  In-season putting trainer. Used while actively playing.
  Peak season:    April to September  (+30% velocity)
  Off-peak:       November to February (-23% velocity)
  Shoulder:       March, October (base velocity)
  Low winter velocity = EXPECTED. High winter velocity = anomaly.

ETA LOGIC:
- "Order by date" = planning estimate using 135-day default.
- "Confirmed ETA" = actual supplier-confirmed arrival (always use over estimate).
- Lead time risk: Chinese New Year (Jan/Feb), sea vs air freight, port delays.\
"""


def build_inventory_snapshot() -> str:
    """Load live data from SQLite and return a plain-text snapshot."""
    try:
        master = _read_table("inventory_master")
    except Exception as exc:
        return f"[Inventory data unavailable: {exc}]"

    pipeline_rows = [r for r in _read_table("stock_pipeline")
                     if str(r.get("active", "")).upper() == "TRUE"]

    pipe_by_sku: dict = {}
    for pr in pipeline_rows:
        sku = str(pr.get("sku", "")).strip().lstrip("0") or "0"
        pipe_by_sku.setdefault(sku, []).append(pr)

    today = datetime.date.today()
    lines = [f"LIVE INVENTORY SNAPSHOT — {today.isoformat()}\n{'='*50}"]

    active_skus = {"2","3","4","5","12","40","41","42","46","47","48","52"}
    active_rows = [r for r in master
                   if str(r.get("sku","")).strip().lstrip("0") in active_skus]
    active_rows.sort(key=lambda r: int(str(r.get("sku",0)).strip().lstrip("0") or 0))

    for r in active_rows:
        sku = str(r.get("sku","")).strip().lstrip("0") or "0"
        title = r.get("product_title","")
        exempt = sku == "52"

        current_stock = int(_safe(r.get("current_stock",0)))
        months_current = _safe(r.get("months_of_stock", 0))

        wh_incoming  = sum(int(_safe(p.get("qty_to_warehouse",0))) for p in pipe_by_sku.get(sku,[]))
        fba_incoming = sum(int(_safe(p.get("qty_to_fba",0)))       for p in pipe_by_sku.get(sku,[]))
        total_pipeline = wh_incoming + fba_incoming
        total_w_pipe = current_stock + total_pipeline
        velocity = _safe(r.get("avg_monthly_velocity",0))
        months_w_pipe = (total_w_pipe / velocity) if velocity > 0 else 9999

        next_arrivals = sorted([
            p.get("expected_arrival_warehouse","") for p in pipe_by_sku.get(sku,[])
            if p.get("expected_arrival_warehouse","")
        ])
        next_arrival = next_arrivals[0] if next_arrivals else "none scheduled"

        order_status = str(r.get("order_status","ok")).upper()
        order_by     = _fmt_date(r.get("order_by_date",""))
        days_deadline = int(_safe(r.get("days_until_order_deadline",9999)))
        forecast_90  = _safe(r.get("forecast_90d",0))
        vel_adj      = _safe(r.get("velocity_season_adjusted", velocity))
        reorder_9    = int(_safe(r.get("reorder_qty_9mo_adj",0)))
        reorder_12   = int(_safe(r.get("reorder_qty_12mo_adj",0)))
        stockout     = _fmt_date(r.get("stockout_date",""))
        trend        = r.get("velocity_trend","")
        yoy          = _safe(r.get("yoy_change_pct",0))

        lines.append(f"\nSKU {sku} — {title}")
        if exempt:
            lines.append("  STATUS: REORDER EXEMPT (Foamies — 475 months on hand)")
            lines.append(f"  On hand: {current_stock:,} units")
        else:
            lines.append(f"  On hand:              {current_stock:,} units")
            lines.append(f"  Pipeline incoming:    {wh_incoming:,} warehouse + {fba_incoming:,} FBA")
            lines.append(f"  Total w/ pipeline:    {total_w_pipe:,} units")
            lines.append(f"  Months of stock:      {months_w_pipe:.1f} mo (current only: {months_current:.1f} mo)")
            lines.append(f"  Monthly velocity:     {velocity:.0f} units/mo (season-adj: {vel_adj:.0f})")
            lines.append(f"  90-day forecast:      {forecast_90:.0f} units")
            lines.append(f"  Order status:         {order_status}")
            lines.append(f"  Order by:             {order_by} ({days_deadline} days)")
            lines.append(f"  Stockout date:        {stockout}")
            lines.append(f"  Reorder qty (9mo):    {reorder_9:,} units")
            lines.append(f"  Reorder qty (12mo):   {reorder_12:,} units")
            lines.append(f"  Next arrival:         {next_arrival}")
            if trend: lines.append(f"  Velocity trend:       {trend}")
            if yoy:   lines.append(f"  YoY change:           {yoy:+.1f}%")

    lines.append(f"\n{'='*50}\nACTIVE PIPELINE ENTRIES:")
    if pipeline_rows:
        for p in pipeline_rows:
            sku = str(p.get("sku","")).strip().lstrip("0") or "0"
            lines.append(
                f"  SKU {sku} {p.get('product_title','')}: "
                f"{int(_safe(p.get('total_quantity',0))):,} units ({p.get('type','')})"
                f"\n    Warehouse arrival: {_fmt_date(p.get('expected_arrival_warehouse',''))}"
                f"  |  FBA arrival: {_fmt_date(p.get('expected_arrival_fba',''))}"
                f"\n    PO: {p.get('po_number','not specified')}"
            )
    else:
        lines.append("  No stock in transit.")

    critical = [r for r in active_rows
                if str(r.get("order_status","")).lower() in ("critical","warning")
                and str(r.get("sku","")).strip().lstrip("0") != "52"]
    lines.append(f"\n{'='*50}\nCRITICAL ALERTS:")
    if critical:
        for r in sorted(critical, key=lambda x: int(_safe(x.get("days_until_order_deadline",9999)))):
            sku = str(r.get("sku","")).strip().lstrip("0") or "0"
            status = str(r.get("order_status","")).upper()
            days = int(_safe(r.get("days_until_order_deadline",9999)))
            reorder_9 = int(_safe(r.get("reorder_qty_9mo_adj",0)))
            order_by = _fmt_date(r.get("order_by_date",""))
            lines.append(
                f"  [{status}] SKU {sku} {r.get('product_title','')}: "
                f"{days} days to deadline\n"
                f"    Order {reorder_9:,} units by {order_by}"
            )
    else:
        lines.append("  No critical alerts at this time.")

    m = today.month
    lines.append(
        f"\n{'='*50}\nTODAY: {today.isoformat()}\n"
        f"RYPSTICK/RADAR SEASON: {_ryp_phase(m)}\n"
        f"BUTTERBLADE SEASON:    {_bb_phase(m)}"
    )

    return "\n".join(lines)


_ROLE_INSTRUCTIONS = """\
You are an inventory advisor for Rypstick Golf. Help the buying and leadership \
team make fast, confident decisions.

RESPONSE STYLE:
- Direct and data-driven. Lead with numbers, not narrative.
- No filler ("Great question!", "Certainly!", "Of course!")
- Get to the point. Explain only when asked.
- When recommending order quantities always show math:
  velocity x target months - current stock = raw qty -> rounded to carton -> final order qty
- Flag urgency: CRITICAL / WARNING / OK
- State most likely conclusion first, alternatives briefly.

WHAT YOU CAN DO:
- Answer questions about inventory, velocity, forecasts
- Suggest order quantities using confirmed business rules
- Draft reorder summaries the user can copy into a PO/email
- Compare Shopify vs Amazon channel performance
- Identify seasonal risks and opportunities

ORDER QUANTITY FORMAT — always use this exact format:
  SKU {N} — {product_title}
  Current stock (w/pipeline): {X} units ({Y} months)
  Season-adjusted velocity: {Z} units/mo
  Raw quantity needed (9mo): {A} units
  After MOQ + carton rounding: {B} units  <- ORDER THIS
  Order by: {date}

WHAT YOU CANNOT DO:
- Place orders or trigger system actions
- Access data not in this context
- Predict external events not in sales data

CRITICAL: Never invent numbers. If a metric is not in the context, say \
"that data isn't in my current snapshot — run the pipeline and check back." \
Never guess.\
"""


def build_system_prompt() -> str:
    """Full system prompt: role + static rules + live snapshot."""
    snapshot = build_inventory_snapshot()
    return f"{_ROLE_INSTRUCTIONS}\n\n{_STATIC}\n\n{snapshot}"


def get_reorder_suggestions() -> list[dict]:
    """Return structured list of critical/warning SKUs sorted by urgency."""
    try:
        master = _read_table("inventory_master")
        pipeline_rows = [r for r in _read_table("stock_pipeline")
                         if str(r.get("active","")).upper() == "TRUE"]
    except Exception:
        return []

    pipe_by_sku: dict = {}
    for p in pipeline_rows:
        sku = str(p.get("sku","")).strip().lstrip("0") or "0"
        pipe_by_sku.setdefault(sku, []).append(p)

    results = []
    for r in master:
        sku = str(r.get("sku","")).strip().lstrip("0") or "0"
        if sku == "52": continue
        status = str(r.get("order_status","")).lower()
        if status not in ("critical","warning"): continue
        next_arrivals = sorted([p.get("expected_arrival_warehouse","")
                                for p in pipe_by_sku.get(sku,[])
                                if p.get("expected_arrival_warehouse","")])
        current = int(_safe(r.get("current_stock",0)))
        wh  = sum(int(_safe(p.get("qty_to_warehouse",0))) for p in pipe_by_sku.get(sku,[]))
        fba = sum(int(_safe(p.get("qty_to_fba",0)))       for p in pipe_by_sku.get(sku,[]))
        velocity = _safe(r.get("avg_monthly_velocity",0))
        vel_adj  = _safe(r.get("velocity_season_adjusted",velocity))
        months_w_pipe = ((current+wh+fba)/velocity) if velocity > 0 else 9999
        results.append({
            "sku": sku,
            "product_title": r.get("product_title",""),
            "order_status": status,
            "days_until_deadline": int(_safe(r.get("days_until_order_deadline",9999))),
            "order_by_date": _fmt_date(r.get("order_by_date","")),
            "reorder_qty_9mo_adj":  int(_safe(r.get("reorder_qty_9mo_adj",0))),
            "reorder_qty_12mo_adj": int(_safe(r.get("reorder_qty_12mo_adj",0))),
            "months_of_stock_with_pipeline": round(months_w_pipe, 1),
            "velocity_season_adjusted": round(vel_adj, 1),
            "next_arrival_date": next_arrivals[0] if next_arrivals else None,
        })
    results.sort(key=lambda x: x["days_until_deadline"])
    return results


if __name__ == "__main__":
    print(build_system_prompt())
