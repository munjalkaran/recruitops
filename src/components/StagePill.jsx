import { PIPELINE_STAGES, STAGE_STYLES } from "../constants/pipeline";

const getStyle = (stage) => STAGE_STYLES[stage] || STAGE_STYLES.Sourced;

export default function StagePill({ value, onChange, disabled = false }) {
  const style = getStyle(value);

  return (
    <select
      aria-label="Pipeline stage"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-32 rounded-full border px-3 py-1 text-xs font-bold outline-none transition focus:ring-2 focus:ring-teal-100 disabled:appearance-none dark:focus:ring-teal-900/60"
      style={{
        backgroundColor: style.background,
        color: style.color,
        borderColor: style.border,
      }}
    >
      {PIPELINE_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {stage}
        </option>
      ))}
    </select>
  );
}
