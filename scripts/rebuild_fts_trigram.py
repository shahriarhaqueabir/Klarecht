import sqlite3

conn = sqlite3.connect("data/german-law.db")

# Check current FTS tokenizer
sql = conn.execute("SELECT sql FROM sqlite_master WHERE name='norms_fts'").fetchone()[0]
print("Current FTS SQL:", sql[:200])
print()

# Drop old FTS table and triggers
conn.execute("DROP TRIGGER IF EXISTS norms_fts_ai")
conn.execute("DROP TRIGGER IF EXISTS norms_fts_ad")
conn.execute("DROP TRIGGER IF EXISTS norms_fts_au")
conn.execute("DROP TABLE IF EXISTS norms_fts")
conn.commit()

# Create trigram FTS table
conn.execute("""
    CREATE VIRTUAL TABLE norms_fts USING fts5(
        law_key, norm_id, title, content,
        content='norms', content_rowid='id',
        tokenize='trigram'
    )
""")

# Create sync triggers
conn.execute("""
    CREATE TRIGGER norms_fts_ai AFTER INSERT ON norms BEGIN
        INSERT INTO norms_fts(rowid, law_key, norm_id, title, content)
        VALUES (new.id, new.law_key, new.norm_id, new.title, new.content);
    END
""")
conn.execute("""
    CREATE TRIGGER norms_fts_ad AFTER DELETE ON norms BEGIN
        INSERT INTO norms_fts(norms_fts, rowid, law_key, norm_id, title, content)
        VALUES ('delete', old.id, old.law_key, old.norm_id, old.title, old.content);
    END
""")
conn.execute("""
    CREATE TRIGGER norms_fts_au AFTER UPDATE ON norms BEGIN
        INSERT INTO norms_fts(norms_fts, rowid, law_key, norm_id, title, content)
        VALUES ('delete', old.id, old.law_key, old.norm_id, old.title, old.content);
        INSERT INTO norms_fts(rowid, law_key, norm_id, title, content)
        VALUES (new.id, new.law_key, new.norm_id, new.title, new.content);
    END
""")

# Rebuild index
conn.execute("INSERT INTO norms_fts(norms_fts) VALUES('rebuild')")
conn.commit()

# Verify
count = conn.execute(
    "SELECT COUNT(*) FROM norms_fts WHERE norms_fts MATCH 'Miete'"
).fetchone()[0]
print(f'FTS trigram search for "Miete": {count} results')
sample = conn.execute(
    "SELECT law_key, norm_id, title FROM norms_fts WHERE norms_fts MATCH 'Miete' LIMIT 5"
).fetchall()
for r in sample:
    print(f"  {r[0]} {r[1]}: {r[2]}")
conn.close()
print("Done!")
