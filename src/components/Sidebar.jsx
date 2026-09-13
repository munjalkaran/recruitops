import {
  Archive,
  Bell,
  CheckSquare,
  ChevronDown,
  FileText,
  KeyRound,
  LogOut,
  ReceiptText,
  Settings,
  Table2,
  UserCircle,
  Users,
  Sparkles,
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ROLE_LABELS } from "../constants/pipeline";
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

const getInitials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T";

export default function Sidebar({
  activePage,
  navItems,
  onNavigate,
  organisationName,
  pendingApprovalsCount,
  profile,
  onSignOut,
  onChangePassword,
}) {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { surfaceRef, triggerRef } = useDismissibleSurface(comingSoonOpen, () => setComingSoonOpen(false));
  const { surfaceRef: accountSurfaceRef, triggerRef: accountTriggerRef, close: closeAccount } = useDismissibleSurface(accountOpen, () => setAccountOpen(false), { closeOnScroll: true });
  const initials = useMemo(() => getInitials(profile?.full_name), [profile]);
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "User";

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

      <div className="mt-auto space-y-2 pt-5">
        <div className="relative rounded-lg border border-app bg-raised p-2">
          <button
            type="button"
            onClick={() => setAccountOpen((current) => !current)}
            ref={accountTriggerRef}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-surface"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                {initials}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-primary">{profile?.full_name || "Telora user"}</span>
              <span className="block truncate text-[11px] font-semibold uppercase text-secondary">{roleLabel}</span>
            </span>
            <ChevronDown size={14} className="shrink-0 text-secondary" />
          </button>

          {accountOpen ? (
            <div
              ref={accountSurfaceRef}
              className="glass-panel absolute bottom-[calc(100%+0.5rem)] left-0 z-40 w-full rounded-lg border p-3 shadow-lg"
              role="menu"
            >
              <div className="border-b border-app pb-3">
                <p className="font-semibold text-primary">{profile?.full_name}</p>
                <p className="text-sm text-secondary">{profile?.email || "No email set"}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                  {roleLabel} · {organisationName}
                </p>
              </div>

              <div className="mt-2 space-y-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-secondary hover:bg-raised hover:text-primary"
                  role="menuitem"
                  onClick={closeAccount}
                >
                  <UserCircle size={16} />
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => { onChangePassword?.(); closeAccount(); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-secondary hover:bg-raised hover:text-primary"
                  role="menuitem"
                >
                  <KeyRound size={16} />
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={() => { onSignOut?.(); closeAccount(); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  role="menuitem"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          ) : null}
        </div>

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
