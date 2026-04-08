"""
amazon_pull.py
──────────────
Pulls Amazon SP-API order line items (last 90 days) and FBA inventory,
then writes them to the Google Sheet.

Required env vars:
    SP_API_REFRESH_TOKEN
    SP_API_CLIENT_ID
    SP_API_CLIENT_SECRET
    SP_API_AWS_ACCESS_KEY
    SP_API_AWS_SECRET_KEY
    SP_API_ROLE_ARN
    SP_MARKETPLACE_ID
    GOOGLE_SERVICE_ACCOUNT_JSON
    GOOGLE_SHEET_ID

Usage:
    python amazon_pull.py [--dry-run]
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

load_dotenv()

from sku_allowlist import filter_rows, is_active_sku  # noqa: E402

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

try:
    from sp_api.exceptions import SellingApiRequestThrottledException as _ThrottleEx
except ImportError:
    _ThrottleEx = None

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
log = logging.getLogger("amazon_pull")

CHANNEL = "amazon"
# LOOKBACK_DAYS is read from os.environ at call time inside pull_orders() so
# that run_pipeline.py --backfill can set it AFTER modules are imported.


# ── SP-API credential helper ──────────────────────────────────────────────────
def _sp_credentials() -> dict:
    return {
        "refresh_token": os.environ["SP_API_REFRESH_TOKEN"],
        "lwa_app_id": os.environ["SP_API_CLIENT_ID"],
        "lwa_client_secret": os.environ["SP_API_CLIENT_SECRET"],
        "aws_access_key": os.environ["SP_API_AWS_ACCESS_KEY"],
        "aws_secret_key": os.environ["SP_API_AWS_SECRET_KEY"],
        "role_arn": os.environ["SP_API_ROLE_ARN"],
    }


def _is_rate_limit_error(exc: Exception) -> bool:
    """Return True if the exception is a rate-limit / throttle error."""
    if _ThrottleEx is not None and isinstance(exc, _ThrottleEx):
        return True
    msg = str(exc).lower()
    return "429" in msg or "toomanyrequests" in msg or "quotaexceeded" in msg


# ── Orders pull ───────────────────────────────────────────────────────────────
def pull_orders() -> list[dict]:
    """Pull all orders + line items for the last LOOKBACK_DAYS days."""
    from sp_api.api import Orders
    from sp_api.base import Marketplaces

    lookback = int(os.environ.get("LOOKBACK_DAYS", 90))
    log.info("Pulling Amazon orders for last %d days", lookback)
    creds = _sp_credentials()
    marketplace_id = os.environ.get("SP_MARKETPLACE_ID", "ATVPDKIKX0DER")
    marketplace = next(
        (m for m in Marketplaces if m.marketplace_id == marketplace_id),
        Marketplaces.US,
    )
    since = (datetime.now(timezone.utc) - timedelta(days=lookback)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    @retry(
        retry=retry_if_exception(_is_rate_limit_error),
        wait=wait_exponential(multiplier=2, min=5, max=120),
        stop=stop_after_attempt(8),
    )
    def _list_orders(**kwargs):
        return Orders(credentials=creds, marketplace=marketplace).get_orders(**kwargs)

    @retry(
        retry=retry_if_exception(_is_rate_limit_error),
        wait=wait_exponential(multiplier=2, min=5, max=120),
        stop=stop_after_attempt(8),
    )
    def _list_items(order_id: str):
        return Orders(credentials=creds, marketplace=marketplace).get_order_items(
            orderId=order_id
        )

    rows: list[dict] = []
    next_token = None
    page = 0

    while True:
        page += 1
        kwargs: dict = {
            "CreatedAfter": since,
            "OrderStatuses": ["Unshipped", "PartiallyShipped", "Shipped", "Canceled"],
        }
        if next_token:
            kwargs = {"NextToken": next_token}

        try:
            resp = _list_orders(**kwargs)
        except Exception as exc:
            log.error("Failed to list orders (page %d): %s", page, exc)
            break

        orders = resp.payload.get("Orders", [])
        log.info("Orders page %d — %d orders", page, len(orders))

        for order in orders:
            order_id = order["AmazonOrderId"]
            date_str = order.get("PurchaseDate", "")[:10]
            fulfillment = order.get("FulfillmentChannel", "")

            try:
                items_resp = _list_items(order_id)
                items = items_resp.payload.get("OrderItems", [])
                time.sleep(0.2)  # 12 active SKUs — small catalog, faster is fine
            except Exception as exc:
                log.warning("Could not fetch items for order %s: %s", order_id, exc)
                continue

            for item in items:
                sku = item.get("SellerSKU") or ""
                rows.append(
                    {
                        "date": date_str,
                        "order_id": order_id,
                        "sku": sku,
                        "product_title": item.get("Title", ""),
                        "quantity": int(item.get("QuantityOrdered", 0)),
                        "channel": CHANNEL,
                        "fulfillment_channel": fulfillment,
                    }
                )

        next_token = resp.payload.get("NextToken")
        if not next_token:
            break
        time.sleep(1)

    before = len(rows)
    rows = filter_rows(rows)
    log.info(
        "Filtered to %d active SKU rows (dropped %d archived/draft variants).",
        len(rows), before - len(rows),
    )
    log.info("Pulled %d Amazon order line items.", len(rows))
    return rows


# ── FBA inventory pull ────────────────────────────────────────────────────────
def pull_fba_inventory() -> dict[str, int]:
    """Return {seller_sku → total_quantity} from FBA inventory summaries."""
    from sp_api.api import Inventories
    from sp_api.base import Marketplaces

    creds = _sp_credentials()
    marketplace_id = os.environ.get("SP_MARKETPLACE_ID", "ATVPDKIKX0DER")
    marketplace = next(
        (m for m in Marketplaces if m.marketplace_id == marketplace_id),
        Marketplaces.US,
    )

    @retry(
        retry=retry_if_exception(_is_rate_limit_error),
        wait=wait_exponential(multiplier=2, min=5, max=120),
        stop=stop_after_attempt(8),
    )
    def _get_summaries(**kwargs):
        return Inventories(credentials=creds, marketplace=marketplace).get_inventory_summary_marketplace(
            **kwargs
        )

    sku_stock: dict[str, int] = {}
    next_token = None
    page = 0

    while True:
        page += 1
        kwargs: dict = {"details": False, "granularityType": "Marketplace", "granularityId": marketplace_id}
        if next_token:
            kwargs["nextToken"] = next_token

        try:
            resp = _get_summaries(**kwargs)
        except Exception as exc:
            log.error("Failed to fetch FBA inventory (page %d): %s", page, exc)
            break

        summaries = resp.payload.get("inventorySummaries", [])
        log.info("FBA inventory page %d — %d summaries", page, len(summaries))

        for item in summaries:
            sku = item.get("sellerSku") or ""
            qty = int(item.get("totalQuantity", 0))
            if sku:
                sku_stock[sku] = sku_stock.get(sku, 0) + qty

        next_token = resp.payload.get("pagination", {}).get("nextToken")
        if not next_token:
            break
        time.sleep(1)

    before = len(sku_stock)
    sku_stock = {k: v for k, v in sku_stock.items() if is_active_sku(k)}
    log.info(
        "Filtered FBA inventory to %d active SKUs (dropped %d archived/draft variants).",
        len(sku_stock), before - len(sku_stock),
    )
    log.info("Pulled FBA stock for %d SKUs.", len(sku_stock))
    return sku_stock



# ── Main ──────────────────────────────────────────────────────────────────────
def run(dry_run: bool = False) -> dict:
    log.info("=== Amazon Pull started ===")

    required = [
        "SP_API_REFRESH_TOKEN", "SP_API_CLIENT_ID", "SP_API_CLIENT_SECRET",
        "SP_API_AWS_ACCESS_KEY", "SP_API_AWS_SECRET_KEY",
        "SP_API_ROLE_ARN", "SP_MARKETPLACE_ID",
    ]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        raise EnvironmentError(f"Missing SP-API env vars: {', '.join(missing)}")

    order_rows = pull_orders()
    fba_stock = pull_fba_inventory()

    if dry_run:
        log.info("[DRY RUN] Would pass %d order rows to calculator.", len(order_rows))
        log.info("[DRY RUN] Would pass %d FBA SKU stock levels to calculator.", len(fba_stock))
        return {"source": "amazon", "records_pulled": len(order_rows), "status": "dry_run"}

    log.info("=== Amazon Pull complete: %d order rows, %d FBA SKUs ===", len(order_rows), len(fba_stock))
    return {
        "source": "amazon",
        "records_pulled": len(order_rows),
        "status": "ok",
        "rows": order_rows,
        "fba_stock_by_sku": fba_stock,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
