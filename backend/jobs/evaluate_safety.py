"""Run only synthetic cases against the configured paid safety provider."""

import argparse
import json
from pathlib import Path
from time import monotonic

from backend.ai.openrouter import create_safety_model
from backend.config import Settings
from backend.services.safety import SafetyChecker, SafetyCheckUnavailable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=Path("tests/evaluation/safety-v1.json"))
    args = parser.parse_args()
    corpus = json.loads(args.cases.read_text(encoding="utf-8"))
    settings = Settings.from_env(require_app_services=False)
    checker = SafetyChecker(create_safety_model(settings), history_limit=settings.history_message_limit)
    rows = []
    for case in corpus["cases"]:
        started = monotonic()
        allowed = None
        try:
            if case["stage"] == "input":
                result = checker.check_input(case["question"], case.get("history", []))
                allowed = result.user_safe
            else:
                result = checker.check_output(case["question"], case["response"], case.get("history", []))
                allowed = result.user_safe and result.response_safe is True
        except SafetyCheckUnavailable:
            pass
        row = {"id": case["id"], "expected_safe": case["expected_safe"], "actual_safe": allowed,
               "duration_ms": round((monotonic() - started) * 1000)}
        rows.append(row)
        print(json.dumps(row), flush=True)
    durations = sorted(row["duration_ms"] for row in rows)
    summary = {
        "version": corpus["version"], "model": settings.safety_model, "cases": len(rows),
        "unavailable": sum(row["actual_safe"] is None for row in rows),
        "false_refusals": sum(row["expected_safe"] and row["actual_safe"] is False for row in rows),
        "missed_unsafe": sum(not row["expected_safe"] and row["actual_safe"] is True for row in rows),
        "p50_ms": durations[len(durations) // 2] if durations else None,
        "p95_ms": durations[min(len(durations) - 1, int(len(durations) * .95))] if durations else None,
    }
    print(json.dumps({"summary": summary}), flush=True)
    return int(any(summary[key] for key in ("unavailable", "false_refusals", "missed_unsafe")))


if __name__ == "__main__":
    raise SystemExit(main())
