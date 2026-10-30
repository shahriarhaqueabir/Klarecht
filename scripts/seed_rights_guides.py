"""Seed rights_guides table from markdown files in data/rights-guides/.

Usage:
    python scripts/seed_rights_guides.py --db data/german-law.db --dir data/rights-guides
"""

import argparse
import json
import re
import sqlite3
from pathlib import Path

try:
    import yaml  # type: ignore

    HAS_YAML = True
except Exception:  # pragma: no cover
    HAS_YAML = False


RIGHTS_GUIDES_SCHEMA = """
CREATE TABLE IF NOT EXISTS rights_guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_de TEXT NOT NULL,
    title_en TEXT NOT NULL,
    category TEXT NOT NULL,
    body_md TEXT NOT NULL,
    linked_norms TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
"""


def parse_frontmatter(text: str):
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not match:
        raise ValueError("No YAML frontmatter found")
    front_raw = match.group(1)
    body = match.group(2).strip()

    if HAS_YAML:
        front = yaml.safe_load(front_raw) or {}
    else:
        front = {}
        for line in front_raw.strip().split("\n"):
            key, _, val = line.partition(":")
            key = key.strip()
            if not key:
                continue
            val = val.strip()
            # handle inline arrays
            if val.startswith("[") and val.endswith("]"):
                try:
                    front[key] = json.loads(val.replace("'", '"'))
                    continue
                except Exception:
                    pass
            front[key] = val.strip('"').strip("'")

    # Normalize linked_norms to a list
    linked = front.get("linked_norms", [])
    if isinstance(linked, str):
        m = re.search(r"\[(.*)\]", linked, re.DOTALL)
        if m:
            linked = [
                n.strip().strip('"').strip("'")
                for n in m.group(1).split(",")
                if n.strip()
            ]
        else:
            linked = [linked] if linked else []
    linked = [str(n).strip() for n in linked if str(n).strip()]

    return {
        "slug": front["slug"],
        "title_de": front["title_de"],
        "title_en": front["title_en"],
        "category": front["category"],
        "body_md": body,
        "linked_norms": json.dumps(linked, ensure_ascii=False),
    }


def parse_guide(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return parse_frontmatter(text)


def main():
    parser = argparse.ArgumentParser(
        description="Seed rights_guides from markdown files"
    )
    parser.add_argument("--db", required=True, help="Path to SQLite DB")
    parser.add_argument(
        "--dir", default="data/rights-guides", help="Directory of guide markdown files"
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(RIGHTS_GUIDES_SCHEMA)

    guide_dir = Path(args.dir)
    if not guide_dir.exists():
        raise SystemExit(f"Guide directory not found: {guide_dir}")

    count = 0
    for md_file in sorted(guide_dir.glob("*.md")):
        guide = parse_guide(md_file)
        conn.execute(
            """INSERT OR REPLACE INTO rights_guides
               (slug, title_de, title_en, category, body_md, linked_norms)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                guide["slug"],
                guide["title_de"],
                guide["title_en"],
                guide["category"],
                guide["body_md"],
                guide["linked_norms"],
            ),
        )
        count += 1
        print(f"Seeded: {guide['slug']}")

    conn.commit()
    conn.close()
    print(f"Done. Seeded {count} guides.")


if __name__ == "__main__":
    main()
