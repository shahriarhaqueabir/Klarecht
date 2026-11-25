# Migration Plan: Ollama → llama.cpp (Next.js)

## Status: PLANNED (not started) — Config pre-updated 2026-11-18

## Current State
- **Framework:** Next.js (App Router)
- **AI Integration:** Ollama via `src/lib/ollama.ts`
- **Models:**
  - `ANALYSIS_MODEL = "german-legal:latest"` (custom Ollama model, ~6.6GB)
  - `TRANSLATION_MODEL = "qwen2.5:1.5b-translate"` (custom Ollama model, ~1GB)
- **API Routes:** `/api/chat`, `/api/explain`, `/api/models`, `/api/diagnostics`
- **Ollama health check:** `src/hooks/useSystemStatus.ts`

## Pre-Updated Config (2026-11-18)
The following config changes have already been applied:
- `nextjs/.env.local` updated:
  - Added `LLAMA_SERVER_URL=http://127.0.0.1:18010`
  - Added `LLAMA_TRANSLATE_URL=http://127.0.0.1:18011`
  - Added `LLAMA_EMBED_URL=http://127.0.0.1:18012`
  - Added `LLAMA_MODEL=Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M`
  - Added `LLAMA_TRANSLATE_MODEL=Qwen2.5-1.5B-Instruct-Q4_K_M`
  - Added `LLAMA_EMBED_MODEL=bge-m3-Q5_K_M`
  - Added `MODELS_DIR=E:\Projects\ai\models`
  - Legacy Ollama vars commented out

Code still calls Ollama endpoints — migration of API routes is still needed.

## Target State
- Use llama.cpp `llama-server` as the backend (OpenAI-compatible API)
- Model: GGUF file from `E:\Projects\ai\models\`
- Update Next.js API routes to call llama-server instead of Ollama

## Migration Steps

### Phase 1: llama-server Setup
1. Create a startup script or systemd service to launch llama-server:
   ```powershell
   llama-server -m "E:\Projects\ai\models\Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf" --port 18010 --host 127.0.0.1
   ```
2. Or integrate server lifecycle into the Next.js app (spawn child process on startup)
3. Add `LLAMA_SERVER_URL=http://127.0.0.1:18010` to `.env.local`

### Phase 2: Create llama.cpp Client (`src/lib/llama.ts`)
Replace `src/lib/ollama.ts` with an OpenAI-compatible client:

```typescript
// src/lib/llama.ts
const LLAMA_URL = process.env.LLAMA_SERVER_URL || "http://127.0.0.1:18010";

export async function chat(messages: {role: string, content: string}[], model?: string) {
  const res = await fetch(`${LLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "default",
      messages,
      stream: false,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
```

### Phase 3: Update API Routes

#### `/api/chat/route.ts`
- Replace Ollama `generate` call with llama.cpp `/v1/chat/completions`
- Handle system prompt (German law guardrails) as a system message
- Support streaming via SSE

#### `/api/explain/route.ts`
- Replace Ollama call with llama.cpp
- Pass translation context as user message

#### `/api/models/route.ts`
- Instead of listing Ollama models, list available GGUF files in `E:\Projects\ai\models\`
- Or return a fixed model name

#### `/api/diagnostics/route.ts`
- Check llama-server health via `GET /health` instead of Ollama status

### Phase 4: Update Model Constants
```typescript
// src/lib/model-constants.ts
export const ANALYSIS_MODEL = "Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M" as const;
export const TRANSLATION_MODEL = "Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M" as const;
```
(Or keep separate models if multiple GGUFs are loaded on different ports)

### Phase 5: Update Hooks
- `useSystemStatus.ts`: Check llama-server health instead of Ollama
- `useChatStrategy.ts`: Update model selection logic

### Phase 6: System Prompt Migration
- Extract the German law guardrails from the Ollama Modelfile
- Store as a system prompt in the codebase (e.g., `src/lib/prompts.ts`)
- Pass as `system` message in chat completions

### Phase 7: Testing
- Test chat with German legal questions
- Test translation (German → English/French/etc.)
- Test streaming responses
- Test model switching (if multiple models on different ports)

## Files to Modify
- `src/lib/ollama.ts` → replace with `src/lib/llama.ts`
- `src/lib/model-constants.ts` — update model names
- `src/lib/model-selector.ts` — update selection logic
- `src/app/api/chat/route.ts` — migrate API call
- `src/app/api/explain/route.ts` — migrate API call
- `src/app/api/models/route.ts` — list GGUF files
- `src/app/api/diagnostics/route.ts` — health check
- `src/hooks/useSystemStatus.ts` — health check
- `src/hooks/useChatStrategy.ts` — update logic
- `.env.local` — add `LLAMA_SERVER_URL`

## Dependencies
- llama.cpp v1.0.0 at `E:\Projects\tools\llama-b12359\` (on PATH)
- At least one GGUF model in `E:\Projects\ai\models\`

## Estimated Effort
- Phase 1-2: 2-3 hours
- Phase 3-4: 3-4 hours
- Phase 5-6: 2-3 hours
- Phase 7: 1-2 hours
- Total: ~8-12 hours (focused session)
