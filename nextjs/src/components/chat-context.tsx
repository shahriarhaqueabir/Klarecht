"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ChatMode, ChatSettings, DEFAULT_CHAT_SETTINGS } from "../lib/types";
import { SYSTEM_PROMPT } from "../lib/chat";

const STORAGE_KEY = "glv_chat_settings";

// ── SSRF Protection: Ollama URL validation ──
// Only allow localhost/loopback addresses to prevent SSRF attacks
const OLLAMA_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isValidOllamaUrl(url: string): boolean {
  return OLLAMA_URL_REGEX.test(url);
}

function sanitizeOllamaUrl(
  url: string,
  fallback: string = "http://localhost:11434",
): string {
  if (isValidOllamaUrl(url)) return url;
  // Also allow empty/undefined (use default)
  if (!url || url.trim() === "") return fallback;
  // Invalid URL — log warning and return fallback
  console.warn(
    `[SSRF] Invalid Ollama URL rejected: "${url}". Using fallback: ${fallback}`,
  );
  return fallback;
}

interface ChatContextType {
  settings: ChatSettings;
  updateSettings: (patch: Partial<ChatSettings>) => void;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

function loadSavedSettings(): ChatSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      // Auto-migrate legacy broker URLs to direct Ollama port
      if (
        loaded.brokerUrl === "http://localhost:9090" ||
        loaded.brokerUrl === "http://localhost:9000"
      ) {
        loaded.brokerUrl = "http://localhost:11434";
      }
      // Migrate legacy brokerUrl → ollamaUrl
      if (loaded.brokerUrl && !loaded.ollamaUrl) {
        loaded.ollamaUrl = loaded.brokerUrl;
      }
      // SSRF mitigation: reject non-localhost Ollama URLs
      if (loaded.ollamaUrl) {
        loaded.ollamaUrl = sanitizeOllamaUrl(loaded.ollamaUrl);
      }

      // Deep merge with defaults to ensure all fields (including nested ones) exist
      const merged: ChatSettings = {
        ...DEFAULT_CHAT_SETTINGS,
        ...loaded,
        ollamaParams: {
          ...DEFAULT_CHAT_SETTINGS.ollamaParams,
          ...(loaded.ollamaParams || {}),
        },
      };

      // Ensure system prompt is synced if empty in storage
      if (!merged.ollamaParams.system_prompt) {
        merged.ollamaParams.system_prompt = SYSTEM_PROMPT;
      }
      return merged;
    }
  } catch { }
  return null;
}

function buildDefaultSettings(): ChatSettings {
  // Use a deep copy to prevent reference sharing with DEFAULT_CHAT_SETTINGS.ollamaParams
  const base: ChatSettings = JSON.parse(JSON.stringify(DEFAULT_CHAT_SETTINGS));

  if (!base.ollamaParams.system_prompt) {
    base.ollamaParams.system_prompt = SYSTEM_PROMPT;
  }
  // Use NEXT_PUBLIC_OLLAMA_URL or legacy NEXT_PUBLIC_BROKER_URL if available
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || process.env.NEXT_PUBLIC_BROKER_URL;
    if (envUrl) {
      base.ollamaUrl = sanitizeOllamaUrl(envUrl, base.ollamaUrl);
    }
  }
  return base;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with defaults — matches SSR output exactly.
  // This eliminates hydration mismatches between server and client.
  const [settings, setSettings] = useState<ChatSettings>(buildDefaultSettings);

  // On mount: load saved settings from localStorage and apply them.
  // This runs after hydration, so no SSR mismatch.
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) {
      setSettings((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    // SSRF mitigation: validate Ollama URL before saving
    const sanitizedPatch = { ...patch };
    if (sanitizedPatch.ollamaUrl !== undefined) {
      sanitizedPatch.ollamaUrl = sanitizeOllamaUrl(sanitizedPatch.ollamaUrl);
    }
    // Also handle legacy patch.brokerUrl for backward compat
    if ((sanitizedPatch as any).brokerUrl !== undefined && !sanitizedPatch.ollamaUrl) {
      sanitizedPatch.ollamaUrl = sanitizeOllamaUrl((sanitizedPatch as any).brokerUrl);
    }
    if (sanitizedPatch.language !== undefined) {
      // Sync language to cookie for server-side hydration (ADR-009)
      document.cookie = `glv_lang=${sanitizedPatch.language}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const next = { ...settings, ...sanitizedPatch };
    setSettings(next);
    // Persist settings to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("glv_settings_updated"));
  };

  const setMode = (mode: ChatMode) => updateSettings({ mode });

  return (
    <ChatContext.Provider
      value={{
        settings,
        updateSettings,
        mode: settings.mode,
        setMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
