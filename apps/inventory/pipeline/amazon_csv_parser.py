"""
amazon_csv_parser.py
────────────────────
Reads Amazon CSV/TSV exports dropped into amazon_inbox/ and returns parsed rows
for the pipeline orchestrator (run_pipeline.py) to pass to inventory_calc.

Two report types are auto-detected by column headers:

  Orders Report (from Seller Central → Reports → Order Reports):
    Key cols: amazon-order-id, purchase-date, sku, quantity, product-name
    Tab-separated. First row may be a disclaimer line — skipped automatically.

  FBA Inventory Report (from Seller Central → Reports → Fulfillment → Inventory):
    Key cols: sku, afn-fulfillable-quantity (or afn-total-quantity)
    Tab-separated.

Amazon seller SKUs are mapped to internal numeric SKUs via amazon_sku_map.csv
before the allowlist filter runs. Unmapped text SKUs that don't match ACTIVE_SKUS
are dropped with a warning.

After processing, files are moved to amazon_inbox/processed/.

Usage:
    python amazon_csv_parser.py [--dry-run]
"""

import csv
import logging
import os
import shutil
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sku_allowlist import filter_rows, is_active_sku  # noqa: E402

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
log = logging.getLogger("amazon_csv_parser")

INBOX_DIR     = Path("amazon_inbox")
PROCESSED_DIR = INBOX_DIR / "processed"
SKU_MAP_PATH  = Path(__file__).parent / "amazon_sku_map.csv"
CHANNEL       = "amazon"


# ── SKU map ───────────────────────────────────────────────────────────────────

def _load_sku_map() -> dict[str, str]:
    """Load amazon_sku_map.csv → {amazon_sku: shopify_sku}."""
    mapping: dict[str, str] = {}
    if not SKU_MAP_PATH.exists():
        log.warning("amazon_sku_map.csv not found — text SKUs will rely on allowlist only.")
        return mapping
    with open(SKU_MAP_PATH, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            amazon_sku = row.get("amazon_sku", "").strip()
            shopify_sku = row.get("shopify_sku", "").strip()
            if amazon_sku and shopify_sku:
                mapping[amazon_sku] = shopify_sku
    log.info("Loaded %d Amazon SKU mappings from amazon_sku_map.csv.", len(mapping))
    return mapping


def _normalise_sku(raw_sku: str, sku_map: dict[str, str]) -> str:
    """
    Resolve an Amazon seller SKU to an internal numeric SKU.
    Priority: explicit map → strip/lstrip normalisation → pass through as-is.
    """
    sku = raw_sku.strip()
    if sku in sku_map:
        return sku_map[sku]
    # Numeric SKUs already in the allowlist just need stripping/lstrip
    normalised = sku.lstrip("0") or "0"
    return normalised


# ── File helpers ──────────────────────────────────────────────────────────────

def _detect_type(headers: list[str]) -> str | None:
    """Return 'orders' or 'inventory' based on column headers, or None."""
    h = {c.lower().strip() for c in headers}
    if "amazon-order-id" in h or "order-id" in h:
        return "orders"
    if "afn-fulfillable-quantity" in h or "afn-total-quantity" in h:
        return "inventory"
    if "sku" in h and ("quantity-purchased" in h or "units-ordered" in h):
        return "orders"
    if "sku" in h and "quantity" in h and "asin" in h:
        return "inventory"
    return None


def _open_tsv(filepath: Path) -> tuple[list[str], list[dict]]:
    """
    Open a tab-separated Amazon report, skip any leading disclaimer lines,
    and return (headers, rows_as_dicts).
    """
    with open(filepath, newline="", encoding="utf-8-sig") as fh:
        raw = fh.read()

    lines = raw.splitlines()
    header_idx = 0
    for i, line in enumerate(lines):
        lower = line.lower()
        if "sku" in lower or "amazon-order-id" in lower or "order-id" in lower:
            header_idx = i
            break

    content = "\n".join(lines[header_idx:])
    reader = csv.DictReader(content.splitlines(), delimiter="\t")
    headers = list(reader.fieldnames or [])
    rows = list(reader)
    return headers, rows


# ── Orders parser ─────────────────────────────────────────────────────────────

def parse_orders(filepath: Path, sku_map: dict[str, str]) -> list[dict]:
    """
    Parse an Amazon Orders Report TSV.
    Returns row dicts with internal numeric SKUs, ready for inventory_calc.
    """
    headers, raw_rows = _open_tsv(filepath)
    h = {c.lower().strip(): c for c in headers}

    def _get(row: dict, *candidates: str) -> str:
        for c in candidates:
            if c in h:
                val = row.get(h[c], "").strip()
                if val and val != "-":
                    return val
        return ""

    rows: list[dict] = []
    skipped_skus: set[str] = set()

    for raw in raw_rows:
        raw_sku  = _get(raw, "sku", "seller-sku")
        order_id = _get(raw, "amazon-order-id", "order-id")
        qty_str  = _get(raw, "quantity", "quantity-purchased", "units-ordered", "quantity-shipped")
        date_str = _get(raw, "purchase-date", "payments-date", "reporting-date", "date")
        title    = _get(raw, "product-name", "title", "item-name")
        fulfill  = _get(raw, "fulfillment-channel", "ship-service-level")
        status   = _get(raw, "order-status", "item-status")

        if not order_id or not raw_sku:
            continue

        # Skip cancelled orders
        if status.lower() in ("cancelled", "canceled", "pending"):
            continue

        internal_sku = _normalise_sku(raw_sku, sku_map)

        if not is_active_sku(internal_sku):
            skipped_skus.add(raw_sku)
            continue

        date = date_str[:10] if date_str else ""
        try:
            qty = int(float(qty_str)) if qty_str else 0
        except ValueError:
            qty = 0

        rows.append({
            "date":                date,
            "order_id":            order_id,
            "sku":                 internal_sku.lstrip("0") or internal_sku,
            "product_title":       title,
            "quantity":            qty,
            "channel":             CHANNEL,
            "fulfillment_channel": fulfill,
        })

    if skipped_skus:
        log.info(
            "Orders '%s': skipped %d unmapped/inactive Amazon SKUs: %s",
            filepath.name, len(skipped_skus), sorted(skipped_skus),
        )
    log.info("Orders '%s': %d rows parsed.", filepath.name, len(rows))
    return rows


# ── Inventory parser ──────────────────────────────────────────────────────────

def parse_inventory(filepath: Path, sku_map: dict[str, str]) -> dict[str, int]:
    """
    Parse an Amazon FBA Inventory Report TSV.
    Returns {internal_sku → fulfillable_quantity}.
    """
    headers, raw_rows = _open_tsv(filepath)
    h = {c.lower().strip(): c for c in headers}

    def _get(row: dict, *candidates: str) -> str:
        for c in candidates:
            if c in h:
                val = row.get(h[c], "").strip()
                if val and val != "-":
                    return val
        return ""

    sku_stock: dict[str, int] = {}
    for raw in raw_rows:
        raw_sku = _get(raw, "sku", "seller-sku")
        qty_str = _get(raw, "afn-fulfillable-quantity", "afn-total-quantity", "quantity", "units-available")
        if not raw_sku:
            continue

        internal_sku = _normalise_sku(raw_sku, sku_map)
        if not is_active_sku(internal_sku):
            continue

        norm = internal_sku.lstrip("0") or internal_sku
        try:
            qty = int(float(qty_str)) if qty_str else 0
        except ValueError:
            qty = 0
        sku_stock[norm] = sku_stock.get(norm, 0) + qty

    log.info("Inventory '%s': %d active SKUs parsed.", filepath.name, len(sku_stock))
    return sku_stock


# ── Main ──────────────────────────────────────────────────────────────────────

def run(dry_run: bool = False) -> dict:
    """
    Process all files in amazon_inbox/.
    Returns dict compatible with run_pipeline.py step runner:
      {source, records_pulled, status, rows, fba_stock_by_sku}

    rows and fba_stock_by_sku are consumed by inventory_calc — no direct DB writes here.
    """
    log.info("=== Amazon CSV Parser started ===")

    INBOX_DIR.mkdir(exist_ok=True)
    PROCESSED_DIR.mkdir(exist_ok=True)

    sku_map = _load_sku_map()

    files = sorted(
        f for f in INBOX_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in (".csv", ".tsv", ".txt")
    )

    if not files:
        log.info("No files found in %s — nothing to process.", INBOX_DIR)
        return {"source": "amazon", "records_pulled": 0, "status": "ok", "rows": [], "fba_stock_by_sku": {}}

    total_order_rows: list[dict] = []
    combined_stock:   dict[str, int] = {}
    errors: list[str] = []

    for filepath in files:
        log.info("Processing: %s", filepath.name)
        try:
            headers, _ = _open_tsv(filepath)
            file_type = _detect_type(headers)

            if file_type == "orders":
                rows = parse_orders(filepath, sku_map)
                total_order_rows.extend(rows)
            elif file_type == "inventory":
                stock = parse_inventory(filepath, sku_map)
                for sku, qty in stock.items():
                    combined_stock[sku] = combined_stock.get(sku, 0) + qty
            else:
                log.warning(
                    "Could not detect type for '%s' (headers: %s). Skipping.",
                    filepath.name, headers[:6],
                )
                errors.append(filepath.name)
                continue

            if not dry_run:
                dest = PROCESSED_DIR / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}_{filepath.name}"
                shutil.move(str(filepath), str(dest))
                log.info("Moved to processed: %s", dest.name)

        except Exception as exc:
            log.error("Failed to process '%s': %s", filepath.name, exc, exc_info=True)
            errors.append(filepath.name)

    log.info(
        "=== Amazon CSV Parser complete: %d order rows, %d FBA SKUs ===",
        len(total_order_rows), len(combined_stock),
    )

    if dry_run:
        log.info("[DRY RUN] Would pass %d order rows and %d FBA SKUs to inventory_calc.", len(total_order_rows), len(combined_stock))

    status = "error" if errors and not total_order_rows and not combined_stock else "ok"

    return {
        "source":           "amazon",
        "records_pulled":   len(total_order_rows),
        "status":           status,
        "rows":             total_order_rows,
        "fba_stock_by_sku": combined_stock,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Amazon CSV inbox parser")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
