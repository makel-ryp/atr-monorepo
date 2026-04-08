"""
email_report.py
───────────────
Sends a weekly HTML inventory summary email.

Tries SendGrid first (if SENDGRID_API_KEY is set), falls back to Gmail SMTP.
Reads inventory data from SQLite via db_writer.DB_PATH — no Google Sheets.

Required env vars:
    EMAIL_FROM
    EMAIL_TO          — comma-separated
    EMAIL_PASSWORD    — Gmail App Password (if not using SendGrid)
    SENDGRID_API_KEY  — takes precedence over Gmail (optional)

Usage:
    python email_report.py [--dry-run]
"""

import logging
import os
import smtplib
import sqlite3
import sys
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

load_dotenv()

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
log = logging.getLogger("email_report")

# ── Row colour thresholds (mirrors old spreadsheet conditional formatting) ────
# Red:         < 4.5 months = < 135 days  — must reorder
# Yellow:      < 5.5 months = < 165 days  — low, approaching threshold
# Light green: < 6.5 months = < 195 days  — acceptable, worth watching
# (No class)   ≥ 6.5 months = ≥ 195 days  — healthy stock
RED_THRESHOLD    = 135   # days  (4.5 months)
YELLOW_THRESHOLD = 165   # days  (5.5 months)
GREEN_THRESHOLD  = 195   # days  (6.5 months)

# ── Styles ────────────────────────────────────────────────────────────────────
CSS = """
body { font-family: Arial, sans-serif; font-size: 14px; color: #222; }
h2 { color: #2c3e50; }
.summary { background: #f4f6f8; padding: 12px 16px; border-radius: 6px;
           margin-bottom: 20px; line-height: 1.8; }
table { border-collapse: collapse; width: 100%; }
th { background: #2c3e50; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
td { padding: 8px 14px; border-bottom: 1px solid #ddd; }
tr.red         td { background: #fde8e8; }
tr.yellow      td { background: #fefde2; }
tr.light-green td { background: #d9ead3; }
tr:hover td { filter: brightness(0.96); }
.footnote { color: #888; font-size: 12px; margin-top: 10px; }
"""


# ── SQLite helpers ────────────────────────────────────────────────────────────
def _read_table(table: str) -> list[dict]:
    try:
        conn = sqlite3.connect(str(db_writer.DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
        conn.close()
        return [dict(r) for r in rows]
    except Exception as exc:
        log.warning("Could not read %s from SQLite: %s", table, exc)
        return []


def _safe_float(val) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def load_watch_skus() -> list[dict]:
    """
    Return active inventory_master rows worth showing in the email:
    - days_of_stock < GREEN_THRESHOLD (< 195 days / 6.5 months)
    Sorted by days_of_stock ascending so most urgent appear first.
    """
    from sku_allowlist import ACTIVE_SKUS
    records = _read_table("inventory_master")
    watch = [
        r for r in records
        if str(r.get("sku", "")).strip().lstrip("0") in ACTIVE_SKUS
        and _safe_float(r.get("days_of_stock", 9999)) < GREEN_THRESHOLD
        and r.get("product_title", "").strip()
    ]
    watch.sort(key=lambda x: _safe_float(x.get("days_of_stock", 9999)))
    flagged_count = sum(1 for r in watch if str(r.get("reorder_flag", "")).lower() == "true")
    log.info("Found %d watch-level SKUs (%d flagged for reorder) in inventory_master.", len(watch), flagged_count)
    return watch


def load_all_skus() -> list[dict]:
    from sku_allowlist import ACTIVE_SKUS
    records = _read_table("inventory_master")
    return [r for r in records if str(r.get("sku", "")).strip().lstrip("0") in ACTIVE_SKUS]


# ── HTML builder ──────────────────────────────────────────────────────────────
def _row_class(days: float) -> str:
    if days < RED_THRESHOLD:
        return "red"
    if days < YELLOW_THRESHOLD:
        return "yellow"
    if days < GREEN_THRESHOLD:
        return "light-green"
    return ""


def build_html(watch_skus: list[dict], all_skus: list[dict], report_date: date,
               anomaly_html: str = "") -> str:
    total_skus = len(all_skus)
    must_reorder = sum(1 for r in watch_skus if str(r.get("reorder_flag", "")).lower() == "true")

    rows_html = ""
    for r in watch_skus:  # already sorted by days_of_stock
        days      = _safe_float(r.get("days_of_stock", 9999))
        months    = _safe_float(r.get("months_of_stock", 9999))
        cls       = _row_class(days)
        reorder_9  = int(_safe_float(r.get("reorder_qty_9mo",  0)))
        reorder_12 = int(_safe_float(r.get("reorder_qty_12mo", 0)))
        velocity   = _safe_float(r.get("avg_monthly_velocity", 0))
        order_by   = r.get("order_by_date", "") or r.get("stockout_date", "")

        rows_html += f"""
        <tr class="{cls}">
          <td>{r.get('product_title', '')}</td>
          <td style="text-align:right">{int(_safe_float(r.get('current_stock', 0))):,}</td>
          <td style="text-align:right">{months:.1f} mo</td>
          <td style="text-align:right">{velocity:.0f}/mo</td>
          <td style="text-align:right">{order_by}</td>
          <td style="text-align:right">{"—" if reorder_9 == 0 else f"{reorder_9:,}"}</td>
          <td style="text-align:right">{"—" if reorder_12 == 0 else f"{reorder_12:,}"}</td>
        </tr>"""

    if not rows_html:
        rows_html = '<tr><td colspan="7" style="text-align:center;color:#888;">All SKUs have healthy stock levels ✓</td></tr>'

    legend = (
        f'<span style="display:inline-block;width:12px;height:12px;background:#fde8e8;border:1px solid #ccc;vertical-align:middle"></span>'
        f'&nbsp;Red = &lt;4.5 mo &nbsp;'
        f'<span style="display:inline-block;width:12px;height:12px;background:#fefde2;border:1px solid #ccc;vertical-align:middle"></span>'
        f'&nbsp;Yellow = &lt;5.5 mo &nbsp;'
        f'<span style="display:inline-block;width:12px;height:12px;background:#d9ead3;border:1px solid #ccc;vertical-align:middle"></span>'
        f'&nbsp;Green = &lt;6.5 mo'
    )

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>{CSS}</style></head>
<body>
  <h2>⛳ Rypstick Golf — Inventory Report</h2>
  <p style="color:#555;margin-top:-10px;">{report_date.strftime('%B %d, %Y')}</p>
  {anomaly_html}
  <div class="summary">
    <strong>{total_skus} active SKUs</strong> &nbsp;|&nbsp;
    <strong style="color:#c0392b">{must_reorder} need reordering</strong> &nbsp;|&nbsp;
    {legend}
  </div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:right">On Hand</th>
        <th style="text-align:right">Stock</th>
        <th style="text-align:right">Velocity</th>
        <th style="text-align:right">Order By</th>
        <th style="text-align:right">Order Qty (9mo)</th>
        <th style="text-align:right">Order Qty (12mo)</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
  <p class="footnote">
    Order quantities include the 135-day China lead time. Reorder = units needed to maintain 9 or 12 months
    of forward stock after the shipment arrives. &nbsp;|&nbsp; Only SKUs below 6.5 months are shown.
  </p>
  <p style="color:#bbb;font-size:11px;margin-top:4px;">
    Generated {report_date.isoformat()} by Rypstick Inventory Pipeline. Do not reply.
  </p>
</body>
</html>"""


# ── Email senders ─────────────────────────────────────────────────────────────
def send_via_sendgrid(subject: str, html_body: str, from_addr: str, to_addrs: list[str]) -> None:
    import sendgrid
    from sendgrid.helpers.mail import Content, Email, Mail, To

    api_key = os.environ["SENDGRID_API_KEY"]
    sg = sendgrid.SendGridAPIClient(api_key=api_key)
    mail = Mail(
        from_email=Email(from_addr),
        subject=subject,
    )
    for addr in to_addrs:
        mail.add_to(To(addr.strip()))
    mail.add_content(Content("text/html", html_body))
    response = sg.client.mail.send.post(request_body=mail.get())
    log.info("SendGrid response status: %s", response.status_code)
    if response.status_code not in (200, 202):
        raise RuntimeError(f"SendGrid error {response.status_code}: {response.body}")


def send_via_gmail(subject: str, html_body: str, from_addr: str, to_addrs: list[str]) -> None:
    password = os.environ.get("EMAIL_PASSWORD")
    if not password:
        raise EnvironmentError("EMAIL_PASSWORD must be set for Gmail SMTP.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_addrs)
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(from_addr, password)
        server.sendmail(from_addr, to_addrs, msg.as_string())
    log.info("Email sent via Gmail SMTP to: %s", ", ".join(to_addrs))


# ── Main ──────────────────────────────────────────────────────────────────────
def run(dry_run: bool = False, pipeline_warnings: int = 0) -> dict:
    log.info("=== Email Reporter started ===")

    from_addr = os.environ.get("EMAIL_FROM", "")
    to_str = os.environ.get("EMAIL_TO", "")
    if not from_addr or not to_str:
        raise EnvironmentError("EMAIL_FROM and EMAIL_TO must be set.")
    to_addrs = [a.strip() for a in to_str.split(",") if a.strip()]

    all_skus = load_all_skus()
    watch_skus = load_watch_skus()
    must_reorder = sum(1 for r in watch_skus if str(r.get("reorder_flag", "")).lower() == "true")

    # Run anomaly detection
    anomaly_html = ""
    anomaly_count = 0
    try:
        from anomaly_detector import detect_anomalies, format_anomalies_for_email
        anomalies = detect_anomalies(inventory_df=all_skus)
        anomaly_count = len([a for a in anomalies if a.get("severity") in ("critical","warning")])
        anomaly_html = format_anomalies_for_email(anomalies)
    except Exception as exc:
        log.warning("Anomaly detection failed: %s", exc)

    report_date = date.today()
    anomaly_suffix = f" — {anomaly_count} anomal{'y' if anomaly_count==1 else 'ies'}" if anomaly_count > 0 else ""
    warn_suffix = f" — {pipeline_warnings} pipeline warning(s)" if pipeline_warnings else ""
    subject = f"Inventory Report — {report_date.isoformat()} — {must_reorder} reorder alert(s){anomaly_suffix}{warn_suffix}"
    html_body = build_html(watch_skus, all_skus, report_date, anomaly_html=anomaly_html)

    if dry_run:
        log.info("[DRY RUN] Would send email: '%s' → %s", subject, to_addrs)
        log.info("[DRY RUN] Email body preview (first 500 chars):\n%s", html_body[:500])
        return {"source": "email", "records_pulled": len(watch_skus), "status": "dry_run"}

    if os.environ.get("SENDGRID_API_KEY"):
        log.info("Using SendGrid to send email.")
        send_via_sendgrid(subject, html_body, from_addr, to_addrs)
    else:
        log.info("Using Gmail SMTP to send email.")
        send_via_gmail(subject, html_body, from_addr, to_addrs)

    log.info("=== Email Reporter complete ===")
    return {"source": "email", "records_pulled": len(watch_skus), "status": "ok"}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
