import { Bell, ChevronDown, KeyRound, LogOut, Moon, Sun, UserCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ROLE_LABELS } from "../constants/pipeline";

const getInitials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "RO";

export default function Header({
  pageTitle,
  profile,
  organisationName,
  theme,
  onToggleTheme,
  onSignOut,
  onChangePassword,
  pendingApprovalsCount,
  isDemoMode,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = useMemo(() => getInitials(profile?.full_name), [profile]);
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "User";

  return (
    <header className="sticky top-0 z-20 border-b border-app bg-app/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4 pl-12 lg:pl-0">
        <div>
          <h1 className="text-xl font-extrabold text-primary">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-secondary">
            {isDemoMode ? "Demo data" : organisationName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingApprovalsCount ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 sm:inline-flex">
              <Bell size={14} />
              {pendingApprovalsCount} pending
            </span>
          ) : null}

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-primary"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="flex items-center gap-2 rounded-lg border border-app bg-surface px-2 py-1.5 transition hover:bg-raised"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-extrabold text-white dark:bg-teal-400 dark:text-zinc-950">
                  {initials}
                </span>
              )}
              <ChevronDown size={15} className="text-secondary" />
            </button>

            {menuOpen ? (
              <div
                className="absolute right-0 mt-2 w-72 rounded-lg border border-app bg-surface p-3 shadow-xl"
                role="menu"
              >
                <div className="border-b border-app pb-3">
                  <p className="font-extrabold text-primary">{profile?.full_name}</p>
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
                  >
                    <UserCircle size={16} />
                    My Profile
                  </button>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-secondary hover:bg-raised hover:text-primary"
                    role="menuitem"
                  >
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    Theme
                  </button>
                  <button
                    type="button"
                    onClick={onChangePassword}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-secondary hover:bg-raised hover:text-primary"
                    role="menuitem"
                  >
                    <KeyRound size={16} />
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
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
        </div>
      </div>
    </header>
  );
}
