import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { PIPELINE_STAGES, STAGE_DEFINITIONS } from "../constants/pipeline";

export default function StageGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-app bg-surface px-3 text-sm font-bold text-secondary transition hover:bg-raised hover:text-primary"
        aria-expanded={open}
      >
        <HelpCircle size={16} />
        Stage guide
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-[min(92vw,420px)] rounded-lg border border-app bg-surface p-4 shadow-xl">
          <p className="mb-3 text-sm font-semibold text-primary">Pipeline stages</p>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage}>
                <p className="text-sm font-bold text-primary">{stage}</p>
                <p className="text-xs leading-5 text-secondary">{STAGE_DEFINITIONS[stage]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
