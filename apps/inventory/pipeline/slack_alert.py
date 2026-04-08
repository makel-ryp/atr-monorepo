"""
slack_alert.py
Slack alert notifier for the inventory pipeline.

Usage:
    python slack_alert.py [--dry-run]
"""

import argparse
import json
import logging
import os
from datetime import date, datetime
from pathlib import Path

log = logging.getLogger(__name__)

DEDUP_FILE = Path("alert_dedup.json")


# ---------------------------------------------------------------------------
# Deduplication helpers
# ---------------------------------------------------------------------------

def load_dedup() -> dict:
    """Load {sku: 'YYYY-MM-DD'} from DEDUP_FILE. Return {} if not exists."""
    if not DEDUP_FILE.exists():
        return {}
    try:
        with DEDUP_FILE.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:
        log.warning("Could not load dedup file %s: %s", DEDUP_FILE, exc)
        return {}


def save_dedup(dedup: dict) -> None:
    """Write dedup dict to DEDUP_FILE with pretty indentation."""
    try:
        with DEDUP_FILE.open("w", encoding="utf-8") as fh:
            json.dump(dedup, fh, indent=2)
        log.debug("Saved dedup file to %s.", DEDUP_FILE)
    except Exception as exc:
        log.warning("Could not save dedup file %s: %s", DEDUP_FILE, exc)


def should_alert(sku: str, dedup: dict, cooldown_days: int = 7) -> bool:
    """Return True if this SKU has not been alerted within the cooldown window."""
    if sku not in dedup:
        return True
    try:
        last_date = date.fromisoformat(dedup[sku])
        return (date.today() - last_date).days > cooldown_days
    except (ValueError, TypeError) as exc:
        log.warning("Invalid dedup date for SKU %s: %s", sku, exc)
        return True


# ---------------------------------------------------------------------------
# Slack message builder
# ---------------------------------------------------------------------------

def build_slack_message(alerts: list[dict]) -> dict:
    """
    Build a Slack Block Kit payload for the given alerts list.

    Sorts alerts by days_until_stockout ascending, caps at 10 items.
    """
    today_str = date.today().isoformat()
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    n_skus = len(alerts)

    sorted_alerts = sorted(
        alerts,
        key=lambda a: float(a.get("days_until_stockout") or 9999),
    )[:10]

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"\U0001f6a8 Inventory Alert \u2014 {today_str} \u2014 {n_skus} SKUs need reordering",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"Run generated at {timestamp_str}",
            },
        },
        {"type": "divider"},
    ]

    for alert in sorted_alerts:
        sku = str(alert.get("sku", ""))
        product_title = str(alert.get("product_title", ""))
        days = float(alert.get("days_until_stockout") or 0)
        months = days / 30.0
        qty = int(alert.get("recommended_reorder_qty") or alert.get("reorder_qty_9mo") or 0)

        days_text = f"*{days:.0f}d*" if days < 30 else f"{days:.0f}d"

        block_text = (
            f"*{sku}* \u2014 {product_title}\n"
            f"\u2022 Days of stock: {days_text} (months: {months:.1f}mo)\n"
            f"\u2022 Recommended reorder (9-mo): {qty:,} units"
        )

        blocks.append(
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": block_text,
                },
            }
        )

    blocks += [
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "Full report sent via email | Rypstick Golf Inventory Pipeline",
                }
            ],
        },
    ]

    return {"blocks": blocks}


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

def run(alerts: list[dict], dry_run: bool = False) -> dict:
    """
    Send inventory alerts to Slack via an incoming webhook.

    Handles deduplication (7-day cooldown per SKU).
    Returns a run-log-compatible dict.
    """
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        log.info("SLACK_WEBHOOK_URL not set \u2014 skipping Slack alerts.")
        return {"source": "slack", "records_pulled": 0, "status": "ok"}

    dedup = load_dedup()
    to_alert = [a for a in alerts if should_alert(str(a.get("sku", "")), dedup)]

    if not to_alert:
        log.info("No new Slack alerts (all SKUs recently notified or no alerts).")
        return {"source": "slack", "records_pulled": 0, "status": "ok"}

    message = build_slack_message(to_alert)

    if dry_run:
        log.info("[DRY RUN] Would POST %d alerts to Slack.", len(to_alert))
        log.debug("Dry-run payload: %s", json.dumps(message, indent=2))
        return {"source": "slack", "records_pulled": len(to_alert), "status": "dry_run"}

    import requests  # noqa: PLC0415

    try:
        resp = requests.post(webhook_url, json=message, timeout=10)
    except requests.RequestException as exc:
        log.error("Slack POST raised an exception: %s", exc)
        return {"source": "slack", "records_pulled": 0, "status": "error"}

    if resp.status_code == 200:
        today_str = date.today().isoformat()
        for a in to_alert:
            dedup[str(a.get("sku", ""))] = today_str
        save_dedup(dedup)
        log.info("Sent %d Slack alerts successfully.", len(to_alert))
        return {"source": "slack", "records_pulled": len(to_alert), "status": "ok"}
    else:
        log.error(
            "Slack POST failed: %s %s",
            resp.status_code,
            resp.text[:200],
        )
        return {"source": "slack", "records_pulled": 0, "status": "error"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Send inventory alerts to Slack."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and log the Slack message without actually sending it.",
    )
    args = parser.parse_args()

    # Example: pass in a sample alert to test the notifier.
    sample_alerts: list[dict] = []
    result = run(sample_alerts, dry_run=args.dry_run)
    log.info("Result: %s", result)
