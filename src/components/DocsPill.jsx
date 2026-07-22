import { CheckCircle2, Circle, CircleDotDashed } from "lucide-react";
import { DOC_STATUSES } from "../constants/pipeline";

const styleByStatus = {
  Pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  Partial:
    "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200",
  Complete:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
};

const iconByStatus = {
  Pending: Circle,
  Partial: CircleDotDashed,
  Complete: CheckCircle2,
};

export default function DocsPill({ value, onChange, disabled = false }) {
  const Icon = iconByStatus[value] || Circle;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${styleByStatus[value] || styleByStatus.Pending}`}>
      <Icon size={13} />
      <select
        aria-label="Document status"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-24 bg-transparent outline-none disabled:appearance-none"
      >
        {DOC_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </span>
  );
}
