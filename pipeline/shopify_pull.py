"""
shopify_pull.py
───────────────
Pulls Shopify order line items (last 90 days) and current inventory levels,
then writes them to the Google Sheet.

Required env vars:
    SHOPIFY_SHOP_NAME      — myshopify subdomain, e.g. "my-store"
    SHOPIFY_ACCESS_TOKEN   — Admin API access token (shpat_...)
    GOOGLE_SERVICE_ACCOUNT_JSON
    GOOGLE_SHEET_ID

Usage:
    python shopify_pull.py [--dry-run]
"""

import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from typing import Generator

import requests
from dotenv import load_dotenv

load_dotenv()

from sku_allowlist import filter_rows, is_active_sku, ACTIVE_SKUS  # noqa: E402

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# ── Logging ──────────────────────────────────────────────────────────────────
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
log = logging.getLogger("shopify_pull")

# ── Constants ─────────────────────────────────────────────────────────────────
API_VERSION = "2024-01"
CHANNEL = "shopify"
# LOOKBACK_DAYS is intentionally NOT set at module level — it is read from
# os.environ at call time inside pull_orders() so that run_pipeline.py can
# set LOOKBACK_DAYS=180 for --backfill AFTER modules are already imported.
# Shopify leaky bucket: burst 40, sustained 2/sec.  We stay safely below with
# a small sleep after each call; tenacity handles 429 responses.
CALL_SLEEP = 0.6  # seconds between pages


class ShopifyRateLimitError(Exception):
    pass


# ── Shopify client ────────────────────────────────────────────────────────────
class ShopifyClient:
    def __init__(self, shop_name: str, access_token: str) -> None:
        self.base = f"https://{shop_name}.myshopify.com/admin/api/{API_VERSION}"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "X-Shopify-Access-Token": access_token,
                "Content-Type": "application/json",
            }
        )

    @retry(
        retry=retry_if_exception_type(ShopifyRateLimitError),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(8),
    )
    def _get(self, url: str, params: dict | None = None) -> requests.Response:
        resp = self.session.get(url, params=params, timeout=30)
        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", 4))
            log.warning("Rate limited by Shopify — sleeping %.1fs", retry_after)
            time.sleep(retry_after)
            raise ShopifyRateLimitError("429")
        resp.raise_for_status()
        time.sleep(CALL_SLEEP)
        return resp

    def paginate(self, endpoint: str, params: dict | None = None) -> Generator[list, None, None]:
        """Cursor-based pagination via Link header.  Yields each page's items."""
        url = f"{self.base}/{endpoint}"
        params = {**(params or {}), "limit": 250}
        while url:
            resp = self._get(url, params=params)
            data = resp.json()
            # The top-level key matches the endpoint resource name
            key = next(iter(data))
            yield data[key]
            # Parse the 'next' cursor from the Link header
            link_header = resp.headers.get("Link", "")
            next_url = _extract_next_link(link_header)
            url = next_url
            params = {}  # cursor URL already contains query params

    def get_json(self, endpoint: str, params: dict | None = None) -> dict:
        url = f"{self.base}/{endpoint}"
        return self._get(url, params=params).json()


def _extract_next_link(link_header: str) -> str | None:
    """Return the 'next' URL from a Shopify Link header, or None."""
    if not link_header:
        return None
    for part in link_header.split(","):
        part = part.strip()
        m = re.match(r'<([^>]+)>;\s*rel="next"', part)
        if m:
            return m.group(1)
    return None


# ── Pull orders ───────────────────────────────────────────────────────────────
def pull_orders(client: ShopifyClient) -> list[dict]:
    """Return order line-item rows for the last LOOKBACK_DAYS days."""
    lookback = int(os.environ.get("LOOKBACK_DAYS", 90))
    log.info("Pulling Shopify orders for last %d days", lookback)
    since = (datetime.now(timezone.utc) - timedelta(days=lookback)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    rows: list[dict] = []
    params = {
        "status": "any",
        "created_at_min": since,
        "fields": "id,created_at,line_items",
    }
    page_num = 0
    for page in client.paginate("orders.json", params=params):
        page_num += 1
        for order in page:
            order_id = str(order["id"])
            date = order["created_at"][:10]
            for item in order.get("line_items", []):
                sku = item.get("sku") or ""
                if not sku.strip():
                    continue  # blank/None SKU — drop before allowlist filter
                rows.append(
                    {
                        "date": date,
                        "order_id": order_id,
                        "sku": sku,
                        "product_title": item.get("title", ""),
                        "variant_title": item.get("variant_title", ""),
                        "quantity": int(item.get("quantity", 0)),
                        "channel": CHANNEL,
                    }
                )
        log.info("Orders page %d — %d line items so far", page_num, len(rows))
    before = len(rows)
    rows = filter_rows(rows)
    log.info(
        "Filtered to %d active SKU rows (dropped %d archived/draft variants).",
        len(rows), before - len(rows),
    )
    log.info("Pulled %d Shopify order line items.", len(rows))
    return rows


# ── Pull inventory levels ─────────────────────────────────────────────────────
def pull_inventory(client: ShopifyClient) -> dict[str, int]:
    """
    Return {variant_id → total_available} summed across all locations.
    Uses the InventoryLevels API.
    """
    # First collect all active location IDs
    locs_resp = client.get_json("locations.json", params={"active": "true"})
    location_ids = [str(loc["id"]) for loc in locs_resp.get("locations", [])]
    log.info("Found %d active Shopify locations.", len(location_ids))

    stock: dict[str, int] = {}
    for loc_id in location_ids:
        for page in client.paginate(
            "inventory_levels.json",
            {"location_ids": loc_id, "limit": 250},
        ):
            for level in page:
                inv_item_id = str(level["inventory_item_id"])
                available = int(level.get("available") or 0)
                stock[inv_item_id] = stock.get(inv_item_id, 0) + available

    # Map inventory_item_id → sku via variants
    sku_stock: dict[str, int] = {}
    for page in client.paginate(
        "products.json",
        {"status": "active", "fields": "id,variants", "limit": 250},
    ):
        for product in page:
            for variant in product.get("variants", []):
                inv_item_id = str(variant.get("inventory_item_id", ""))
                sku = variant.get("sku") or ""
                if sku and inv_item_id in stock:
                    sku_stock[sku] = sku_stock.get(sku, 0) + stock[inv_item_id]

    before = len(sku_stock)
    sku_stock = {k: v for k, v in sku_stock.items() if is_active_sku(k)}
    log.info(
        "Filtered inventory to %d active SKUs (dropped %d archived/draft variants).",
        len(sku_stock), before - len(sku_stock),
    )

    # Normalise keys (strip leading zeros) so they align with ACTIVE_SKUS
    normalised: dict[str, int] = {}
    for k, v in sku_stock.items():
        norm = str(k).strip().lstrip("0") or "0"
        normalised[norm] = normalised.get(norm, 0) + v
    sku_stock = normalised

    # Zero-out any active SKU that has no Shopify entry (sold-out or never synced)
    zero_skus = sorted(s for s in ACTIVE_SKUS if s not in sku_stock)
    for s in zero_skus:
        sku_stock[s] = 0
    if zero_skus:
        log.info("Active SKUs with zero Shopify stock: %s", zero_skus)

    log.info("Pulled stock for %d Shopify SKUs.", len(sku_stock))
    return sku_stock


# ── Main ──────────────────────────────────────────────────────────────────────
def run(dry_run: bool = False) -> dict:
    """Execute the Shopify pull.  Returns summary dict."""
    shop_name = os.environ.get("SHOPIFY_SHOP_NAME")
    access_token = os.environ.get("SHOPIFY_ACCESS_TOKEN")
    if not shop_name or not access_token:
        raise EnvironmentError("SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN must be set.")

    client = ShopifyClient(shop_name, access_token)

    log.info("=== Shopify Pull started ===")
    order_rows = pull_orders(client)
    sku_stock = pull_inventory(client)

    if dry_run:
        log.info("[DRY RUN] Would pass %d order rows to calculator.", len(order_rows))
        log.info("[DRY RUN] Would pass %d SKU stock levels to calculator.", len(sku_stock))
        return {"source": "shopify", "records_pulled": len(order_rows), "status": "dry_run"}

    log.info("=== Shopify Pull complete: %d order rows, %d SKUs ===", len(order_rows), len(sku_stock))
    return {
        "source": "shopify",
        "records_pulled": len(order_rows),
        "status": "ok",
        "rows": order_rows,
        "stock_by_sku": sku_stock,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Shopify inventory pull")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    result = run(dry_run=args.dry_run)
    print(result)
