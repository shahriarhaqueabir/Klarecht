import "@testing-library/jest-dom/vitest";

// Provide a minimal Worker polyfill for jsdom so that code which
// references `Worker` globally doesn't crash during tests. Individual
// tests should stub their own Worker implementation via vi.stubGlobal.
if (typeof globalThis.Worker === "undefined") {
  class WorkerPolyfill {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    postMessage = () => {};
    terminate = () => {};
    addEventListener = () => {};
    removeEventListener = () => {};
    dispatchEvent = () => false;
  }
  (globalThis as any).Worker = WorkerPolyfill;
}

// Local-only: Ollama URL for tests
process.env.NEXT_PUBLIC_OLLAMA_URL = "http://localhost:11434";
