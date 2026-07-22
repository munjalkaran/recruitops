import { FileDown, Search, Upload, UserPlus } from "lucide-react";
import { PIPELINE_STAGES } from "../constants/pipeline";
import { canCreateCandidate, canImportCsv } from "../utils/permissions";
import StageGuideButton from "./StageGuideButton";

export default function Toolbar({
  searchTerm,
  recruiterFilter,
  stageFilter,
  profiles,
  activeProfile,
  shownCount,
  totalCount,
  onSearchChange,
  onRecruiterChange,
  onStageChange,
  onClearFilters,
  onAddCandidate,
  onImportClick,
  onExport,
  onResumeImport,
}) {
  return (
    <div className="rounded-lg border border-app bg-surface p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="relative block">
            <Search
              size={15}
              strokeWidth={2.2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
            />
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search name, bank, role..."
              className="h-10 w-full rounded-lg border border-app bg-raised py-2 pl-9 pr-3 text-sm text-primary outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:border-teal-700 dark:focus:ring-teal-900/60 md:w-80"
              aria-label="Search candidates"
            />
          </label>

          {activeProfile?.role === "admin" ? (
            <select
              value={recruiterFilter}
              onChange={(event) => onRecruiterChange(event.target.value)}
              className="h-10 rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:border-teal-700 dark:focus:ring-teal-900/60"
              aria-label="Recruiter filter"
            >
              <option value="all">All recruiters</option>
              <option value="unassigned">Unassigned</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={stageFilter || "all"}
            onChange={(event) => onStageChange(event.target.value === "all" ? null : event.target.value)}
            className="h-10 rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:border-teal-700 dark:focus:ring-teal-900/60"
            aria-label="Stage filter"
          >
            <option value="all">All stages</option>
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          <StageGuideButton />

          <button
            type="button"
            onClick={onClearFilters}
            className="h-10 rounded-lg px-2 text-sm font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateCandidate(activeProfile) ? (
            <>
              <button
                type="button"
                onClick={onAddCandidate}
                className="action-button bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-zinc-950 dark:hover:bg-teal-300"
              >
                <UserPlus size={16} />
                Add Candidate
              </button>
              <button
                type="button"
                onClick={onResumeImport}
                className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
              >
                Import Resume
              </button>
            </>
          ) : null}
          {canImportCsv(activeProfile) ? (
            <button
              type="button"
              onClick={onImportClick}
              className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
            >
              <Upload size={16} />
              Import CSV
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExport}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <FileDown size={16} />
            Export to Excel
          </button>
          <p className="ml-1 text-sm font-medium text-secondary">
            {shownCount} of {totalCount} shown
          </p>
        </div>
      </div>
    </div>
  );
}
