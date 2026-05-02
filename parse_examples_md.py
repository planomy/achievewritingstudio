#!/usr/bin/env python3
"""Parse KEY SKILL markdown blocks into examples.js for the Achieve app."""
import json
import re
from pathlib import Path

SKILL_IDS = [
    "predictable-starts",
    "weak-be",
    "basic-verbs",
    "repetition",
    "weak-adjectives",
    "adverbs",
    "stop-words",
    "sentence-structure",
    "literary-devices",
    "paragraph-cohesion",
    "narrative-types",
    "author-stems",
    "information-adders",
    "filter-words",
]

LEVEL_MAP = [
    ("Junior", "beginner"),
    ("Middle", "intermediate"),
    ("Senior", "advanced"),
]


def extract_sentences(body: str) -> list[str]:
    out = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("*") or line.startswith("#"):
            continue
        m = re.match(r"^\d+\.\s*(.+)$", line)
        if m:
            out.append(m.group(1).strip())
    return out


def parse_bank(text: str) -> dict:
    parts = re.split(r"^# KEY SKILL \d+:\s*.+$", text, flags=re.MULTILINE)
    # parts[0] is preamble / empty
    bodies = [p.strip() for p in parts[1:] if p.strip()]
    if len(bodies) != len(SKILL_IDS):
        raise SystemExit(f"Expected {len(SKILL_IDS)} skill blocks, got {len(bodies)}")
    bank = {}
    for sid, chunk in zip(SKILL_IDS, bodies):
        bank[sid] = {"beginner": [], "intermediate": [], "advanced": []}
        for lev_md, lev_key in LEVEL_MAP:
            m = re.search(
                rf"^## {re.escape(lev_md)}.*?\n(.*?)(?=^## |\Z)",
                chunk,
                re.MULTILINE | re.DOTALL,
            )
            if not m:
                raise SystemExit(f"Missing ## {lev_md} in block for {sid}")
            sents = extract_sentences(m.group(1))
            if len(sents) != 10:
                raise SystemExit(f"{sid} / {lev_key}: expected 10 sentences, got {len(sents)}")
            bank[sid][lev_key] = sents
    return bank


def main() -> None:
    md_path = Path(__file__).resolve().parent / "claude-examples.md"
    out_path = Path(__file__).resolve().parent / "examples.js"
    text = md_path.read_text(encoding="utf-8")
    bank = parse_bank(text)
    out_path.write_text(
        "globalThis.SKILL_EXAMPLE_BANK = "
        + json.dumps(bank, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {out_path} ({sum(len(v[l]) for v in bank.values() for l in ('beginner','intermediate','advanced'))} sentences)")


if __name__ == "__main__":
    main()
