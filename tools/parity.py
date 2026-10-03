#!/usr/bin/env python3
"""parity.py — check and render the parity ledger for a reference-clone build.

The ledger is docs/parity.json: one object per feature-inventory ID.

    [
      {"id": "ORD-04", "surface": "orders", "feature": "Bulk status change",
       "status": "partial", "evidence": "Functional pass 2026-09-03; single works",
       "notes": "Deferred per scope line"}
    ]

status: done | partial | deferred | omitted | improved

Rules enforced (exit 1 on any violation):
  - every row has id, surface, feature, status
  - ids are unique
  - status is one of the five
  - done / improved / partial rows carry non-trivial evidence
  - deferred / omitted rows carry notes saying why

Usage:
    python3 parity.py docs/parity.json
    python3 parity.py docs/parity.json --markdown docs/parity.md
"""
import argparse
import json
import sys
from collections import Counter, defaultdict

STATUSES = ("done", "partial", "deferred", "omitted", "improved")
NEEDS_EVIDENCE = ("done", "improved", "partial")
NEEDS_REASON = ("deferred", "omitted")


def load(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    if not isinstance(data, list):
        sys.exit(f"{path}: expected a JSON array of rows (or {{\"items\": [...]}}).")
    return data


def check(rows):
    errors, seen = [], set()
    for i, row in enumerate(rows):
        where = row.get("id") or f"row {i}"
        for field in ("id", "surface", "feature", "status"):
            if not str(row.get(field, "")).strip():
                errors.append(f"{where}: missing '{field}'")
        rid = row.get("id")
        if rid in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(rid)
        status = row.get("status")
        if status not in STATUSES:
            errors.append(f"{where}: status '{status}' not one of {', '.join(STATUSES)}")
            continue
        evidence = str(row.get("evidence", "")).strip()
        if status in NEEDS_EVIDENCE and len(evidence) < 10:
            errors.append(f"{where}: status '{status}' needs evidence saying how it was verified")
        if status in NEEDS_REASON and not str(row.get("notes", "")).strip():
            errors.append(f"{where}: status '{status}' needs notes saying why")
    return errors


def markdown(rows):
    by_surface = defaultdict(list)
    for row in rows:
        by_surface[row.get("surface", "—")].append(row)
    counts = Counter(r.get("status") for r in rows)
    total = len(rows)
    built = counts["done"] + counts["improved"]
    out = ["# Parity ledger", ""]
    out.append(f"**{built}/{total} complete** — " + ", ".join(
        f"{counts[s]} {s}" for s in STATUSES if counts[s]) + "")
    out.append("")
    for surface in sorted(by_surface):
        out.append(f"## {surface}")
        out.append("")
        out.append("| ID | Feature | Status | Evidence | Notes |")
        out.append("| --- | --- | --- | --- | --- |")
        for r in sorted(by_surface[surface], key=lambda x: str(x.get("id"))):
            cells = [r.get("id", ""), r.get("feature", ""), r.get("status", ""),
                     r.get("evidence", ""), r.get("notes", "")]
            out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in cells) + " |")
        out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ledger")
    ap.add_argument("--markdown", metavar="OUT", help="also render a markdown table")
    args = ap.parse_args()

    rows = load(args.ledger)
    errors = check(rows)
    counts = Counter(r.get("status") for r in rows)
    total = len(rows)
    built = counts["done"] + counts["improved"]

    print(f"{total} items — " + ", ".join(f"{counts[s]} {s}" for s in STATUSES if counts[s]))
    if total:
        print(f"complete: {built}/{total} ({100 * built // total}%)")

    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as fh:
            fh.write(markdown(rows) + "\n")
        print(f"wrote {args.markdown}")

    if errors:
        print(f"\n{len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    print("ledger OK")


if __name__ == "__main__":
    main()
