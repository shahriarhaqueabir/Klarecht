-- Canonical SQLite schema for the German Law Vault (local edition).
-- MUST stay in sync with nextjs/src/lib/db.ts runMigrations().
-- Used by Python ingest/seed scripts.

CREATE TABLE IF NOT EXISTS laws (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT,
  category TEXT,
  abbreviation TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS norms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_key TEXT NOT NULL REFERENCES laws(key) ON DELETE CASCADE,
  norm_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  section TEXT,
  UNIQUE(law_key, norm_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS norms_fts USING fts5(
  law_key, norm_id, title, content,
  content='norms', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS norms_fts_ai AFTER INSERT ON norms BEGIN
  INSERT INTO norms_fts(rowid, law_key, norm_id, title, content)
    VALUES (new.id, new.law_key, new.norm_id, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS norms_fts_ad AFTER DELETE ON norms BEGIN
  INSERT INTO norms_fts(norms_fts, rowid, law_key, norm_id, title, content)
    VALUES ('delete', old.id, old.law_key, old.norm_id, old.title, old.content);
END;
CREATE TRIGGER IF NOT EXISTS norms_fts_au AFTER UPDATE ON norms BEGIN
  INSERT INTO norms_fts(norms_fts, rowid, law_key, norm_id, title, content)
    VALUES ('delete', old.id, old.law_key, old.norm_id, old.title, old.content);
  INSERT INTO norms_fts(rowid, law_key, norm_id, title, content)
    VALUES (new.id, new.law_key, new.norm_id, new.title, new.content);
END;

CREATE TABLE IF NOT EXISTS norm_explanations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  norm_id INTEGER NOT NULL REFERENCES norms(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  explanation TEXT,
  summary TEXT,
  implications TEXT,
  next_steps TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(norm_id, lang)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_key TEXT NOT NULL,
  norm_id TEXT,
  folder_id INTEGER REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  title TEXT,
  notes TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(law_key, norm_id)
);

CREATE TABLE IF NOT EXISTS bookmark_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  incident_date TEXT,
  dispute_value_cents INTEGER,
  status TEXT DEFAULT 'pre_action',
  opposing_party TEXT,
  deadline_date TEXT,
  court_name TEXT,
  case_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  situation TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guidance_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_file_id INTEGER NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  risk_level TEXT CHECK(risk_level IN ('low','medium','high')),
  cost_estimate TEXT,
  steps TEXT,
  timeline TEXT,
  success_probability REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS remediation_playbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(category, issue_type)
);

CREATE TABLE IF NOT EXISTS document_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  category TEXT
);

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

CREATE TABLE IF NOT EXISTS norm_embeddings (
  norm_id INTEGER PRIMARY KEY REFERENCES norms(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL,
  model TEXT NOT NULL DEFAULT 'nomic-embed-text'
);