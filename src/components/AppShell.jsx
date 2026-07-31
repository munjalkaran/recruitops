import { Menu, X } from "lucide-react";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AskCommandBar from "./AskCommandBar";

export default function AppShell({
  activePage,
  children,
  navItems,
  onNavigate,
  pageTitle,
  profile,
  organisationName,
  onSignOut,
  onChangePassword,
  pendingApprovalsCount,
  isDemoMode,
  onAskAI,
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
        className="glass-control fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border text-primary shadow-sm lg:hidden"
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
          <aside className="glass-modal relative h-full w-72 border-r border-app bg-sidebar">
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

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <Header
          pageTitle={pageTitle}
          profile={profile}
          organisationName={organisationName}
          onSignOut={onSignOut}
          onChangePassword={onChangePassword}
          isDemoMode={isDemoMode}
        />
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(var(--ask-command-bar-height)+var(--ask-command-bar-gap))] pt-5 sm:px-6 lg:px-10 lg:pt-6">{children}</main>
      </div>
      <AskCommandBar onOpen={onAskAI} />
    </div>
  );
}
