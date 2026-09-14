import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Telora layout contracts", () => {
  it("keeps Ask AI in the sidebar footer instead of a fixed bottom bar", () => {
    const header = read("components/Header.jsx");
    const shell = read("components/AppShell.jsx");
    const sidebar = read("components/Sidebar.jsx");
    const theme = read("styles/theme.css");
    expect(header).not.toContain("Ask AI");
    expect(header).not.toContain("onAskAI");
    expect(header).not.toContain("Demo fallback");
    expect(shell).not.toContain("AskCommandBar");
    expect(shell).not.toContain("var(--ask-command-bar");
    expect(shell).toContain("onAskAI={openAskAI}");
    expect(sidebar).toContain("Ask Telora");
    expect(sidebar).toContain("onAskAI?.()");
    expect(sidebar).not.toContain("Ask Telora AI about");
    expect(theme).not.toContain("--ask-command-bar");
    expect(read("components/AskAIPanel.jsx")).toContain('import Modal from "./Modal"');
    expect(read("components/AskAIPanel.jsx")).not.toContain("fixed inset-0 z-[60]");
  });

  it("removes the Overview Pipeline Focus card and keeps the time-aware greeting", () => {
    const overview = read("components/OverviewPage.jsx");
    expect(overview).not.toContain("Pipeline focus");
    expect(overview).toContain("getTimeAwareGreeting");
    expect(overview).toContain("A view of the pipeline, follow-ups, approvals, and placements that need attention.");
    expect(overview).not.toContain("A calm view");
    expect(overview).toContain("slice(0, 4)");
  });

  it("keeps Administration balanced and Theme out of the profile menu", () => {
    const settings = read("components/SettingsPage.jsx");
    const permissions = read("utils/permissions.js");
    const header = read("components/Header.jsx");
    expect(settings).toContain("min-[900px]:grid-cols-");
    expect(settings).toContain("Billing");
    expect(settings).toContain("DemoDataManager");
    expect(settings).toContain("min-[900px]:col-span-2");
    expect(settings).toContain("min-[900px]:row-start-2");
    expect(header).not.toContain("Theme");
    expect(header).not.toContain("onToggleTheme");
    expect(permissions).toContain('{ id: "administration", label: "Administration" }');
    expect(permissions).not.toContain('{ id: "settings", label: "Settings" }');
  });

  it("renders Stage Guide through a body portal outside scroll containers", () => {
    const stageGuide = read("components/StageGuideButton.jsx");
    expect(stageGuide).toContain("createPortal");
    expect(stageGuide).toContain("document.body");
    expect(stageGuide).toContain('title="Stage guide"');
    expect(stageGuide).toContain("fixed z-[90]");
  });

  it("keeps all dialogs on the shared glass modal shell", () => {
    const modal = read("components/Modal.jsx");
    expect(modal).toContain("glass-modal");
    expect(modal).toContain("createPortal");
    expect(modal).toContain("document.body");
    expect(modal).toContain("backdrop-blur-md");
    expect(modal).toContain('z-[100]');
    expect(modal).toContain('style={{ WebkitBackdropFilter: "blur(14px)" }}');
    expect(modal).toContain('document.body.style.overflow = "hidden"');
    expect(modal).toContain('event.key !== "Tab"');
    expect(modal).toContain("glass-modal-body-bg");
  });

  it("keeps Coming Soon limited to genuinely future capabilities", () => {
    const sidebar = read("components/Sidebar.jsx");
    expect(sidebar).not.toContain('"Ask Telora AI"');
    expect(sidebar).not.toContain('"Interview management"');
    expect(sidebar).not.toContain('"Vacancy management"');
    expect(sidebar).not.toContain('"PDF invoices"');
    expect(sidebar).toContain("useDismissibleSurface");
    expect(sidebar).toContain("ref={surfaceRef}");
    expect(sidebar).toContain("ref={triggerRef}");
  });

  it("keeps the permanent-delete path admin-only and dependency-safe", () => {
    const permissions = read("utils/permissions.js");
    const migration = read("../supabase/migrations/202608010003_safe_permanent_candidate_delete.sql");
    const app = read("App.jsx");
    expect(permissions).toContain("isAdmin(profile) && !candidate?.is_demo");
    expect(migration).toContain("actor := public.assert_admin()");
    expect(migration).toContain("delete from public.interviews");
    expect(migration).toContain("finalised invoice");
    expect(app).toContain("getPermanentDeleteErrorMessage");
    expect(app).toContain('console.error("Telora permanent candidate deletion failed"');
  });

  it("keeps interview feedback validation and shared modal behavior", () => {
    const interview = read("components/InterviewDialog.jsx");
    const page = read("components/InterviewsPage.jsx");
    expect(interview).toContain('mode === "feedback" && form.recommendation === "Reject"');
    expect(interview).toContain("Save feedback");
    expect(interview).toContain('import Modal from "./Modal"');
    expect(page).toContain('setDialog({ mode: "feedback", interview })');
  });

  it("keeps the organisation card while removing redundant page subtitles", () => {
    const header = read("components/Header.jsx");
    const sidebar = read("components/Sidebar.jsx");
    expect(header).not.toContain("pageTitle !==");
    expect(sidebar).toContain("Organisation");
    expect(sidebar).toContain("organisationName");
  });

  it("routes demo fallback selection through the service boundary", () => {
    const app = read("App.jsx");
    const fallback = read("services/demoFallback.js");
    expect(app).toContain("resolveDemoRows");
    expect(app).toContain("mockVacancies");
    expect(app).toContain("mockInterviews");
    expect(fallback).toContain("shouldUseDemoFallback");
  });

  it("keeps Actual Joining Date visible in the grid and on the operations path", () => {
    const grid = read("components/CandidateGrid.jsx");
    const app = read("App.jsx");
    expect(grid).toContain('{ label: "Actual Joining Date", key: "actual_joining_date"');
    expect(grid).toContain('case "actual_joining_date"');
    expect(app).toContain('await supabase.rpc("update_candidate_operations"');
    expect(app).not.toContain('"expected_joining_date","actual_joining_date","joining_risk"');
  });

  it("explains stale follow-up warnings and hides closed-stage follow-up edits", () => {
    const grid = read("components/CandidateGrid.jsx");
    const dialog = read("components/CandidateDetailsDialog.jsx");
    expect(grid).toContain("formatFollowUpTooltip");
    expect(grid).toContain("Overdue follow-up - was due");
    expect(dialog).toContain("CLOSED_STAGES.includes");
    expect(dialog).toContain('field === "next_follow_up" && hideNextFollowUp');
  });

  it("keeps pipeline filtering in the grid headers instead of toolbar dropdowns", () => {
    const grid = read("components/CandidateGrid.jsx");
    const toolbar = read("components/Toolbar.jsx");
    expect(grid).toContain("CANDIDATE_GRID_FILTER_TYPES");
    expect(grid).toContain("cycleCandidateSort");
    expect(grid).toContain("aria-sort");
    expect(toolbar).not.toContain("All stages");
    expect(toolbar).not.toContain("All recruiters");
    expect(toolbar).toContain("column filter");
  });

  it("keeps Telora logos inline so app chrome never depends on a runtime image fetch", () => {
    const logo = read("components/TeloraLogo.jsx");
    expect(logo).not.toContain("<img");
    expect(logo).not.toContain('src="/brand/');
    expect(logo).toContain("<svg");
    expect(logo).toContain('fill="currentColor"');
    expect(logo).toContain("AccessibleFallback");
  });
});
