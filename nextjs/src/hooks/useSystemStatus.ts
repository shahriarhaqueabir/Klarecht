"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "../components/chat-context";

//  Types

export interface ServiceStatus {
  label: string;
  status: "ok" | "warn" | "error" | "unknown";
  message: string;
}

export interface SystemStatus {
  /** Overall worst status across all services */
  overall: "ok" | "warn" | "error" | "unknown";
  /** Per-service statuses */
  services: ServiceStatus[];
  /** Current AI mode */
  mode: string;
  /** Timestamp of last check */
  lastChecked: string;
}

//  SSRF-safe localhost check (same regex as useChatStrategy)

const LOCAL_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

//  Hook

export function useSystemStatus(): SystemStatus {
  const { settings, mode } = useChat();

  const [lastChecked, setLastChecked] = useState<string>(
    new Date().toISOString(),
  );
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [dbStatus, setDbStatus] = useState<{
    laws: number;
    norms: number;
    embeddings: number;
  } | null>(null);

  //  Check Ollama from browser
  const checkOllama = useCallback(async () => {
    const url = settings.ollamaUrl || "http://localhost:11434";
    if (!LOCAL_URL_REGEX.test(url)) {
      setOllamaReachable(false);
      return;
    }
    try {
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        setOllamaReachable(true);
        setOllamaModels((data.models || []).map((m: any) => m.name));
      } else {
        setOllamaReachable(false);
      }
    } catch {
      setOllamaReachable(false);
    }
  }, [settings.ollamaUrl]);

  //  Check database status via API
  const checkDb = useCallback(async () => {
    try {
      const res = await fetch("/api/diagnostics", {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      setDbStatus(data.db || null);
    } catch {
      setDbStatus(null);
    }
  }, []);

  //  Run all checks
  const runChecks = useCallback(() => {
    checkOllama();
    checkDb();
    setLastChecked(new Date().toISOString());
  }, [checkOllama, checkDb]);

  // Initial check + poll every 30s
  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, [runChecks]);

  //  Build status object
  const services: ServiceStatus[] = [];

  // 1. SQLite Database
  services.push({
    label: "Database (SQLite)",
    status: dbStatus ? "ok" : "unknown",
    message: dbStatus
      ? `${dbStatus.laws} laws, ${dbStatus.norms} norms`
      : "Not checked",
  });

  // 2. Vector Search (embeddings)
  const embedCount = dbStatus?.embeddings || 0;
  const totalNorms = dbStatus?.norms || 0;
  const embedPct =
    totalNorms > 0 ? Math.round((embedCount / totalNorms) * 100) : 0;
  services.push({
    label: "Vector Search",
    status: embedCount > 0 ? (embedPct >= 100 ? "ok" : "warn") : "unknown",
    message:
      embedCount > 0
        ? `${embedCount.toLocaleString()} / ${totalNorms.toLocaleString()} norms embedded (${embedPct}%)`
        : "No embeddings yet",
  });

  // 3. Ollama (always shown in local mode)
  if (mode === "local" || true) {
    services.push({
      label: "Local AI (Ollama)",
      status:
        ollamaReachable === true
          ? "ok"
          : ollamaReachable === false
            ? "error"
            : "unknown",
      message:
        ollamaReachable === true
          ? `${ollamaModels.length} models available`
          : ollamaReachable === false
            ? "Unreachable - start Ollama (ollama serve)"
            : "Checking...",
    });
  }

  // Overall status = worst case
  const priority: Record<string, number> = {
    error: 0,
    warn: 1,
    unknown: 2,
    ok: 3,
  };
  const worst = services.reduce(
    (worst, s) =>
      (priority[s.status] || 0) < (priority[worst] || 3) ? s.status : worst,
    "ok" as ServiceStatus["status"],
  );

  return {
    overall: worst,
    services,
    mode,
    lastChecked,
  };
}
