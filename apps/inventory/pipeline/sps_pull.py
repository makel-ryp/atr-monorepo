"""
sps_pull.py
───────────
Processes SPS Commerce CSV exports for all four EDI document types:
  EDI 850 — Purchase Orders       → Raw_EDI
  EDI 856 — Advance Ship Notices  → Raw_ASN
  EDI 810 — Invoices              → Raw_Invoice
  EDI 855 — PO Acknowledgements   → Raw_ACK

DROP ZONE: Place CSV files exported from the SPS portal into sps_inbox/
After processing, files are moved to sps_inbox/processed/
Processed filenames are tracked in processed_files.json (idempotent).

Document type detection uses CSV column headers (reliable), not filenames.

SKU resolution (5-step cascade):
  1. Vendor Style direct match against active SKU set
  2. Buyers Catalog retailer code → retailer_sku_map.csv
  3. UPC/EAN → sku_mapping.csv
  4. Cross-document PO line reference (850 → 856/810/855)
  5. UNRESOLVED:<value> fallback (visible for review)

Required env vars:
    GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH
    GOOGLE_SHEET_ID

Usage:
    python sps_pull.py [--dry-run]
"""

import csv
import json
import logging
import os
import shutil
import sys
from datetime import datetime, date
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sku_allowlist import ACTIVE_SKUS, filter_rows  # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
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
log = logging.getLogger("sps_pull")

# ── Paths ─────────────────────────────────────────────────────────────────────
INBOX_DIR      = Path("sps_inbox")
PROCESSED_DIR  = INBOX_DIR / "processed"
PROCESSED_FILE = Path("processed_files.json")
UPC_MAP_FILE   = Path("sku_mapping.csv")
RETAILER_MAP_FILE = Path("retailer_sku_map.csv")


# ── Mapping loaders ───────────────────────────────────────────────────────────
def _load_upc_map() -> dict[str, str]:
    if not UPC_MAP_FILE.exists():
        return {}
    result = {}
    with UPC_MAP_FILE.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            upc = row.get("upc", "").strip()
            sku = row.get("shopify_sku", "").strip()
            if upc and sku:
                result[upc] = sku
    log.info("Loaded %d UPC mappings.", len(result))
    return result


def _load_retailer_map() -> dict[str, str]:
    if not RETAILER_MAP_FILE.exists():
        return {}
    result = {}
    with RETAILER_MAP_FILE.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row.get("retailer_code", "").strip()
            sku  = row.get("shopify_sku", "").strip()
            if code and sku:
                result[code] = sku
    log.info("Loaded %d retailer code mappings.", len(result))
    return result


# ── Processed-file tracking ───────────────────────────────────────────────────
def load_processed() -> set[str]:
    if PROCESSED_FILE.exists():
        with PROCESSED_FILE.open() as f:
            return set(json.load(f))
    return set()


def save_processed(processed: set[str]) -> None:
    with PROCESSED_FILE.open("w") as f:
        json.dump(sorted(processed), f, indent=2)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _normalize_date(val: str) -> str:
    """Convert M/D/YYYY or YYYYMMDD to ISO YYYY-MM-DD. Returns '' on failure."""
    val = (val or "").strip()
    if not val:
        return ""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%Y%m%d", "%m/%d/%y"):
        try:
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return val


def _safe_int(val) -> int:
    try:
        return int(float(val or 0))
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    try:
        return round(float(val or 0), 4)
    except (ValueError, TypeError):
        return 0.0


def _read_headers(filepath: Path) -> list[str]:
    """Return the header row of a CSV file without consuming data rows."""
    with filepath.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        return next(reader, [])


# ── Document type detection (column-based) ────────────────────────────────────
def _detect_doc_type(headers: list[str]) -> str:
    """
    Detect EDI document type from CSV column headers.
    Column-based detection is reliable regardless of filename conventions.
    """
    hset = {h.strip() for h in headers}
    if "ASN #" in hset:
        return "EDI_856"
    if "Invoice Number" in hset:
        return "EDI_810"
    if "Acknowledgment Type" in hset:
        return "EDI_855"
    return "EDI_850"


def _detect_asn_format(headers: list[str]) -> str:
    """
    Dick's Sporting Goods uses a Pick/Pack ASN format (has 'Store Name' column).
    PGA Tour and others use the standard format.
    """
    return "pick_pack" if "Store Name" in {h.strip() for h in headers} else "standard"


# ── SKU resolution ────────────────────────────────────────────────────────────
def resolve_sku(
    vendor_style: str,
    upc: str,
    buyers_sku: str,
    upc_map: dict[str, str],
    retailer_map: dict[str, str],
    po_number: str = "",
    line_num: str = "",
    po_line_sku_map: dict | None = None,
) -> str:
    """
    Resolve Shopify SKU using a 5-step cascade:

    1. vendor_style  — direct match against active SKU set (e.g. "41" → SKU 41)
    2. buyers_sku    — retailer code lookup (e.g. "BBLADERHSTF" → 41)
    3. upc           — UPC/EAN lookup via sku_mapping.csv
    4. po_line_ref   — cross-document: (po_number, line_num) from parsed 850s
    5. fallback      — "UNRESOLVED:<value>" (visible in sheet for manual review)
    """
    # Step 1: vendor style is an active SKU number
    vs = str(vendor_style).strip()
    if vs and vs in ACTIVE_SKUS:
        return vs

    # Step 2: retailer code → SKU (non-numeric buyers catalog values)
    buyers = str(buyers_sku).strip().lstrip("0")
    if buyers and not buyers.isdigit():
        mapped = retailer_map.get(buyers)
        if mapped:
            return mapped
        return buyers  # unknown code — visible for manual review

    # Step 3: UPC/EAN lookup
    upc_clean = str(upc).strip()
    if upc_clean and upc_clean in upc_map:
        return upc_map[upc_clean]

    # Step 4: cross-document PO line reference
    if po_line_sku_map and po_number and line_num:
        ln = str(line_num).strip()
        for key in [(po_number, ln), (po_number, ln.lstrip("0") or "0")]:
            if key in po_line_sku_map:
                return po_line_sku_map[key]

    # Step 5: unresolved
    label = buyers_sku or upc or vendor_style or "?"
    return f"UNRESOLVED:{label}"


# ── EDI 850 parser ────────────────────────────────────────────────────────────
def parse_850(
    filepath: Path,
    upc_map: dict[str, str],
    retailer_map: dict[str, str],
) -> tuple[list[dict], dict[tuple[str, str], str]]:
    """
    Parse an EDI 850 Purchase Order CSV.
    Returns (raw_edi_rows, po_line_sku_map).
    po_line_sku_map keys are (po_number, line_num_str).
    """
    rows: list[dict] = []
    po_line_sku_map: dict[tuple[str, str], str] = {}
    header_info: dict[str, dict] = {}

    with filepath.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for csv_row in reader:
            row = {k: (v or "").strip() for k, v in csv_row.items() if k}
            record_type = row.get("Record Type", "").upper()
            po_number   = row.get("PO Number", "").strip()

            if not po_number:
                continue

            if record_type == "H":
                retailer = row.get("Partner", "").strip() or row.get("Ship To Name", "").strip()
                expected_date = (
                    _normalize_date(row.get("Requested Delivery Date", ""))
                    or _normalize_date(row.get("Ship Dates", ""))
                    or _normalize_date(row.get("Cancel Date", ""))
                )
                header_info[po_number] = {
                    "retailer":         retailer,
                    "expected_date":    expected_date,
                    "po_date":          _normalize_date(row.get("PO Date", "")),
                    "cancel_date":      _normalize_date(row.get("Cancel Date", "")),
                    "ship_to_location": row.get("Ship To Location", "").strip(),
                    "payment_terms":    row.get("Payment Terms Desc", "").strip(),
                    "retailer_po":      row.get("Retailers PO", "").strip(),
                }

            elif record_type == "D":
                h            = header_info.get(po_number, {})
                vendor_style = row.get("Vendor Style", "").strip()
                upc          = row.get("UPC/EAN", "").strip()
                buyers_sku   = row.get("Buyers Catalog or Stock Keeping #", "").strip()
                line_num     = row.get("PO Line #", "").strip()

                sku = resolve_sku(
                    vendor_style, upc, buyers_sku,
                    upc_map, retailer_map,
                    po_number=po_number, line_num=line_num,
                )

                # Build cross-reference map for 856/810/855 parsers
                if po_number and line_num and not sku.startswith("UNRESOLVED"):
                    po_line_sku_map[(po_number, line_num)] = sku

                rows.append({
                    "po_number":        po_number,
                    "sku":              sku,
                    "product_title":    row.get("Product/Item Description", ""),
                    "ordered_qty":      _safe_int(row.get("Qty Ordered", 0)),
                    "shipped_qty":      0,
                    "expected_date":    h.get("expected_date", ""),
                    "retailer":         h.get("retailer", ""),
                    "doc_type":         "EDI_850",
                    "unit_price":       _safe_float(row.get("Unit Price", 0)),
                    "retailer_po":      h.get("retailer_po", ""),
                    "cancel_date":      h.get("cancel_date", ""),
                    "ship_to_location": h.get("ship_to_location", ""),
                    "payment_terms":    h.get("payment_terms", ""),
                    "po_line":          line_num,
                    "partial_fulfilled": "",
                    "fulfillment_gap":  "",
                    "ack_qty":          "",
                    "ack_status":       "",
                    "po_date":          h.get("po_date", ""),
                    "created_date":     date.today().isoformat(),
                })
            # O (promo/note) rows are intentionally skipped

    log.info("Parsed '%s' (850): %d line items, %d POs", filepath.name, len(rows), len(header_info))
    return rows, po_line_sku_map


# ── EDI 856 parser ────────────────────────────────────────────────────────────
def parse_856(
    filepath: Path,
    upc_map: dict[str, str],
    retailer_map: dict[str, str],
    po_line_sku_map: dict | None = None,
) -> list[dict]:
    """
    Parse an EDI 856 Advance Ship Notice CSV.
    ASN files are flat (no H/D record types) — one row per line item.
    Supports both Dick's Pick/Pack format and standard PGA Tour format.
    """
    po_line_sku_map = po_line_sku_map or {}
    rows: list[dict] = []

    with filepath.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers    = reader.fieldnames or []
        asn_format = _detect_asn_format(headers)

        for csv_row in reader:
            row = {k: (v or "").strip() for k, v in csv_row.items() if k}

            po_number = row.get("PO #", "").strip()
            if not po_number:
                continue

            asn_number   = row.get("ASN #", "").strip()
            line_num     = row.get("Line #", "").strip()
            vendor_style = row.get("Vdr Item #", "").strip()
            upc          = row.get("UPC", "").strip()
            buyers_sku   = row.get("Buyer Item #", "").strip()

            sku = resolve_sku(
                vendor_style, upc, buyers_sku,
                upc_map, retailer_map,
                po_number=po_number, line_num=line_num,
                po_line_sku_map=po_line_sku_map,
            )

            rows.append({
                "asn_number":       asn_number,
                "asn_date":         _normalize_date(row.get("ASN Date", "")),
                "ship_date":        _normalize_date(row.get("Ship Date", "")),
                "po_number":        po_number,
                "sku":              sku,
                "product_title":    row.get("Desc", ""),
                "qty_shipped":      _safe_int(row.get("Qty Ship", 0)),
                "carrier":          row.get("Carrier", "").strip(),
                "tracking_number":  row.get("Carrier Tracking", "").strip(),
                "bol":              row.get("BOL", "").strip(),
                "ship_to_name":     row.get("Ship To Name", "").strip(),
                "ship_to_location": row.get("Ship To Location", "").strip(),
                "store_name":       row.get("Store Name", "").strip() if asn_format == "pick_pack" else "",
                "num_cartons":      _safe_int(row.get("CTN Qty", 0)),
                "doc_type":         "EDI_856",
                "created_date":     date.today().isoformat(),
            })

    log.info("Parsed '%s' (856 %s): %d rows", filepath.name, asn_format, len(rows))
    return rows


# ── EDI 810 parser ────────────────────────────────────────────────────────────
def parse_810(
    filepath: Path,
    upc_map: dict[str, str],
    retailer_map: dict[str, str],
    po_line_sku_map: dict | None = None,
) -> list[dict]:
    """
    Parse an EDI 810 Invoice CSV (H/D record types).
    Note: 'Qty Ordered' in 810 D rows = quantity invoiced.
    Note: Dick's uses 'Buyer's Catalog or Stock Keeping #' (with apostrophe).
    """
    po_line_sku_map = po_line_sku_map or {}
    rows: list[dict] = []
    header_info: dict[str, dict] = {}

    with filepath.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for csv_row in reader:
            row = {k: (v or "").strip() for k, v in csv_row.items() if k}
            record_type    = row.get("Record Type", "").upper()
            invoice_number = row.get("Invoice Number", "").strip()

            if not invoice_number:
                continue

            if record_type == "H":
                # Ship To Location: Dick's uses Buying Party Location (field ~69),
                # PGA Tour uses Ship To Location (field 11). Try both.
                ship_to_location = (
                    row.get("Ship To Location", "").strip()
                    or row.get("Buying Party Location", "").strip()
                )
                ship_to_name = (
                    row.get("Ship To Name", "").strip()
                    or row.get("Buying Party Name", "").strip()
                )
                header_info[invoice_number] = {
                    "po_number":        row.get("PO or Vendor Number", "").strip(),
                    "invoice_date":     _normalize_date(row.get("Invoice Date", "")),
                    "po_date":          _normalize_date(row.get("PO Date", "")),
                    "ship_to_location": ship_to_location,
                    "ship_to_name":     ship_to_name,
                    "invoice_total":    row.get("Invoice Total", "").strip(),
                    "payment_terms":    row.get("Payment Terms Desc", "").strip(),
                }

            elif record_type == "D":
                h          = header_info.get(invoice_number, {})
                po_number  = h.get("po_number", "")
                line_num   = row.get("PO Line #", "").strip()

                # 810 uses "Buyer's Catalog or Stock Keeping #" (with apostrophe)
                vendor_style = row.get("Vendor Style", "").strip()
                upc          = row.get("UPC/EAN", "").strip()
                buyers_sku   = (
                    row.get("Buyer's Catalog or Stock Keeping #", "").strip()
                    or row.get("Buyers Catalog or Stock Keeping #", "").strip()
                )

                sku = resolve_sku(
                    vendor_style, upc, buyers_sku,
                    upc_map, retailer_map,
                    po_number=po_number, line_num=line_num,
                    po_line_sku_map=po_line_sku_map,
                )

                qty_invoiced = _safe_int(row.get("Qty Ordered", 0))
                unit_price   = _safe_float(row.get("Unit Price", 0))

                retailer = h.get("ship_to_name", "") or h.get("ship_to_location", "")

                rows.append({
                    "invoice_number":   invoice_number,
                    "invoice_date":     h.get("invoice_date", ""),
                    "po_number":        po_number,
                    "sku":              sku,
                    "product_title":    row.get("Product/Item Description", ""),
                    "qty_invoiced":     qty_invoiced,
                    "unit_price":       unit_price,
                    "line_total":       round(qty_invoiced * unit_price, 2),
                    "retailer":         retailer,
                    "ship_to_location": h.get("ship_to_location", ""),
                    "invoice_total":    h.get("invoice_total", ""),
                    "doc_type":         "EDI_810",
                    "created_date":     date.today().isoformat(),
                })

    log.info("Parsed '%s' (810): %d invoice lines, %d invoices", filepath.name, len(rows), len(header_info))
    return rows


# ── EDI 855 parser ────────────────────────────────────────────────────────────
def parse_855(
    filepath: Path,
    upc_map: dict[str, str],
    retailer_map: dict[str, str],
    po_line_sku_map: dict | None = None,
) -> list[dict]:
    """
    Parse an EDI 855 PO Acknowledgement CSV (H/D/A record types).
    D rows contain line items; A rows provide acceptance status for the preceding D.
    PO Number only appears in H rows — inherited by D/A rows.
    """
    po_line_sku_map = po_line_sku_map or {}
    rows: list[dict] = []
    header_info: dict[str, dict] = {}
    current_po_number = ""
    pending_d: dict | None = None

    with filepath.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for csv_row in reader:
            row = {k: (v or "").strip() for k, v in csv_row.items() if k}
            record_type = row.get("Record Type", "").upper()

            if record_type == "H":
                # Flush any D row that had no following A row
                if pending_d:
                    rows.append(pending_d)
                    pending_d = None

                current_po_number = row.get("PO Number", "").strip()
                header_info[current_po_number] = {
                    "ack_type":   row.get("Acknowledgment Type", "").strip(),
                    "ack_number": row.get("Acknowledgment Number", "").strip(),
                    "ack_date":   _normalize_date(row.get("Acknowledgment Date", "")),
                    "po_date":    _normalize_date(row.get("PO Date", "")),
                }

            elif record_type == "D":
                # Flush any previous D row without A
                if pending_d:
                    rows.append(pending_d)

                h          = header_info.get(current_po_number, {})
                line_num   = row.get("PO Line #", "").strip()
                vendor_style = row.get("Vendor Style", "").strip()
                upc          = row.get("UPC/EAN", "").strip()
                buyers_sku   = row.get("Buyers Catalog or Stock Keeping #", "").strip()

                sku = resolve_sku(
                    vendor_style, upc, buyers_sku,
                    upc_map, retailer_map,
                    po_number=current_po_number, line_num=line_num,
                    po_line_sku_map=po_line_sku_map,
                )

                pending_d = {
                    "ack_number":      h.get("ack_number", ""),
                    "ack_date":        h.get("ack_date", ""),
                    "po_number":       current_po_number,
                    "sku":             sku,
                    "product_title":   row.get("Product/Item Description", "").rstrip("_"),
                    "qty_ordered":     _safe_int(row.get("Qty Ordered", 0)),
                    "qty_acknowledged": 0,
                    "item_status":     "",
                    "ack_type":        h.get("ack_type", ""),
                    "doc_type":        "EDI_855",
                    "created_date":    date.today().isoformat(),
                }

            elif record_type == "A":
                if pending_d:
                    pending_d["item_status"]     = row.get("Item Status Code", "").strip()
                    pending_d["qty_acknowledged"] = _safe_int(row.get("Item Schedule Qty", 0))
                    rows.append(pending_d)
                    pending_d = None

    if pending_d:
        rows.append(pending_d)

    log.info("Parsed '%s' (855): %d ack lines", filepath.name, len(rows))
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────
def run(dry_run: bool = False) -> dict:
    log.info("=== SPS Pull started ===")

    INBOX_DIR.mkdir(exist_ok=True)
    PROCESSED_DIR.mkdir(exist_ok=True)

    processed = load_processed()
    csv_files = [f for f in sorted(INBOX_DIR.glob("*.csv")) if f.name not in processed]

    if not csv_files:
        log.info("No new CSV files in sps_inbox/ — nothing to process.")
        return {"source": "sps", "records_pulled": 0, "status": "ok"}

    log.info("Found %d new file(s): %s", len(csv_files), [f.name for f in csv_files])

    upc_map      = _load_upc_map()
    retailer_map = _load_retailer_map()

    # Detect document type for each file
    file_types: dict[Path, str] = {}
    for filepath in csv_files:
        try:
            headers = _read_headers(filepath)
            doc_type = _detect_doc_type(headers)
            file_types[filepath] = doc_type
            log.info("  '%s' -> %s", filepath.name, doc_type)
        except Exception as exc:
            log.error("Could not detect type for '%s': %s", filepath.name, exc)
            file_types[filepath] = "EDI_850"

    # ── Pass 1: Parse all 850s first to build po_line_sku_map ─────────────────
    po_line_sku_map: dict[tuple[str, str], str] = {}
    edi_850_rows:    list[dict] = []
    parsed_850s:     list[Path] = []

    for filepath, doc_type in file_types.items():
        if doc_type != "EDI_850":
            continue
        try:
            rows, line_map = parse_850(filepath, upc_map, retailer_map)
            edi_850_rows.extend(rows)
            po_line_sku_map.update(line_map)
            parsed_850s.append(filepath)
        except Exception as exc:
            log.error("Failed to parse 850 '%s': %s", filepath.name, exc, exc_info=True)

    log.info("Built PO line cross-reference: %d entries", len(po_line_sku_map))

    # ── Pass 2: Parse 856/810/855 with cross-reference available ──────────────
    asn_rows:     list[dict] = []
    invoice_rows: list[dict] = []
    ack_rows:     list[dict] = []
    parsed_others: list[Path] = []

    for filepath, doc_type in file_types.items():
        if doc_type == "EDI_850":
            continue
        try:
            if doc_type == "EDI_856":
                rows = parse_856(filepath, upc_map, retailer_map, po_line_sku_map)
                asn_rows.extend(rows)
            elif doc_type == "EDI_810":
                rows = parse_810(filepath, upc_map, retailer_map, po_line_sku_map)
                invoice_rows.extend(rows)
            elif doc_type == "EDI_855":
                rows = parse_855(filepath, upc_map, retailer_map, po_line_sku_map)
                ack_rows.extend(rows)
            parsed_others.append(filepath)
        except Exception as exc:
            log.error("Failed to parse '%s' (%s): %s", filepath.name, doc_type, exc, exc_info=True)

    # ── Filter through SKU allowlist ──────────────────────────────────────────
    def _filter_and_log(rows: list[dict], label: str) -> list[dict]:
        before = len(rows)
        filtered = filter_rows(rows)
        unresolved = [r["sku"] for r in rows if str(r.get("sku", "")).startswith("UNRESOLVED")]
        if unresolved:
            log.warning("%s: %d UNRESOLVED SKU(s): %s", label, len(unresolved), unresolved[:10])
        dropped = before - len(filtered)
        if dropped:
            log.info("%s: dropped %d row(s) (inactive/unresolved SKUs)", label, dropped)
        return filtered

    edi_850_rows  = _filter_and_log(edi_850_rows,  "Raw_EDI")
    asn_rows      = _filter_and_log(asn_rows,      "Raw_ASN")
    invoice_rows  = _filter_and_log(invoice_rows,  "Raw_Invoice")
    ack_rows      = _filter_and_log(ack_rows,      "Raw_ACK")

    total_rows = len(edi_850_rows) + len(asn_rows) + len(invoice_rows) + len(ack_rows)
    log.info(
        "Totals after filter — 850:%d 856:%d 810:%d 855:%d = %d rows",
        len(edi_850_rows), len(asn_rows), len(invoice_rows), len(ack_rows), total_rows,
    )

    if dry_run:
        log.info(
            "[DRY RUN] Would write: Raw_EDI=%d Raw_ASN=%d Raw_Invoice=%d Raw_ACK=%d",
            len(edi_850_rows), len(asn_rows), len(invoice_rows), len(ack_rows),
        )
        log.info("[DRY RUN] Would move %d file(s) to processed/", len(parsed_850s) + len(parsed_others))
        return {"source": "sps", "records_pulled": total_rows, "status": "dry_run"}

    # ── Write EDI orders to SQLite ────────────────────────────────────────────
    import db_writer as _db_writer
    if edi_850_rows:
        _db_writer.upsert_edi_orders(edi_850_rows)

    # ── Move files to processed/ ──────────────────────────────────────────────
    for filepath in parsed_850s + parsed_others:
        dest = PROCESSED_DIR / filepath.name
        shutil.move(str(filepath), str(dest))
        processed.add(filepath.name)
        log.info("Moved '%s' -> sps_inbox/processed/", filepath.name)

    save_processed(processed)
    log.info("=== SPS Pull complete: %d rows ===", total_rows)
    return {
        "source": "sps",
        "records_pulled": total_rows,
        "status": "ok",
        "edi_rows": edi_850_rows,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="SPS Commerce CSV processor (all 4 EDI doc types)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(run(dry_run=args.dry_run))
