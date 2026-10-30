import { useCallback } from "react";
import { ChatMode, CitedLaw, ChatSettings, LANGUAGE_NAMES } from "../lib/types";
import { ANALYSIS_MODEL } from "../lib/model-constants";
import { stripThinkTags } from "../lib/prompt-format";
import { buildOllamaChatBody, parseOllamaStreamLine } from "../lib/ollama";

interface Message {
  role: "user" | "assistant";
  content: string;
  citedLaws?: CitedLaw[];
  thinking?: boolean;
}

interface ChatStrategyProps {
  settings: ChatSettings;
  mode: ChatMode;
  conversationId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLoading: (loading: boolean) => void;
}

function isInThinkBlock(text: string): boolean {
  const lastOpen = text.lastIndexOf("<think>");
  const lastClose = text.lastIndexOf("</think>");
  if (lastOpen === -1) return false;
  return lastOpen > lastClose;
}

function getStreamingDisplay(text: string): {
  display: string;
  thinking: boolean;
} {
  if (isInThinkBlock(text)) {
    return { display: "Thinking...", thinking: true };
  }
  const stripped = stripThinkTags(text);
  if (stripped) {
    return { display: stripped, thinking: false };
  }
  if (text.includes("<think>")) {
    return { display: "Thinking...", thinking: true };
  }
  return { display: text, thinking: false };
}

const OLLAMA_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function isValidOllamaUrl(url: string): boolean {
  return OLLAMA_URL_REGEX.test(url);
}

export function useChatStrategy({
  settings,
  mode,
  conversationId,
  setMessages,
  setLoading,
}: ChatStrategyProps) {
  const sendMessage = useCallback(
    async (userMsg: string) => {
      const body = {
        message: userMsg,
        mode,
        language: settings.language,
        conversationId: conversationId || undefined,
      };

      try {
        if (mode === "local") {
          const ollamaUrl = settings.ollamaUrl || "http://localhost:11434";

          if (!isValidOllamaUrl(ollamaUrl)) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "⚠️ **Ollama URL rejected.**\n\nThe URL must be a localhost address (e.g. http://localhost:11434).",
              },
            ]);
            setLoading(false);
            return;
          }

          const searchRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, mode: "basic" }),
          });
          const searchData = await searchRes.json();
          const citedLaws = searchData.citedLaws || [];
          const contextStr = citedLaws
            .map((l: CitedLaw) =>
              l.content
                ? `[${l.law_key} ${l.norm_id}] ${l.law_title}\n${l.content}`
                : `[${l.law_key} ${l.norm_id}] ${l.law_title}`,
            )
            .join("\n\n");

          let ollamaRes: Response;
          try {
            const ollamaBody = buildOllamaChatBody({
              message: userMsg,
              context: contextStr,
              model: ANALYSIS_MODEL,
              systemPrompt: settings.ollamaParams?.system_prompt,
              language: LANGUAGE_NAMES[settings.language] || "English",
              temperature: settings.ollamaParams?.temperature,
              top_p: settings.ollamaParams?.top_p,
              top_k: settings.ollamaParams?.top_k,
              max_tokens: settings.ollamaParams?.max_tokens,
              stream: true,
            });

            ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ollamaBody),
              signal: AbortSignal.timeout(120000),
            });

            if (!ollamaRes.ok) {
              const errText = await ollamaRes
                .text()
                .catch(() => "Unknown error");
              throw new Error(
                `Ollama returned ${ollamaRes.status}: ${errText}`,
              );
            }
          } catch (ollamaErr) {
            const isNetworkError =
              ollamaErr instanceof TypeError &&
              ollamaErr.message === "Failed to fetch";
            const isHttpsOrigin =
              typeof window !== "undefined" &&
              window.location.protocol === "https:";
            let guidance: string;
            if (isNetworkError && isHttpsOrigin) {
              guidance =
                "Connection blocked — the browser does not allow HTTPS pages to reach localhost without explicit CORS headers.\n\n" +
                "**Fix**: Restart Ollama with CORS allowed:\n" +
                "```\nOLLAMA_ORIGINS=* ollama serve\n```\n\n" +
                "Refresh this page after restarting Ollama.\n\n";
            } else if (isNetworkError) {
              guidance =
                "Connection refused — Ollama is not running or not reachable.\n\n" +
                "**Fix**: Start Ollama:\n" +
                "```\nollama serve\n```\n\n" +
                "Then refresh this page and try again.\n\n";
            } else {
              guidance = `Error: ${ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr)}\n\n`;
            }
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "⚠️ **Local AI unavailable.**\n\n" + guidance,
              },
            ]);
            setLoading(false);
            return;
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", citedLaws },
          ]);

          const reader = ollamaRes.body?.getReader();
          if (!reader) throw new Error("Body not readable");
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const parsed = parseOllamaStreamLine(trimmed);
              if (parsed) {
                if (parsed.done) break;
                accumulatedContent += parsed.content;
                const { display, thinking } =
                  getStreamingDisplay(accumulatedContent);
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: display,
                    thinking,
                  };
                  return updated;
                });
              }
            }
          }

          setMessages((prev) => {
            const updated = [...prev];
            const finalContent = stripThinkTags(accumulatedContent);
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content:
                (finalContent || "(no response)") +
                "\n\n---\n*Generated by Local AI (Ollama).*",
              thinking: false,
            };
            return updated;
          });
          setLoading(false);
          return;
        }

        // --- BASIC STRATEGY ---
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "API Error");

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: stripThinkTags(data.response) || "No response.",
            citedLaws: data.citedLaws || [],
          },
        ]);
      } catch (err) {
        console.error("Chat Error:", err);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [settings, mode, conversationId, setMessages, setLoading],
  );

  return { sendMessage, browserAIStatus: "idle" };
}
