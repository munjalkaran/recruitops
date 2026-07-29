import { Menu, X } from "lucide-react";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({
  activePage,
  children,
  navItems,
  onNavigate,
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigate = (page) => {
    onNavigate(page);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-app text-primary">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-app bg-surface text-primary shadow-sm lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-app bg-sidebar lg:block">
        <Sidebar
          activePage={activePage}
          navItems={navItems}
          onNavigate={navigate}
          organisationName={organisationName}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-app bg-sidebar">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-md p-2 text-secondary hover:bg-raised hover:text-primary"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
            <Sidebar
              activePage={activePage}
              navItems={navItems}
              onNavigate={navigate}
              organisationName={organisationName}
              pendingApprovalsCount={pendingApprovalsCount}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <Header
          pageTitle={pageTitle}
          profile={profile}
          organisationName={organisationName}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSignOut={onSignOut}
          onChangePassword={onChangePassword}
          isDemoMode={isDemoMode}
        />
        <main className="px-4 pb-36 pt-6 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
