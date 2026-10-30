"""Embed all norms using Ollama's nomic-embed-text and store in SQLite.

Usage:
    python scripts/ingest_embeddings.py [--db data/german-law.db] [--batch 50] [--resume]

Resumable: skips norms that already have embeddings in norm_embeddings table.
Progress is saved after each batch.
"""

import argparse
import json
import sqlite3
import time
import urllib.request
import os
import sys
import struct

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
BATCH_SIZE = 50
MAX_RETRIES = 5


def embed_batch(texts):
    """Embed a batch of texts using Ollama."""
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/embed",
        data=json.dumps({"model": EMBED_MODEL, "input": texts}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
        return data.get("embeddings", [])


def db_write_with_retry(conn, sql, params, max_retries=MAX_RETRIES):
    """Execute a write with retry on database locked."""
    for attempt in range(max_retries):
        try:
            conn.execute(sql, params)
            conn.commit()
            return True
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower():
                wait = 0.5 * (2**attempt)
                print(
                    f"  DB locked, retrying in {wait}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(wait)
            else:
                raise
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/german-law.db")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE)
    args = parser.parse_args()

    db_path = os.path.abspath(args.db)
    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")

    total = conn.execute("SELECT COUNT(*) FROM norms").fetchone()[0]
    done = conn.execute("SELECT COUNT(*) FROM norm_embeddings").fetchone()[0]
    remaining = total - done
    print(f"Total norms: {total}, already embedded: {done}, remaining: {remaining}")

    if remaining == 0:
        print("All norms already embedded!")
        conn.close()
        return

    cursor = conn.execute("""
        SELECT n.id, n.law_key, n.norm_id, n.title, n.content
        FROM norms n
        LEFT JOIN norm_embeddings e ON n.id = e.norm_id
        WHERE e.norm_id IS NULL
        ORDER BY n.id
    """)

    batch = []
    batch_ids = []
    processed = 0
    errors = 0
    start_time = time.time()

    for row in cursor:
        norm_id, law_key, norm_id_text, title, content = row
        text = f"passage: [{law_key}] {title or ''} {content or ''}".strip()
        text = text[:2000]
        batch.append(text)
        batch_ids.append(norm_id)

        if len(batch) >= args.batch:
            try:
                embeddings = embed_batch(batch)
                if len(embeddings) == len(batch_ids):
                    for nid, emb in zip(batch_ids, embeddings):
                        db_write_with_retry(
                            conn,
                            "INSERT OR REPLACE INTO norm_embeddings (norm_id, embedding, model) VALUES (?, ?, ?)",
                            (nid, struct.pack(f"{len(emb)}f", *emb), EMBED_MODEL),
                        )
                    processed += len(batch)
                    elapsed = time.time() - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    eta = (remaining - processed) / rate / 3600 if rate > 0 else 0
                    print(
                        f"Embedded {processed}/{remaining} ({100 * processed / remaining:.1f}%) - {rate:.1f}/s - ETA {eta:.1f}h"
                    )
                else:
                    print(
                        f"Warning: got {len(embeddings)} embeddings for {len(batch_ids)} texts"
                    )
                    errors += len(batch_ids)
            except Exception as e:
                print(f"Error embedding batch: {e}")
                errors += len(batch_ids)
                time.sleep(2)
            batch = []
            batch_ids = []
            time.sleep(0.05)

    if batch:
        try:
            embeddings = embed_batch(batch)
            if len(embeddings) == len(batch_ids):
                for nid, emb in zip(batch_ids, embeddings):
                    db_write_with_retry(
                        conn,
                        "INSERT OR REPLACE INTO norm_embeddings (norm_id, embedding, model) VALUES (?, ?, ?)",
                        (nid, struct.pack(f"{len(emb)}f", *emb), EMBED_MODEL),
                    )
                processed += len(batch)
                print(
                    f"Embedded {processed}/{remaining} ({100 * processed / remaining:.1f}%)"
                )
        except Exception as e:
            print(f"Error embedding final batch: {e}")
            errors += len(batch)

    final_done = conn.execute("SELECT COUNT(*) FROM norm_embeddings").fetchone()[0]
    print(f"\nDone! Embedded: {final_done}/{total} norms. Errors: {errors}")
    conn.close()


if __name__ == "__main__":
    main()
