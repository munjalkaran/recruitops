import {
  Archive,
  Bell,
  CheckSquare,
  FileText,
  ReceiptText,
  Settings,
  Table2,
  Users,
  Sparkles,
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { TeloraLogo, TeloraWordmark } from "./TeloraLogo";
import useDismissibleSurface from "../hooks/useDismissibleSurface";

const upcomingFeatures = [
  "AI resume parsing",
  "Direct Gmail and Outlook integration",
  "WhatsApp follow-ups",
  "Automated stale reminders",
  "Advanced reporting",
];

const icons = {
  overview: LayoutDashboard,
  pipeline: Table2,
  invoicing: ReceiptText,
  approvals: CheckSquare,
  archived: Archive,
  team: Users,
  administration: Settings,
  followups: Bell,
  requests: FileText,
  vacancies: BriefcaseBusiness,
  interviews: CalendarDays,
};

export default function Sidebar({
  activePage,
  navItems,
  onNavigate,
  organisationName,
  pendingApprovalsCount,
}) {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const { surfaceRef, triggerRef, close } = useDismissibleSurface(comingSoonOpen, () => setComingSoonOpen(false));

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <TeloraLogo size={40} />
          <div>
            <TeloraWordmark />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-secondary">
          Talent, tracked with clarity. Powered by AI.
        </p>
        <div className="mt-4 rounded-lg border border-app bg-raised px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Organisation</p>
          <p className="mt-1 text-sm font-semibold text-primary">{organisationName}</p>
        </div>
      </div>

      <nav className="space-y-1" aria-label="Telora navigation">
        {navItems.map((item) => {
          const Icon = icons[item.id] || Table2;
          const active = activePage === item.id;
          const count = item.id === "approvals" ? pendingApprovalsCount : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-secondary hover:bg-raised hover:text-primary"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                {item.label}
              </span>
              {count ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-5">
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setComingSoonOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-lg border border-app bg-raised px-3 py-2.5 text-left text-sm font-bold text-primary hover:border-teal-300"
          aria-expanded={comingSoonOpen}
        >
          <span className="flex items-center gap-2"><Sparkles size={16} className="text-teal-600" /> Coming Soon</span>
          <span className="text-xs text-secondary">{comingSoonOpen ? "Hide" : "View"}</span>
        </button>
        {comingSoonOpen ? (
          <div ref={surfaceRef} className="glass-panel mt-2 max-h-60 overflow-auto rounded-lg border p-2 shadow-sm">
            {upcomingFeatures.map((feature) => (
              <div key={feature} className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
                <span className="font-semibold leading-5 text-secondary">{feature}</span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Planned</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
