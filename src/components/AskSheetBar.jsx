import { Sparkles } from "lucide-react";

export default function AskSheetBar({ value, response, onChange, onSubmit }) {
  const submit = (event) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <div className="mx-auto max-w-3xl">
        <form
          onSubmit={submit}
          className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-1 items-center gap-2 px-2">
            <Sparkles size={16} strokeWidth={2.4} className="shrink-0 text-teal-600 dark:text-teal-300" />
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Ask the sheet"
              className="h-9 w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Ask
          </button>
        </form>
        {response ? (
          <p className="mt-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            {response}
          </p>
        ) : null}
      </div>
    </div>
  );
}
