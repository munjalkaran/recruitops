import { Bot, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

const prompts = [
  "Show overdue follow-ups",
  "How many candidates are interviewing?",
  "Show candidates for Kotak Bank",
  "Which recruiters have the most active candidates?",
  "Show feedback pending",
  "Show interviews scheduled today",
  "Which joined candidates are ready for invoicing?",
];

export default function AskAIPanel({ onAsk, onClose }) {
  const inputRef = useRef(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async (event, value = input) => {
    event?.preventDefault();
    const question = value.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setLoading(true);
    try {
      const response = await onAsk(question);
      setMessages((current) => [...current, { role: "assistant", text: response.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={<span className="flex items-center gap-2"><Sparkles size={17} className="text-[var(--accent)]" />Ask Telora AI</span>} description="Search and understand the data currently available to your role." onClose={onClose} size="max-w-xl" variant="drawer" footer={<form onSubmit={send} className="flex items-end gap-2"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(event); } }} rows={2} placeholder="Ask a question…" className="min-h-12 flex-1 resize-none rounded-lg border border-app bg-raised px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-[var(--accent-soft)]" aria-label="Ask Telora AI a question" /><button type="submit" disabled={loading || !input.trim()} className="action-button action-primary disabled:opacity-50" aria-label="Send question"><Send size={16} /></button></form>}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? <div className="rounded-xl border border-app bg-surface p-5 text-center"><Bot size={24} className="mx-auto text-[var(--accent)]" /><p className="mt-3 text-sm font-semibold text-primary">Ask about your live pipeline</p><p className="mt-1 text-sm text-secondary">Answers use only data available to your current role.</p></div> : null}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-8 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-primary" : "mr-8 rounded-xl border border-app bg-surface px-4 py-3 text-sm text-primary"}><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">{message.role === "user" ? "You" : "Telora AI"}</p>{message.text}</div>)}
          {loading ? <div className="mr-8 rounded-xl border border-app bg-surface px-4 py-3 text-sm text-secondary">Checking available data…</div> : null}
          <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-secondary">Suggested prompts</p>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => send(null, prompt)} className="mr-2 mb-2 rounded-full border border-app bg-surface px-3 py-2 text-left text-xs text-secondary hover:bg-raised hover:text-primary">{prompt}</button>)}</div>
        </div>
    </Modal>
  );
}
