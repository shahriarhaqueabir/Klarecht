# German Law Vault — Workflows

This document describes the end-to-end workflows of the German Law Vault (local edition).

## 1. Data pipeline (one-time)

```
download_de_laws.py  ->  de_federal_raw/ (6,147 XML files)
process_de_laws.py   ->  laws.db (6,147 laws, 107,864 norms)
migrate_to_app_db.py ->  data/german-law.db (app schema)
rebuild_fts_trigram.py -> FTS5 trigram index (norms_fts)
seed_rights_guides.py  -> rights_guides table
ingest_embeddings.py   -> norm_embeddings (resumable, ~6h)
```

## 2. Search workflow

1. User enters a query (DE or EN).
2. `translateQueryToGerman` converts English queries to German via term map + local Ollama.
3. FTS5 trigram search runs BM25 ranking over `norms_fts`.
4. Optional vector search (Ollama `nomic-embed-text`) adds semantic recall.
5. Hybrid results are merged, highlighted, and returned.
6. FTS works immediately; embeddings improve recall over time.

## 3. Law viewing + translation

1. User opens a law/norm.
2. `explain` route calls local Ollama (`qwen2.5:1.5b-translate`) to translate German text.
3. Results are cached in `norm_explanations` and `translations_cache` (SQLite).
4. UI shows original + translation, labeled AI vs. official.

## 4. AI chat (RAG)

1. User asks a legal question.
2. Relevant norms retrieved via FTS (+ vector when available).
3. Local Ollama chat model (`german-legal`) generates an answer with citations.
4. Conversation + messages persisted in SQLite.

## 5. AI guidance

1. User describes a situation.
2. System classifies category and generates 3-5 outcome paths (risk, cost, timeline).
3. Paths persisted to `case_files` + `guidance_paths`.

## 6. Document templates

1. User selects a template (Widerspruch, Mahnung, etc.).
2. Form data fills placeholders.
3. Generated German document returned for download.

## 7. Bookmarks & case folders

1. User saves a law/norm to a folder.
2. Stored in `bookmarks` + `bookmark_folders` with status/notes.

## 8. Translation cache

- `translations_cache(source_text, target_lang, translation)` persists across restarts.
- Term-map fast path avoids model calls.
- Ollama fallback only when term map misses.

## 9. Testing & verification

```
cd nextjs
npx tsc --noEmit          # type check
npm run lint               # eslint
npx vitest run             # 239 tests
npm run test:evals         # eval cases
```

## 10. Security posture

- 100% local: no cloud calls except none; Ollama on localhost.
- No credentials, no auth, single user.
- Input validated with Zod; errors sanitized.
- Dependencies audited; unused cloud deps removed.
- SQLite single file; back up `data/german-law.db`.