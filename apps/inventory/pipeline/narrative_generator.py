"""
narrative_generator.py
──────────────────────
Generates daily and weekly AI narrative briefs using Claude.
Saves results to SQLite via db_writer.write_daily_brief() — no Google Sheets.
"""
import datetime
import logging
import os
import sqlite3
import sys

import db_writer

log = logging.getLogger("narrative_generator")

_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS_DAILY  = 600
_MAX_TOKENS_WEEKLY = 900


def _get_client():
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


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


def generate_pipeline_narrative(dry_run: bool = False) -> str:
    """
    Generate the daily inventory brief and save to daily_briefs table.
    Returns the narrative text.
    """
    from advisor_context import build_inventory_snapshot
    from anomaly_detector import detect_anomalies

    snapshot = build_inventory_snapshot()

    # Get anomaly counts
    anomalies = []
    try:
        master  = _read_table("inventory_master")
        rolling = _read_table("rolling_windows")
        anomalies = detect_anomalies(
            inventory_df=master,
            rolling_df=rolling,
        )
    except Exception:
        pass

    critical_count = sum(1 for a in anomalies if a.get("severity") == "critical")
    warning_count  = sum(1 for a in anomalies if a.get("severity") == "warning")
    anomaly_count  = len(anomalies)

    system = (
        "Generate a daily inventory brief for Rypstick Golf leadership. "
        "Direct, factual, no filler. Plain text, max 200 words, bullet points. "
        "Format exactly:\n"
        "DATE: {today}\n"
        "STATUS SUMMARY:\n"
        "• [one line overall status]\n"
        "IMMEDIATE ACTIONS:\n"
        "• [per SKU needing action with qty and deadline, or 'None required']\n"
        "WATCH LIST:\n"
        "• [warning/info items worth monitoring, or 'Nothing to flag']\n"
        "PIPELINE:\n"
        "• [active stock pipeline entries, or 'No stock in transit']"
    )

    user_msg = f"Here is the current inventory snapshot:\n\n{snapshot}"
    if anomalies:
        from anomaly_detector import format_anomalies_for_context
        user_msg += f"\n\nANOMALIES:\n{format_anomalies_for_context(anomalies)}"

    today = datetime.date.today().isoformat()

    if dry_run:
        log.info("[DRY RUN] Would generate narrative brief.")
        return "[DRY RUN] narrative not generated."

    try:
        client = _get_client()
        resp = client.messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS_DAILY,
            system=system,
            messages=[{"role":"user","content":user_msg}],
        )
        narrative = resp.content[0].text.strip()
    except Exception as exc:
        log.error("Claude API error generating daily brief: %s", exc)
        narrative = f"[Brief generation failed: {exc}]"

    db_writer.write_daily_brief(narrative)
    log.info("Daily brief saved to daily_briefs table.")

    return narrative


def generate_weekly_brief() -> str:
    """
    Generate Monday morning strategic brief. Returns the text.
    """
    from advisor_context import build_inventory_snapshot

    snapshot = build_inventory_snapshot()
    today = datetime.date.today()
    week_str = today.strftime("Week of %B %d, %Y")

    system = (
        "Generate a Monday morning weekly strategic inventory brief for Rypstick Golf "
        "leadership. Direct, factual, no filler. Plain text, max 300 words. "
        "Format exactly:\n"
        f"{week_str}\n"
        "THIS WEEK'S PRIORITIES: (max 3 bullets)\n"
        "INVENTORY HEALTH: (one line per product family: Rypstick, ButterBlade, Ryp Radar)\n"
        "TRENDS WORTH WATCHING: (1-2 bullets)\n"
        "UPCOMING: (pipeline arrivals + seasonal shift warnings)"
    )

    try:
        client = _get_client()
        resp = client.messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS_WEEKLY,
            system=system,
            messages=[{"role":"user","content":f"Inventory snapshot:\n\n{snapshot}"}],
        )
        narrative = resp.content[0].text.strip()
    except Exception as exc:
        log.error("Claude API error generating weekly brief: %s", exc)
        return f"[Weekly brief generation failed: {exc}]"

    db_writer.write_daily_brief({
        "date": today.isoformat(),
        "narrative": f"[WEEKLY BRIEF]\n{narrative}",
        "anomaly_count": 0,
        "critical_count": 0,
        "warning_count": 0,
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    log.info("Weekly brief saved to daily_briefs table.")

    return narrative


def run(dry_run: bool = False) -> dict:
    """Pipeline step entry point."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.info("ANTHROPIC_API_KEY not set — skipping narrative generation.")
        return {"source":"narrative","records_pulled":0,"status":"ok"}
    narrative = generate_pipeline_narrative(dry_run=dry_run)
    log.info("Narrative generated: %d chars", len(narrative))
    return {"source":"narrative","records_pulled":1,"status":"ok" if not dry_run else "dry_run"}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--weekly", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if args.weekly:
        print(generate_weekly_brief())
    else:
        print(generate_pipeline_narrative(dry_run=args.dry_run))
