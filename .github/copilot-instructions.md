# German Law Vault - AI-Assisted Development Guide

## Project Overview

German Law Vault provides a comprehensive search engine and AI-guided legal assistant for all 6,000+ German federal laws from gesetze-im-internet.de. Runs entirely locally — no cloud services, no API keys.

## Architecture

- **Frontend**: Next.js 16 (App Router) with React 19, Tailwind CSS 4
- **Database**: SQLite (better-sqlite3) — single file at `data/german-law.db`
- **Search**: FTS5 (BM25 trigram) + Ollama nomic-embed-text (vector similarity)
- **AI**: Ollama (localhost:11434) — chat, embeddings, translation
- **No auth, no cloud, no credentials** — single user, single machine

## Key Conventions

- TypeScript strict mode - no `any` or `@ts-ignore`
- All API routes use Zod validation where applicable
- SQLite via `better-sqlite3` — synchronous API, use `createDb()`/`closeDb()` from `lib/db.ts`
- 9 languages: DE/EN/TR/AR/FR/ES/PL/UK/RU
- 2 chat modes: basic (search only), local (Ollama AI)

## Critical Gotchas

- **FTS5 trigram tokenizer**: `norms_fts` uses trigram tokenizer for German compound word matching. "Miete" matches "Mieterhöhung" because all 3-char sequences overlap. Requires query >= 3 chars; shorter queries fall back to LIKE.
- **E5-prefix rule (adapted)**: Embeddings use `passage:` prefix for indexing, `query:` prefix for search. This is critical for search quality.
- **Ollama auto-detection**: `model-selector.ts` queries `/api/tags` and picks best model per role. Don't hardcode model names.
- **Database path**: Defaults to `../data/german-law.db` relative to cwd. Override with `GERMAN_LAW_DB_PATH` env var.
- **WAL mode**: SQLite uses WAL journal mode. The DB file has `-wal` and `-shm` sidecar files.

## Commands

```bash
cd nextjs && npm run dev         # Development (localhost:3000)
cd nextjs && npm test            # Run tests (233 passing)
cd nextjs && npx tsc --noEmit   # Type check (0 errors)
cd nextjs && npm run lint        # ESLint
```

## Data Pipeline

```bash
python scripts/download_de_laws.py    # Download 6,147 laws from gesetze-im-internet.de
python scripts/process_de_laws.py     # Parse XML → laws.db
python scripts/migrate_to_app_db.py   # Migrate laws.db → data/german-law.db
python scripts/rebuild_fts_trigram.py # Build FTS5 trigram index
python scripts/seed_rights_guides.py  # Seed rights guides
python scripts/ingest_embeddings.py   # Embed norms (long-running, resumable)
```

## File Structure

- `nextjs/src/lib/db.ts` — SQLite connection + schema + migrations
- `nextjs/src/lib/search.ts` — FTS5 + law-key extraction
- `nextjs/src/lib/ollama.ts` — Ollama client (health, chat, embed, translate)
- `nextjs/src/lib/model-selector.ts` — Auto-detect available models
- `nextjs/src/lib/types.ts` — TypeScript types and constants
- `nextjs/src/lib/guidance.ts` — AI guidance engine
- `nextjs/src/lib/bookmarks-v2.ts` — Local bookmark storage
- `data/german-law.db` — SQLite database (single file)
- `data/rights-guides/` — Curated markdown guides
