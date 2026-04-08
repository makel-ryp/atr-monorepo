"""
utils.py
────────
Shared utilities used by pipeline modules.
Google Sheets / gspread code removed — SQLite is the storage backend.

Stub functions are kept for backward compatibility with connector files
(shopify_pull, amazon_pull, sps_pull) that import them. Stubs raise
NotImplementedError if actually called in a non-dry-run context.
"""

import logging
import os

log = logging.getLogger(__name__)


# ── Pure helpers (no Sheets dependency) ──────────────────────────────────────

def col_letter(idx: int) -> str:
    """Convert 0-based column index to spreadsheet letter (A, B, …, AA, …)."""
    result = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        result = chr(65 + rem) + result
    return result


# ── Stubs — kept so connector imports don't break ────────────────────────────
# These functions existed in the Sheets-based version. The connectors
# (shopify_pull, amazon_pull, sps_pull) import them at module level.
# In dry-run mode, connectors return before calling these.
# In a real run, connectors should be updated to use db_writer instead.

def get_google_credentials():
    raise NotImplementedError("Google Sheets auth removed. Use db_writer for SQLite writes.")


def get_gspread_client():
    raise NotImplementedError("gspread removed. Use db_writer for SQLite writes.")


def open_spreadsheet():
    raise NotImplementedError("Google Sheets removed. Use db_writer for SQLite writes.")


def get_sheet(tab_name: str):
    raise NotImplementedError(
        f"get_sheet('{tab_name}') called but Sheets is removed. "
        "Connector needs to be updated to use db_writer."
    )


def upsert_rows(ws, new_rows: list, key_cols: list) -> int:
    raise NotImplementedError("upsert_rows: Sheets removed. Use db_writer for SQLite writes.")


def write_rows_routed(tab_name: str, rows: list, key_cols: list) -> int:
    raise NotImplementedError(
        f"write_rows_routed('{tab_name}'): Sheets removed. "
        "Connector needs to be updated to use db_writer."
    )


def save_snapshot(*args, **kwargs):
    raise NotImplementedError("save_snapshot: Sheets removed.")


def restore_from_snapshot(*args, **kwargs):
    raise NotImplementedError("restore_from_snapshot: Sheets removed.")
