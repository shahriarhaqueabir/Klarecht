import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Legal Chat — Private German Law Assistant | German Law Vault",
  description:
    "Chat with an AI legal assistant about German federal laws — completely privately. Chat with an AI legal assistant about German federal laws. Powered by Ollama running locally on your machine.",
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    title: "AI Legal Chat — Private German Law Assistant | German Law Vault",
    description:
      "Privacy-first AI chat for German law. Run AI in your browser, connect your own OpenAI key, or use a local Ollama model. No data sent to third parties without your consent.",
    url: "/chat",
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
