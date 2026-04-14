"""
run_pipeline.py
───────────────
Main orchestrator. Runs connectors in sequence, logs to SQLite run_log.

Usage:
    python run_pipeline.py [--dry-run] [--skip-email] [--narrative-only]

Flags:
    --dry-run         Initialise DB and verify schema only. No API calls, no writes.
    --skip-email      Full pipeline without sending the email report.
    --narrative-only  Skip all pull/calc steps — run narrative_generator only.
"""

import argparse
import importlib
import inspect
import logging
import os
import sys
from datetime import datetime, timezone
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
log = logging.getLogger("run_pipeline")


# ── Step runner ───────────────────────────────────────────────────────────────
def _run_step(name: str, module_name: str, dry_run: bool, context: dict | None = None) -> dict:
    log.info("-" * 60)
    log.info("START  %s", name)
    start = datetime.now(timezone.utc)

    try:
        module = importlib.import_module(module_name)
        kwargs: dict = {"dry_run": dry_run}
        if context:
            kwargs.update(context)
        sig = inspect.signature(module.run)
        accepted = set(sig.parameters.keys())
        filtered = {k: v for k, v in kwargs.items() if k in accepted}
        result = module.run(**filtered)
        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        records = result.get("records_pulled", 0)
        status = result.get("status", "ok")
        notes = f"elapsed={elapsed:.1f}s"
        log.info("END    %s — %d records — %.1fs", name, records, elapsed)
        db_writer.write_run_log(name, records, status, notes)
        return result
    except Exception as exc:
        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        log.error("FAILED %s after %.1fs: %s", name, elapsed, exc, exc_info=True)
        db_writer.write_run_log(name, 0, "error", str(exc)[:500])
        return {"source": name, "records_pulled": 0, "status": "error", "error": str(exc)}


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory pipeline orchestrator")
    parser.add_argument("--dry-run", action="store_true",
                        help="Initialise DB and verify schema only — no API calls.")
    parser.add_argument("--skip-email", action="store_true",
                        help="Run full pipeline but skip the email report.")
    parser.add_argument("--narrative-only", action="store_true",
                        help="Skip all pull/calc steps — run narrative_generator only.")
    args = parser.parse_args()
    dry_run = args.dry_run
    skip_email = args.skip_email or dry_run
    narrative_only = args.narrative_only

    log.info("=" * 60)
    log.info(
        "INVENTORY PIPELINE START  dry_run=%s  skip_email=%s  narrative_only=%s",
        dry_run, skip_email, narrative_only,
    )
    log.info("=" * 60)

    # Always init DB first — creates tables if they don't exist
    db_writer.init_db()
    log.info("Database initialised at %s", db_writer.DB_PATH)

    # Seed SKU params from sku_params.py (INSERT OR IGNORE — never overwrites UI edits)
    from sku_params import SKU_PARAMS, get_params as _get_params
    db_writer.seed_sku_params({sku: _get_params(sku) for sku in SKU_PARAMS})
    log.info("SKU params seeded (%d SKUs)", len(SKU_PARAMS))

    # ── Dry-run gate ──────────────────────────────────────────────────────────
    if dry_run:
        db_writer.write_run_log("dry_run", 0, "dry_run", "schema verified")
        log.info("DRY RUN complete — schema verified, no API calls made.")
        print("\n--- Dry Run Complete -------------------------------------------")
        print(f"Database: {db_writer.DB_PATH}")
        print("All 9 tables created/verified. Exit 0.")
        print("----------------------------------------------------------------\n")
        sys.exit(0)

    pipeline_start = datetime.now(timezone.utc)

    # ── Narrative-only path ───────────────────────────────────────────────────
    if narrative_only:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            log.error("ANTHROPIC_API_KEY not set — cannot generate narrative.")
            sys.exit(1)
        result = _run_step("narrative", "narrative_generator", dry_run=False)
        ok = result.get("status") == "ok"
        log.info("Narrative-only run %s.", "complete" if ok else "FAILED")
        sys.exit(0 if ok else 1)

    # ── Full pipeline steps ───────────────────────────────────────────────────
    steps = [
        ("shopify",     "shopify_pull"),
        ("amazon",      "amazon_csv_parser"),
        ("sps",         "sps_pull"),
        ("calculator",  "inventory_calc"),
        ("timeseries",  "forecast_timeseries"),
    ]
    if not skip_email and os.environ.get("EMAIL_FROM") and os.environ.get("EMAIL_TO"):
        steps.append(("email", "email_report"))
    if os.environ.get("SLACK_WEBHOOK_URL"):
        steps.append(("slack", "slack_alert"))
    if os.environ.get("ANTHROPIC_API_KEY"):
        steps.append(("narrative", "narrative_generator"))

    results: list[dict] = []
    calc_result: dict = {}
    # Accumulated raw rows — populated by connector steps, passed to calculator
    pipeline_data: dict = {"shopify_rows": [], "amazon_rows": [], "edi_rows": [], "stock_by_sku": {}}

    for step_name, module_name in steps:
        context: dict = {}

        if step_name == "calculator":
            context.update(pipeline_data)
        if step_name == "timeseries":
            context.update(pipeline_data)
        if step_name == "slack" and calc_result.get("alerts"):
            context["alerts"] = calc_result["alerts"]
        if step_name == "email":
            context["pipeline_warnings"] = sum(
                1 for r in results
                if r.get("records_pulled", -1) == 0 and r.get("status") == "ok"
            )

        result = _run_step(step_name, module_name, dry_run=False, context=context)
        results.append(result)

        # Collect raw rows returned by connector steps.
        # stock_by_sku is accumulated as {sku: {"shopify_stock": N, "amazon_fba_stock": N}}
        # — the nested-dict format expected by inventory_calc.py.
        # Connectors return flat {sku: int}; we convert here at the boundary.
        if step_name == "shopify" and "rows" in result:
            pipeline_data["shopify_rows"] = result["rows"]
            for sku, qty in result.get("stock_by_sku", {}).items():
                entry = pipeline_data["stock_by_sku"].setdefault(
                    sku, {"shopify_stock": 0, "amazon_fba_stock": 0}
                )
                entry["shopify_stock"] = float(qty)
        elif step_name == "amazon" and "rows" in result:
            pipeline_data["amazon_rows"] = result["rows"]
            for sku, qty in result.get("fba_stock_by_sku", {}).items():
                entry = pipeline_data["stock_by_sku"].setdefault(
                    sku, {"shopify_stock": 0, "amazon_fba_stock": 0}
                )
                entry["amazon_fba_stock"] = float(qty)
        elif step_name == "sps" and "edi_rows" in result:
            pipeline_data["edi_rows"] = result.get("edi_rows", [])
        elif step_name == "calculator":
            calc_result = result

    # ── Summary ───────────────────────────────────────────────────────────────
    elapsed_total = (datetime.now(timezone.utc) - pipeline_start).total_seconds()
    ok_steps = [r for r in results if r.get("status") in ("ok", "dry_run")]
    err_steps = [r for r in results if r.get("status") == "error"]
    zero_warns = [r for r in results if r.get("records_pulled", -1) == 0 and r.get("status") == "ok"
                  and r.get("source") not in ("email", "slack")]

    log.info("=" * 60)
    log.info("PIPELINE COMPLETE in %.1fs", elapsed_total)
    log.info("  Steps OK      : %d", len(ok_steps))
    log.info("  Steps ERROR   : %d", len(err_steps))
    log.info("  Zero-rec warns: %d", len(zero_warns))
    for r in results:
        icon = "OK" if r.get("status") in ("ok", "dry_run") else "!!"
        log.info("  %s %-12s  records=%-6s  status=%s",
                 icon, r.get("source", "?"), r.get("records_pulled", "-"), r.get("status", "?"))
    log.info("=" * 60)

    print("\n--- Pipeline Summary -------------------------------------------")
    print(f"Completed in {elapsed_total:.1f}s  |  OK: {len(ok_steps)}  |  Errors: {len(err_steps)}")
    for r in results:
        icon = "OK " if r.get("status") in ("ok", "dry_run") else "ERR"
        print(f"  [{icon}] {r.get('source','?'):12s}  records={r.get('records_pulled','-')}")
    print("----------------------------------------------------------------\n")

    sys.exit(1 if err_steps else 0)


if __name__ == "__main__":
    main()
