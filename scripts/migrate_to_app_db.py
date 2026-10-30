"""Migrate refined law data from laws.db (processing pipeline) to data/german-law.db (app schema).

Usage:
    python scripts/migrate_to_app_db.py
"""

import sqlite3
import os
import sys

SRC_DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), "laws.db")
DST_DB = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "german-law.db"
)


def main():
    if not os.path.exists(SRC_DB):
        print(f"Source DB not found: {SRC_DB}")
        sys.exit(1)

    src = sqlite3.connect(SRC_DB)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(DST_DB)
    dst.execute("PRAGMA foreign_keys = ON")

    # Clear existing data
    dst.execute("DELETE FROM norms")
    dst.execute("DELETE FROM laws")
    dst.commit()

    # Migrate laws
    laws = src.execute("SELECT key, title, category FROM laws").fetchall()
    for law in laws:
        dst.execute(
            "INSERT OR REPLACE INTO laws (key, title, category) VALUES (?, ?, ?)",
            (law["key"], law["title"], law["category"]),
        )
    dst.commit()
    print(f"Migrated {len(laws)} laws")

    # Migrate norms (join to get law_key)
    norms = src.execute("""
        SELECT n.norm_id, n.title, n.content, l.key AS law_key
        FROM norms n JOIN laws l ON n.law_id = l.id
    """).fetchall()

    batch = []
    for norm in norms:
        batch.append((norm["law_key"], norm["norm_id"], norm["title"], norm["content"]))
        if len(batch) >= 1000:
            dst.executemany(
                "INSERT OR REPLACE INTO norms (law_key, norm_id, title, content) VALUES (?, ?, ?, ?)",
                batch,
            )
            dst.commit()
            batch = []
    if batch:
        dst.executemany(
            "INSERT OR REPLACE INTO norms (law_key, norm_id, title, content) VALUES (?, ?, ?, ?)",
            batch,
        )
        dst.commit()
    print(f"Migrated {len(norms)} norms")

    # Migrate embeddings if they exist
    try:
        embeds = src.execute("""
            SELECT n.id AS norm_src_id, n.embedding, l.key AS law_key, n.norm_id
            FROM norms n JOIN laws l ON n.law_id = l.id
            WHERE n.embedding IS NOT NULL
        """).fetchall()
        if embeds:
            print(f"Found {len(embeds)} embeddings to migrate")
            for e in embeds:
                # Find the corresponding norm in dst
                row = dst.execute(
                    "SELECT id FROM norms WHERE law_key = ? AND norm_id = ?",
                    (e["law_key"], e["norm_id"]),
                ).fetchone()
                if row:
                    dst.execute(
                        "INSERT OR REPLACE INTO norm_embeddings (norm_id, embedding, model) VALUES (?, ?, ?)",
                        (row[0], e["embedding"], "nomic-embed-text"),
                    )
            dst.commit()
            print(f"Migrated embeddings")
    except Exception as ex:
        print(f"Embedding migration skipped: {ex}")

    # Verify
    law_count = dst.execute("SELECT COUNT(*) FROM laws").fetchone()[0]
    norm_count = dst.execute("SELECT COUNT(*) FROM norms").fetchone()[0]
    print(f"Verified: {law_count} laws, {norm_count} norms in {DST_DB}")

    src.close()
    dst.close()


if __name__ == "__main__":
    main()
