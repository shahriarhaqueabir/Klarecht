# SQL Practice Guide — German Law Vault DB

## Database
- File: `data/german-law.db` (SQLite, single file)
- Schema: `scripts/schema.sql` (keep in sync with `nextjs/src/lib/db.ts`)
- Access: `python scripts/sql_practice.py` (read-only by default)

## Quick start
```bash
# Interactive shell
python scripts/sql_practice.py

# Allow writes (careful!)
python scripts/sql_practice.py --write

# Run example file
python scripts/sql_practice.py --file scripts/sql_practice_examples.sql

# Point at another db
python scripts/sql_practice.py --db path/to/other.db
```

## Shell meta commands
| Command | Description |
|---|---|
| `.tables [pattern]` | list tables |
| `.schema [table]` | show CREATE statement |
| `.columns table` | show columns |
| `.indexes [table]` | list indexes |
| `.mode table\|csv\|json` | output format |
| `.timer on\|off` | show timing |
| `.read file.sql` | execute SQL file |
| `.history` | recent statements |
| `.quit` | exit |

## Key tables
- `laws(key, title, title_en, category, abbreviation, created_at)` — 6k+ laws
- `norms(id, law_key, norm_id, title, content, section)` — 100k+ norms
- `norms_fts` — FTS5 (trigram tokenizer) over norms content
- `bookmarks`, `bookmark_folders`
- `conversations`, `messages`
- `case_files`, `guidance_paths`
- `rights_guides`, `document_templates`, `remediation_playbooks`
- `norm_explanations`, `norm_embeddings`

## Tips
- Full-text search uses trigram tokenizer: queries must be ≥3 chars. Use `norms_fts MATCH 'term'`.
- Join `norms_fts` to `norms` on `norms.id = norms_fts.rowid`.
- Writes are blocked in read-only mode; open with `--write` to mutate.
- The DB is large; add `LIMIT` to exploratory queries.
