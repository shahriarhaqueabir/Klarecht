"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Database,
  Plug,
  Brain,
  FileText,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { useChat } from "../../components/chat-context";
import { useOnboarding } from "../../components/onboarding-context";
import { useLanguage } from "../../hooks/useLanguage";
import {
  ChatMode,
  ChatSettings,
  MODE_LABELS,
  LANGUAGE_LABELS,
} from "../../lib/types";
import { RECOMMENDED_LOCAL_MODELS } from "../../lib/model-constants";
import { SystemStatus } from "../../components/system-status";

const MODE_ICONS: Record<ChatMode, typeof Plug> = {
  local: Plug,
  basic: FileText,
};

const MODE_LIMITATIONS: Record<ChatMode, string[]> = {
  local: [
    "Requires Ollama running on your machine (ollama serve)",
    "Direct Ollama connection on port 11434 — no broker needed",
    "Two models: 'german-legal' (6.6GB) for full analysis/guidance; 'qwen2.5:1.5b-translate' (1GB) for fast section translations",
  ],
  basic: [
    "No AI analysis or reasoning — shows raw legal text excerpts",
    "Best for quick lookups or when you prefer to read the law directly",
  ],
};

const MODE_STATUS_NOTE: Record<ChatMode, string> = {
  local: "Ollama on localhost:11434",
  basic: "Always available — no setup required",
};

export default function SettingsPage() {
  useEffect(() => {
    document.title = "Settings — German Law Vault";
  }, []);

  const { settings, updateSettings } = useChat();
  const {
    state: onboardingState,
    setShowWizard,
    resetOnboarding,
  } = useOnboarding();
  const { language } = useLanguage();
  const [brokerOk, setBrokerOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [storedProvider, setStoredProvider] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [keyDecryptable, setKeyDecryptable] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);

  // Check Ollama health + fetch available models when in local mode
  useEffect(() => {
    if (settings.mode !== "local") return;
    const check = () => {
      fetch(`${settings.ollamaUrl}/api/tags`)
        .then(async (r) => {
          if (r.ok) {
            setBrokerOk(true);
            const data = await r.json();
            const models: string[] = (data.models || []).map(
              (m: { name: string }) => m.name,
            );
            if (models.length) {
              setAvailableModels(models);
            }
          } else {
            setBrokerOk(false);
          }
        })
        .catch(() => {
          setBrokerOk(false);
          setAvailableModels(null);
        });
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [settings.mode, settings.ollamaUrl]);

  const update = (patch: Partial<ChatSettings>) => {
    updateSettings(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (settings.mode === "local") {
        // Lightweight test — check Ollama directly via /api/tags
        try {
          const res = await fetch(`${settings.ollamaUrl}/api/tags`, {
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            setBrokerOk(true);
            const data = await res.json();
            const modelNames: string[] = (data.models || []).map(
              (m: { name: string }) => m.name,
            );
            const modelList = modelNames.length
              ? modelNames.join(", ")
              : "no models installed";
            setTestResult(`✓ Connected — Models: ${modelList}`);
          } else {
            setBrokerOk(false);
            setTestResult(
              "Ollama returned an error — check that ollama serve is running",
            );
          }
        } catch {
          setBrokerOk(false);
          setTestResult(
            "Ollama unreachable — ensure Ollama is running (ollama serve)",
          );
        }
      } else {
        setTestResult("Mode active");
      }
    } catch (err: unknown) {
      setTestResult(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 bg-transparent min-h-screen relative">
      <div className="flex items-center justify-between mb-16 pb-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
            <Settings className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40 mb-1">
              Settings
            </p>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
              Configuration
            </h1>
          </div>
        </div>
        {saved && (
          <span
            className="text-xs font-black uppercase tracking-[0.3em] text-accent-gold-bright animate-fade-in bg-accent-gold/10 px-3 py-1 border border-accent-gold/20"
            role="status"
            aria-live="polite"
          >
            Saved
          </span>
        )}
      </div>

      {/* ── Onboarding Section ── */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
            Onboarding
          </h2>
          <div className="h-px w-full bg-zinc-800/50" />
        </div>
        <div className="glass-panel p-6 border-white/5">
          {onboardingState.completed ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-400">
                  You completed setup on {onboardingState.completedDate}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Language: {LANGUAGE_LABELS[language]} · Mode: {settings.mode}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-4 py-2 border border-accent-gold/20 text-accent-gold-body text-xs font-bold hover:bg-accent-gold/10 transition-all"
                >
                  View Setup Guide
                </button>
                <button
                  onClick={resetOnboarding}
                  className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/5 transition-all"
                >
                  Restart Onboarding
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                {onboardingState.step > 0
                  ? `Continue where you left off (Step ${onboardingState.step + 1})`
                  : "Set up your AI advisor and language preferences"}
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="px-4 py-2 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all"
              >
                {onboardingState.step > 0 ? "Continue" : "Start Setup"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Chat Mode Selector ── */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
            AI Mode
          </h2>
          <div className="h-px w-full bg-zinc-800/50" />
        </div>

        <div className="grid gap-3">
          {(
            Object.entries(MODE_LABELS) as [
              ChatMode,
              (typeof MODE_LABELS)[ChatMode],
            ][]
          ).map(([mode, info]) => {
            const Icon = MODE_ICONS[mode];
            const isActive = settings.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => update({ mode })}
                className={`flex items-start gap-6 p-6 border text-left transition-colors duration-500 relative overflow-hidden group ${
                  isActive
                    ? "border-accent-gold/40 bg-white/[0.03] shadow-premium"
                    : "border-white/5 bg-transparent hover:border-white/10 hover:bg-white/[0.01]"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent-gold shadow-[0_0_15px_var(--accent-gold-glow)]" />
                )}
                <div
                  className={`p-3 border transition-colors duration-500 ${
                    isActive
                      ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold-bright"
                      : "border-white/5 bg-white/5 text-zinc-400 group-hover:text-zinc-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-serif font-bold text-xl text-white">
                      {info.label}
                    </span>
                    {isActive && (
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-accent-gold-body bg-accent-gold/10 px-2 py-0.5 border border-accent-gold/20">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
                    {info.description}
                  </p>
                  {isActive && (
                    <div className="mt-4 space-y-2 pt-4 border-t border-white/5">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                        Limitations
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {MODE_LIMITATIONS[mode].map((lim, i) => (
                          <p
                            key={i}
                            className="text-xs text-zinc-500 font-bold flex items-start gap-2 italic"
                          >
                            <span className="text-accent-gold-body opacity-40">
                              /
                            </span>
                            {lim}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Mode-specific Configuration ── */}

      {/* Global AI Constraints (Parameters) */}
      {(settings.mode === "local") && (
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
              AI Parameters
            </h2>
            <div className="h-px w-full bg-zinc-800/50" />
          </div>

          <div className="glass-panel p-8 border-white/5 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Temperature ({settings.ollamaParams.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.ollamaParams.temperature}
                  onChange={(e) =>
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-accent-gold"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase">
                    Precise
                  </span>
                  <span className="text-xs font-bold text-zinc-400 uppercase">
                    Creative
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Max Generation Tokens
                </label>
                <input
                  type="number"
                  value={settings.ollamaParams.max_tokens || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        max_tokens: isNaN(val) ? 0 : val,
                      },
                    });
                  }}
                  className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/40 transition-colors font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Top P ({settings.ollamaParams.top_p})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.ollamaParams.top_p}
                  onChange={(e) =>
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        top_p: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-accent-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Top K ({settings.ollamaParams.top_k})
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.ollamaParams.top_k}
                  onChange={(e) =>
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        top_k: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-accent-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                System Prompt
              </label>
              <textarea
                rows={6}
                value={settings.ollamaParams.system_prompt}
                onChange={(e) =>
                  update({
                    ollamaParams: {
                      ...settings.ollamaParams,
                      system_prompt: e.target.value,
                    },
                  })
                }
                className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/40 focus:bg-white/10 transition-colors font-sans text-xs leading-relaxed"
              />
              <p className="text-xs text-zinc-400 font-bold mt-3 italic">
                These guidelines ensure all AI modes maintain
                the same &quot;Rechtsexperte&quot; persona and citation
                standards.
              </p>
            </div>
          </div>
        </section>
      )}

      {settings.mode === "local" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-8">
            <Plug className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Local Ollama Configuration
            </h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={settings.ollamaUrl}
                  onChange={(e) => update({ ollamaUrl: e.target.value })}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/40 focus:bg-white/10 transition-colors font-mono text-sm"
                />
              </div>

            </div>

            {/* Recommended models info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-white/10 bg-white/[0.02]">
                <p className="text-xs font-black text-accent-gold-bright uppercase tracking-[0.2em] mb-1">
                  Recommended — Translation
                </p>
                <p className="text-xs font-bold font-mono text-zinc-300 mb-2">
                  qwen2.5:1.5b-translate (1GB)
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Lightweight model for fast section-by-section translations in
                  all 9 languages. Runs with temperature 0 for precision. Pull
                  with:
                  <code className="block mt-1 text-accent-gold-body font-mono">
                    ollama pull qwen2.5:1.5b-translate
                  </code>
                </p>
              </div>
              <div className="p-4 border border-white/10 bg-white/[0.02]">
                <p className="text-xs font-black text-amber-400 uppercase tracking-[0.2em] mb-1">
                  Recommended — Analysis
                </p>
                <p className="text-xs font-bold font-mono text-zinc-300 mb-2">
                  german-legal:latest (6.6GB)
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Full legal guidance model with multi-step reasoning, citation
                  analysis, and outcome prediction. Includes German law
                  guardrails via Modelfile. Pull with:
                  <code className="block mt-1 text-accent-gold-body font-mono">
                    ollama pull german-legal:latest
                  </code>
                </p>
              </div>
            </div>

            {/* Any model note */}
            <div className="p-4 border border-accent-gold/20 bg-accent-gold/[0.03]">
              <p className="text-xs font-black text-accent-gold-bright uppercase tracking-[0.2em] mb-2">
                Use Any Ollama Model
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                You can use any Ollama-compatible model — not just the
                recommended ones. The model field above auto-populates from your
                installed models when Ollama is connected. Just make sure the
                model is pulled (
                <code className="text-accent-gold-body font-mono">
                  ollama pull &lt;name&gt;
                </code>
                ) and enter its name in the field.
              </p>
            </div>

            {/* Connection panel */}
            <div className="p-4 border border-accent-gold/20 bg-accent-gold/[0.03]">
              <p className="text-xs font-black text-accent-gold-bright uppercase tracking-[0.2em] mb-2">
                Connection Steps:
              </p>
              <ol className="space-y-1.5">
                <li className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-accent-gold-bright font-black shrink-0">
                    1.
                  </span>
                  Ensure <span className="font-bold text-zinc-300">Ollama</span>{" "}
                  is running:
                  <code className="block mt-0.5 ml-4 text-accent-gold-body font-mono">
                    ollama serve
                  </code>
                </li>
                <li className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-accent-gold-bright font-black shrink-0">
                    2.
                  </span>
                  Pull your model(s):
                  <code className="block mt-0.5 ml-4 text-accent-gold-body font-mono">
                    ollama pull german-legal:latest
                  </code>
                </li>
                <li className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-accent-gold-bright font-black shrink-0">
                    3.
                  </span>
                  Click{" "}
                  <span className="font-bold text-zinc-300">
                    Test Connection
                  </span>{" "}
                  below
                </li>
                <li className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-accent-gold-bright font-black shrink-0">
                    4.
                  </span>
                  Select your model from the dropdown and start chatting
                </li>
              </ol>
            </div>

            {/* Button row */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-6 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright disabled:opacity-20 transition-all duration-500 active:scale-95 shadow-premium"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>

            {/* Status display */}
            {testResult && (
              <div
                className={`p-4 border text-sm font-bold ${
                  testResult.includes("\u2713")
                    ? "border-accent-gold/20 bg-accent-gold/5 text-accent-gold-bright"
                    : testResult.includes("Error") ||
                        testResult.includes("failed") ||
                        testResult.includes("not running")
                      ? "border-red-900/40 bg-red-950/20 text-red-400"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {testing ? (
                    <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                  ) : brokerOk ? (
                    <div className="w-2 h-2 rounded-full bg-accent-gold-bright shadow-[0_0_8px_var(--accent-gold-bright)]" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  <span className="whitespace-pre-line">{testResult}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-400 font-bold italic border-l border-accent-gold/20 pl-4">
              Note: {MODE_STATUS_NOTE.local}
            </p>
          </div>
        </section>
      )}



      {settings.mode === "basic" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <FileText className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Basic Search Mode
            </h2>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
              Bypasses AI analysis and retrieves raw statutory text from local
              SQLite database. No API key or setup required.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-white/5 bg-white/[0.01]">
                <p className="text-xs font-black text-accent-gold-body uppercase tracking-[0.2em] mb-2">
                  Search & Browse
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Full-text and semantic search across all 6,000+ laws and
                  103,000+ sections. Always available.
                </p>
              </div>
              <div className="p-4 border border-white/5 bg-white/[0.01]">
                <p className="text-xs font-black text-accent-gold-body uppercase tracking-[0.2em] mb-2">
                  Section Translation
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Translations use Ollama (configurable via OLLAMA_TRANSLATE_MODEL).
                  No browser download required.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Test Connection Button ── */}

      {/* ── System Status ── */}
      <section className="border-t border-white/5 pt-12">
        <div className="flex items-center gap-4 mb-8">
          <Database className="w-5 h-5 text-zinc-600" />
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 opacity-50 shrink-0">
            System Status
          </h2>
          <div className="h-px w-full bg-zinc-800/50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dynamic live status panel */}
          <div className="p-5 border border-white/5 bg-white/[0.01]">
            <SystemStatus panel />
          </div>
          {/* Service info */}
          <div className="space-y-3">
            <div className="p-5 border border-white/5 bg-white/[0.01]">
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">
                Vector Database
              </p>
              <p className="text-xs text-zinc-400 font-bold">
                SQLite FTS5 + Ollama (Local)
              </p>
            </div>
            <div className="p-5 border border-white/5 bg-white/[0.01]">
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">
                Database
              </p>
              <p className="text-xs text-zinc-400 font-bold">
                SQLite (Local // 6,147 Laws // 107,864 Norms)
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
