"""
sku_allowlist.py
─────────────────
Single source of truth for active Rypstick Golf SKUs.

To add a new active SKU:   add it to ACTIVE_SKUS below, then re-run sheets_setup.py.
To retire a SKU:           remove it from ACTIVE_SKUS.  Historical data in Raw_* is preserved.
"""

import logging

log = logging.getLogger(__name__)

# ── Active SKU allowlist ──────────────────────────────────────────────────────
# Numeric IDs as strings (no leading zeros).  This is the authoritative list.
ACTIVE_SKUS: set[str] = {
    "2",   # Rypstick Blue 44"
    "3",   # Rypstick Green 41"
    "4",   # Rypstick Orange 38"
    "5",   # Rypstick Men's White 45"
    "12",  # Ryp Radar
    "40",  # BB RH Xtra Stiff
    "41",  # BB RH Stiff
    "42",  # BB RH Regular
    "46",  # BB LH Xtra Stiff
    "47",  # BB LH Stiff
    "48",  # BB LH Regular
    "52",  # Foamies
}

ACTIVE_SKUS_INT: set[int] = {int(s) for s in ACTIVE_SKUS}

# Human-readable names (used when seeding SKU_Allowlist tab)
SKU_NAMES: dict[str, str] = {
    "2":  'Rypstick Blue 44"',
    "3":  'Rypstick Green 41"',
    "4":  'Rypstick Orange 38"',
    "5":  "Rypstick Men's White 45\"",
    "12": "Ryp Radar",
    "40": "BB RH Xtra Stiff",
    "41": "BB RH Stiff",
    "42": "BB RH Regular",
    "46": "BB LH Xtra Stiff",
    "47": "BB LH Stiff",
    "48": "BB LH Regular",
    "52": "Foamies",
}


# ── Core helpers ──────────────────────────────────────────────────────────────

def is_active_sku(sku) -> bool:
    """
    Return True if *sku* belongs to the active allowlist.

    Normalisation applied before lookup:
      - Strips surrounding whitespace
      - Strips leading zeros  (e.g. "040" → "40")
      - Handles None / empty string → False
    """
    if not sku:
        return False
    normalised = str(sku).strip().lstrip("0") or "0"
    return normalised in ACTIVE_SKUS


def filter_rows(rows: list[dict], sku_field: str = "sku") -> list[dict]:
    """
    Return only rows whose *sku_field* value passes is_active_sku().

    Logs dropped / kept counts at DEBUG level so the INFO log stays clean.
    """
    kept = [r for r in rows if is_active_sku(r.get(sku_field))]
    dropped = len(rows) - len(kept)
    log.debug(
        "filter_rows: kept=%d  dropped=%d  field=%s",
        len(kept), dropped, sku_field,
    )
    return kept
