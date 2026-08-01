import { Sparkles } from "lucide-react";

export default function AskCommandBar({ onOpen }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 h-[var(--ask-command-bar-height)] border-t border-app bg-[var(--glass-header-bg)] px-3 py-2 backdrop-blur lg:left-64"><div className="mx-auto flex h-full max-w-5xl items-center gap-2 rounded-lg border border-app bg-surface px-2 py-1 shadow-sm"><Sparkles size={16} className="ml-1 shrink-0 text-[var(--accent)]" /><button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm text-secondary hover:text-primary">Ask Telora AI about candidates, interviews, vacancies, or follow-ups…</button><button type="button" onClick={onOpen} className="action-button action-primary shrink-0 px-3 py-1.5 text-xs sm:text-sm"><span className="hidden sm:inline">Ask Telora AI</span><span className="sm:hidden">Ask</span></button></div></div>;
}
