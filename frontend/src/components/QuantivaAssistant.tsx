import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const quickPrompts = [
  "Give me top 3 ranked molecules with reasons",
  "Show dataset stats by source",
  "How should I tune efficacy vs safety weights?",
  "Explain Lipinski rules in simple terms",
  "How do I use filters effectively?",
];

const greeting =
  "Hi! I’m Quantiva Assistant 👋 Ask me anything about your molecule scoring, filters, and results.";

async function fetchChatReply(message: string, history: ChatMessage[]) {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const urls = base ? [`${base}/api/chat`] : ["/api/chat", "http://localhost:8080/api/chat"];
  const REQUEST_TIMEOUT_MS = 10000;

  let lastError = "";

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        lastError = body?.error || `${res.status} ${res.statusText}`;
        continue;
      }

      const data = await res.json();
      return String(data.reply || "").trim();
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? `Request timed out (${REQUEST_TIMEOUT_MS / 1000}s) for ${url}`
          : error instanceof Error
            ? error.message
            : "Network error";
    }
  }

  throw new Error(lastError || "Unable to reach chat backend");
}

export default function QuantivaAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isOpen]);

  const onSend = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: "user", text };
    const nextHistory = [...messages.slice(-10), userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await fetchChatReply(text, nextHistory);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            reply ||
            "I couldn’t generate a response right now. Please try again in a moment.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? `Chat service error: ${error.message}`
              : "Chat service is temporarily unavailable.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-5 z-[100] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bot className="h-4 w-4" />
              Quantiva Assistant
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollerRef} className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void onSend(prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "assistant"
                    ? "bg-slate-100 text-slate-700"
                    : "ml-auto bg-indigo-600 text-white"
                }`}
              >
                {m.text}
              </div>
            ))}

            {isLoading && (
              <div className="max-w-[92%] rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                Thinking...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSend();
              }}
              disabled={isLoading}
              placeholder="Ask anything about your drug discovery workflow..."
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-indigo-200 focus:ring"
            />
            <button
              onClick={() => void onSend()}
              disabled={isLoading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[100] inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700"
        aria-label="Open assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    </>
  );
}
