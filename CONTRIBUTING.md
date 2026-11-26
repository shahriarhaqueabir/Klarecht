# Contributing to German Law Vault

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4
- **Database**: SQLite (better-sqlite3) — single file, no server
- **Search**: FTS5 (BM25 trigram) + Ollama nomic-embed-text (vector similarity)
- **AI**: Ollama (chat, embeddings, translation) — fully local, no cloud APIs
- **Testing**: Vitest 4.1+, React Testing Library
- **Linting**: ESLint 9
- **Animation**: motion 12.40+
- **Validation**: Zod 4.4+

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.10+ (for data ingest scripts)
- [Ollama](https://ollama.com) installed and running

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/Klarecht.git
cd Klarecht

# 2. Install Node dependencies
cd nextjs && npm install

# 3. Set up Ollama models
ollama pull nomic-embed-text:latest

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with your Ollama URL and model names

# 5. Download and ingest German laws (one-time, ~20 min)
cd ..
python scripts/download_de_laws.py
python scripts/process_de_laws.py
python scripts/migrate_to_app_db.py
python scripts/rebuild_fts_trigram.py

# 6. Seed rights guides
python scripts/seed_rights_guides.py --db data/german-law.db --dir data/rights-guides

# 7. (Optional) Run embedding ingest (one-time, ~6 hours)
python scripts/ingest_embeddings.py

# 8. Start the app
cd nextjs && npm run dev  # → http://localhost:3000
```

### Ollama Setup

The app auto-detects available models from your Ollama instance. Recommended models:

- **Chat/Guidance**: Any 7B+ model (e.g., Qwythos 9B, Llama 3, Mistral)
- **Embeddings**: `nomic-embed-text` (required for semantic search)
- **Translation**: Any 1.5B+ model (e.g., Qwen 1.5B, Phi-3 Mini)

Set `OLLAMA_MODELS` env var if your models are in a non-default directory:

```bash
[System.Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "E:\path\to\models", "User")
```

### Testing

```bash
cd nextjs
npm test                    # Run all tests (233 passing)
npx vitest run              # Same as above
npx tsc --noEmit           # TypeScript type check (0 errors)
npm run lint                # ESLint
```

### Code Quality

- Follow existing codebase patterns (grep before edit)
- Write tests for new functionality
- Run `tsc --noEmit` + `vitest run` before committing
- Small focused commits, conventional commit messages

## Architecture

```
Browser (localhost:3000) → Next.js server → SQLite (data/german-law.db) + Ollama (localhost:11434)
```

- **No cloud services** — everything runs on your machine
- **No auth** — single user, no login required
- **No credentials** — no API keys, no encryption, no secrets

## License

Apache License 2.0 — See [LICENSE](LICENSE) for details.
