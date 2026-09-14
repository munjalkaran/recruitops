import { Bookmark, ChevronDown, FileDown, Search, Trash2, Upload, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canCreateCandidate, canImportCsv } from "../utils/permissions";
import StageGuideButton from "./StageGuideButton";
import useDismissibleSurface from "../hooks/useDismissibleSurface";

export default function Toolbar({ searchTerm, activeProfile, shownCount, totalCount, activeColumnFilterCount = 0, staleOnly = false, onSearchChange, onClearColumnFilters, onClearStaleFilter, onClearFilters, onAddCandidate, onImportClick, onExport, onResumeImport, savedViews = [], onSaveView, onDeleteView, onApplyView, currentViewFilters = {} }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [viewName, setViewName] = useState("");
  const [isSavingView, setIsSavingView] = useState(false);
  const savedViewsTriggerRef = useRef(null);
  const exportTriggerRef = useRef(null);
  const saveViewInputRef = useRef(null);
  const exportOpen = openMenu === "export";
  const savedViewsOpen = openMenu === "saved";
  const { surfaceRef: menuRef, triggerRef: activeMenuTrigger, close: closeMenu } = useDismissibleSurface(Boolean(openMenu), () => setOpenMenu(null));
  const hasFilters = Boolean(searchTerm || activeColumnFilterCount || staleOnly);
  const saveCurrentView = () => {
    const cleanName = viewName.trim();
    if (!cleanName) return;
    onSaveView?.({ name: cleanName, filters: currentViewFilters });
    setViewName("");
    setIsSavingView(false);
  };

  useEffect(() => {
    if (openMenu === "saved") activeMenuTrigger.current = savedViewsTriggerRef.current;
    if (openMenu === "export") activeMenuTrigger.current = exportTriggerRef.current;
  }, [activeMenuTrigger, openMenu]);

  useEffect(() => {
    if (!savedViewsOpen) {
      setIsSavingView(false);
      setViewName("");
      return;
    }
    if (isSavingView) saveViewInputRef.current?.focus();
  }, [isSavingView, savedViewsOpen]);

  return <section className="glass-panel glass-toolbar relative z-40 rounded-lg border p-2.5">
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 md:max-w-sm"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" /><input value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search name, bank, role..." className="glass-chip h-10 w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-primary outline-none" aria-label="Search candidates" /></label>
      </div>
      <div ref={menuRef} className="flex shrink-0 flex-wrap items-center gap-2">
        {canCreateCandidate(activeProfile) ? <><button type="button" onClick={onAddCandidate} className="action-button action-primary"><UserPlus size={16} /> Add Candidate</button><button type="button" onClick={onResumeImport} className="glass-control action-button border"><Upload size={15} /> Import Resume</button></> : null}
        {canImportCsv(activeProfile) ? <button type="button" onClick={onImportClick} className="glass-control action-button border"><Upload size={15} /> Import CSV</button> : null}
        <div className="relative">
          <button
            type="button"
            ref={savedViewsTriggerRef}
            onClick={() => setOpenMenu((current) => current === "saved" ? null : "saved")}
            className="glass-control action-button border"
            aria-expanded={savedViewsOpen}
          >
            <Bookmark size={15} /> Saved views <ChevronDown size={14} />
          </button>
          {savedViewsOpen ? (
            <div className="glass-menu absolute right-0 top-11 z-40 w-72 rounded-lg border p-1.5" role="menu">
              {savedViews.length ? (
                <div className="py-1">
                  {savedViews.map((view) => (
                    <div key={view.id} className="group/view flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-raised focus-within:bg-raised">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyView?.(view);
                          closeMenu();
                        }}
                        className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-primary"
                        role="menuitem"
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteView?.(view)}
                        className="rounded p-1 text-secondary opacity-0 hover:bg-surface hover:text-primary focus:opacity-100 group-hover/view:opacity-100 group-focus-within/view:opacity-100"
                        aria-label={`Delete saved view ${view.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={savedViews.length ? "mt-1 border-t border-app pt-1" : "py-1"}>
                {isSavingView ? (
                  <input
                    ref={saveViewInputRef}
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveCurrentView();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        setViewName("");
                        setIsSavingView(false);
                      }
                    }}
                    placeholder="Name this view"
                    className="h-9 w-full rounded-md border border-app bg-raised px-2.5 text-xs text-primary outline-none"
                    aria-label="Name this view"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setViewName("");
                      setIsSavingView(true);
                    }}
                    className="row-menu-item text-secondary"
                    role="menuitem"
                  >
                    + Save current view
                  </button>
                )}
                {!savedViews.length ? <p className="px-2.5 pb-1 pt-1 text-xs text-secondary">Save your current filters for the next review.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative"><button type="button" ref={exportTriggerRef} onClick={() => setOpenMenu((current) => current === "export" ? null : "export")} className="glass-control action-button border" aria-expanded={exportOpen}><FileDown size={15} /> Export <ChevronDown size={14} /></button>{exportOpen ? <div className="glass-menu absolute right-0 top-11 z-40 w-56 rounded-lg border p-1.5" role="menu"><button type="button" onClick={() => { onExport(); closeMenu(); }} className="row-menu-item" role="menuitem">Export current view to CSV</button></div> : null}</div>
      </div>
    </div>
    <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-app pt-2"><div className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="text-xs font-medium text-secondary">{shownCount} of {totalCount} candidates</span>{searchTerm ? <FilterChip label={`Search: ${searchTerm}`} onClear={() => onSearchChange("")} /> : null}{activeColumnFilterCount ? <FilterChip label={`${activeColumnFilterCount} column filter${activeColumnFilterCount === 1 ? "" : "s"}`} onClear={onClearColumnFilters} /> : null}{staleOnly ? <FilterChip label="Overdue only" onClear={onClearStaleFilter} /> : null}</div><div className="flex items-center gap-2">{hasFilters ? <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-secondary underline-offset-4 hover:text-primary hover:underline">Clear filters</button> : null}<StageGuideButton /></div></div>
  </section>;
}

function FilterChip({ label, onClear }) { return <span className="glass-chip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-secondary">{label}<button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-raised" aria-label={`Clear ${label}`}><X size={11} /></button></span>; }
