import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./components/AppShell";
import AuthPage from "./components/AuthPage";
import Toolbar from "./components/Toolbar";
import CandidateGrid from "./components/CandidateGrid";
import InvoiceSection from "./components/InvoiceSection";
import AskAIPanel from "./components/AskAIPanel";
import { interpretRecruitOpsQuestion } from "./services/askRecruitOpsService";
import ChangeRequestDialog from "./components/ChangeRequestDialog";
import EmailDraftDialog from "./components/EmailDraftDialog";
import DuplicateWarningDialog from "./components/DuplicateWarningDialog";
import CsvImportDialog from "./components/CsvImportDialog";
import ResumeImportPlaceholder from "./components/ResumeImportPlaceholder";
import ApprovalsPage from "./components/ApprovalsPage";
import MyRequestsPage from "./components/MyRequestsPage";
import TeamPage from "./components/TeamPage";
import SettingsPage from "./components/SettingsPage";
import OverviewPage from "./components/OverviewPage";
import VacanciesPage from "./components/VacanciesPage";
import InterviewsPage from "./components/InterviewsPage";
import CandidateDetailsDialog from "./components/CandidateDetailsDialog";
import ConfirmationDialog from "./components/ConfirmationDialog";
import Modal from "./components/Modal";
import { listVacancies, createVacancy, updateVacancy } from "./services/vacancyService";
import { createInterview, updateInterview } from "./services/interviewService";
import { createSavedView, deleteSavedView } from "./services/savedViewService";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";
import {
  DEMO_ORGANISATION,
  DEMO_ORGANISATION_ID,
  DEMO_ORGANISATION_SETTINGS,
  DEMO_PROFILES,
  PIPELINE_STAGES,
  ROLES,
} from "./constants/pipeline";
import { mockCandidates } from "./data/mockCandidates";
import { mockVacancies } from "./data/mockVacancies";
import { mockInterviews } from "./data/mockInterviews";
import {
  hasSupabaseConfig,
  isDemoEnabled,
  friendlySupabaseError,
  supabase,
} from "./lib/supabase";
import {
  candidatesToCsv,
  downloadCsv,
  invoiceGroupsToCsv,
  parseCandidatesCsv,
} from "./utils/csv";
import {
  createBlankCandidate,
  getInvoiceTotal,
  getRecruiterName,
  getUniqueBanks,
  groupInvoiceByBank,
  isCandidateStale,
} from "./utils/candidateUtils";
import { buildCandidateEmailDraft } from "./utils/emailTemplates";
import { findDuplicateWarnings } from "./utils/duplicateUtils";
import { buildCandidateActivity } from "./utils/activity";
import { downloadInvoicePdf } from "./utils/invoicePdf";
import { deriveDocumentStatus } from "./utils/documentChecklist";
import { pageFromPath, pathFromPage, ROUTE_PAGES } from "./utils/routing";
import { excludeRemovedDemoCandidates, getCandidatesVisibleToProfile } from "./utils/demoData";
import { removeDemoData, restoreDemoData } from "./services/demoDataService";
import { resolveDemoRows, shouldUseDemoFallback } from "./services/demoFallback";
import { getPermanentDeleteErrorMessage } from "./utils/permanentDelete";
import {
  canAccessInvoicing,
  canAccessPage,
  canArchiveCandidate,
  canCreateCandidate,
  canDirectlyEditCandidateField,
  canImportCsv,
  canPermanentlyDeleteCandidate,
  canRestoreCandidate,
  getVisibleNavItems,
  isAdmin,
} from "./utils/permissions";

const searchFields = [
  "name",
  "phone",
  "email",
  "current_employer",
  "target_bank",
  "role",
  "notes",
];

const pageTitles = {
  overview: "Overview",
  pipeline: "Pipeline",
  invoicing: "Invoicing",
  approvals: "Approvals",
  archived: "Archived Candidates",
  team: "Team",
  administration: "Administration",
  followups: "My Follow-ups",
  requests: "My Requests",
  vacancies: "Vacancies",
  interviews: "Interviews",
};

const routePages = new Set([...Object.keys(pageTitles), ...ROUTE_PAGES]);

const BANK_TOKEN_STOP_WORDS = ["bank", "finance"];

const normalizeQueryText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const demoRequests = [
  {
    id: "77777777-0001-4777-8777-777777777001",
    organisation_id: DEMO_ORGANISATION_ID,
    candidate_id: "66666666-0002-4666-8666-666666666002",
    requested_by: "44444444-4444-4444-8444-444444444444",
    field_name: "phone",
    old_value: "99870 12234",
    proposed_value: "99870 12235",
    reason: "Candidate corrected one digit on today's call.",
    status: "pending",
    reviewed_by: null,
    review_comment: "",
    reviewed_at: null,
    created_at: "2026-07-20T10:00:00+05:30",
    updated_at: "2026-07-20T10:00:00+05:30",
  },
];

export default function App() {
  const {
    session,
    profile,
    loading: authChecking,
    error: authError,
    passwordRecovery,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    cancelPasswordRecovery,
  } = useAuth();
  const [theme, setTheme] = useState(() => window.localStorage.getItem("recruitops-theme") || "light");
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [demoMode, setDemoMode] = useState(isDemoEnabled && !hasSupabaseConfig);
  const [organisation, setOrganisation] = useState(DEMO_ORGANISATION);
  const [settings, setSettings] = useState(DEMO_ORGANISATION_SETTINGS);
  const [profiles, setProfiles] = useState(() => (isDemoEnabled && !hasSupabaseConfig ? DEMO_PROFILES : []));
  const [candidates, setCandidates] = useState(() => (isDemoEnabled && !hasSupabaseConfig ? mockCandidates : []));
  const [changeRequests, setChangeRequests] = useState(() => (isDemoEnabled && !hasSupabaseConfig ? demoRequests : []));
  const [vacancies, setVacancies] = useState(() => (isDemoEnabled && !hasSupabaseConfig ? mockVacancies : []));
  const [vacanciesError, setVacanciesError] = useState("");
  const [interviews, setInterviews] = useState(() => (isDemoEnabled && !hasSupabaseConfig ? mockInterviews : []));
  const [interviewsError, setInterviewsError] = useState("");
  const [auditRows, setAuditRows] = useState([]);
  const [activityRows, setActivityRows] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [billingSettings, setBillingSettings] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
  const [searchTerm, setSearchTerm] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [askPanelOpen, setAskPanelOpen] = useState(false);
  const [requestDialog, setRequestDialog] = useState(null);
  const [emailDraft, setEmailDraft] = useState(null);
  const [duplicateDialog, setDuplicateDialog] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [confirmationDialog, setConfirmationDialog] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [interviewConfirmation, setInterviewConfirmation] = useState(null);
  const [savedViewConfirmation, setSavedViewConfirmation] = useState(null);
  const [scheduleInterviewCandidateId, setScheduleInterviewCandidateId] = useState("");
  const [importRows, setImportRows] = useState(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [demoStatus, setDemoStatus] = useState(null);
  const [demoActionBusy, setDemoActionBusy] = useState(false);
  const [dismissedDuplicateKeys, setDismissedDuplicateKeys] = useState(new Set());
  const demoExtensionsSeededRef = useRef(false);
  const fileInputRef = useRef(null);

  const activeProfile = profile || (demoMode ? DEMO_PROFILES[0] : null);
  const organisationName = settings?.display_name || organisation?.name || "Hiring Spartans";
  const navItems = useMemo(() => getVisibleNavItems(activeProfile), [activeProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("recruitops-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onPopState = () => setActivePage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(""), 5000);
  };

  const refreshData = useCallback(
    async (profileOverride = activeProfile) => {
      if (!supabase || demoMode || !profileOverride) return;
      setDataLoading(true);

      const [
        organisationResult,
        settingsResult,
        profilesResult,
        candidatesResult,
        requestsResult,
        vacanciesResult,
        interviewsResult,
        auditResult,
        activityResult,
        savedViewsResult,
        billingResult,
        demoStatusResult,
      ] = await Promise.all([
        supabase.from("organisations").select("*").eq("id", profileOverride.organisation_id).single(),
        supabase
          .from("organisation_settings")
          .select("*")
          .eq("organisation_id", profileOverride.organisation_id)
          .single(),
        supabase
          .from("profiles")
          .select("*")
          .eq("organisation_id", profileOverride.organisation_id)
          .order("full_name"),
        supabase.from("candidates").select("*").order("updated_at", { ascending: false }),
        supabase
          .from("candidate_change_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("vacancies").select("*, candidates(id)").order("updated_at", { ascending: false }),
        supabase.from("interviews").select("*").order("scheduled_at", { ascending: true }),
        supabase.from("candidate_audit_log").select("*").order("created_at", { ascending: false }),
        supabase.from("candidate_activity").select("*").order("created_at", { ascending: false }),
        supabase.from("saved_views").select("*").order("updated_at", { ascending: false }),
        supabase.from("billing_settings").select("*").eq("organisation_id", profileOverride.organisation_id).maybeSingle(),
        isAdmin(profileOverride)
          ? supabase.rpc("get_demo_data_status")
          : Promise.resolve({ data: [], error: null }),
      ]);

      const sampleDataActive = demoStatusResult.data?.[0]?.status === "active";
      const allowDevelopmentFallback = Boolean(isDemoEnabled || demoMode || (vacanciesResult.error && interviewsResult.error));
      const firstError = [
        organisationResult.error,
        settingsResult.error,
        profilesResult.error,
        candidatesResult.error && !(import.meta.env.DEV && allowDevelopmentFallback) ? candidatesResult.error : null,
        requestsResult.error,
      ].find(Boolean);

      if (firstError) {
        showNotice(friendlySupabaseError(firstError));
        setDataLoading(false);
        return;
      }

      setOrganisation(organisationResult.data);
      setSettings(settingsResult.data || DEMO_ORGANISATION_SETTINGS);
      setProfiles(profilesResult.data || []);
      const useDemoFallback = shouldUseDemoFallback({
        development: import.meta.env.DEV,
        allowDevelopmentFallback,
        sampleDataActive,
        collections: [
          { rows: candidatesResult.data || [], error: candidatesResult.error },
          { rows: vacanciesResult.data || [], error: vacanciesResult.error },
          { rows: interviewsResult.data || [], error: interviewsResult.error },
        ],
      });
      const useCandidateFallback = useDemoFallback;
      const useVacancyFallback = useDemoFallback;
      const useInterviewFallback = useDemoFallback;
      setCandidates(excludeRemovedDemoCandidates(resolveDemoRows(candidatesResult.data || [], mockCandidates, useCandidateFallback)));
      setChangeRequests(requestsResult.data || []);
      setVacancies(resolveDemoRows(vacanciesResult.data || [], mockVacancies, useVacancyFallback));
      setVacanciesError(vacanciesResult.error && !useVacancyFallback ? "Vacancies are not available yet because the database update has not been applied." : "");
      setInterviews(resolveDemoRows(interviewsResult.data || [], mockInterviews, useInterviewFallback));
      setInterviewsError(interviewsResult.error && !useInterviewFallback ? "Interview management will be available after the interview database update is applied." : "");
      if (vacanciesResult.error && import.meta.env.DEV && !useVacancyFallback) console.error("RecruitOps vacancies query failed", vacanciesResult.error);
      setAuditRows(auditResult.data || []);
      setActivityRows(activityResult.data || []);
      setSavedViews(savedViewsResult.data || []);
      setBillingSettings(billingResult.data || {});
      if (savedViewsResult.error && import.meta.env.DEV) console.warn("Telora saved views are unavailable until the workflow migration is applied.");
      if (billingResult.error && import.meta.env.DEV) console.warn("Telora billing settings are unavailable until the workflow migration is applied.");
      setDemoStatus(demoStatusResult.data?.[0] || null);
      setDataLoading(false);
    },
    [activeProfile, demoMode],
  );

  useEffect(() => {
    if (profile && !demoMode) refreshData(profile);
  }, [demoMode, profile, refreshData]);

  useEffect(() => {
    if (!supabase || demoMode || !activeProfile || !isAdmin(activeProfile) || demoStatus?.status !== "active" || demoExtensionsSeededRef.current) return;
    demoExtensionsSeededRef.current = true;
    supabase.rpc("seed_demo_extensions_for_current_organisation").then(async ({ error }) => {
      if (error && import.meta.env.DEV) console.error("Telora demo extension seed failed", error);
      if (!error) {
        const workflowResult = await supabase.rpc("seed_demo_candidate_workflow_for_current_organisation");
        if (workflowResult.error && import.meta.env.DEV) console.error("Telora demo candidate workflow seed failed", workflowResult.error);
        refreshData(activeProfile);
      }
    });
  }, [activeProfile, demoMode, demoStatus, refreshData]);

  useEffect(() => {
    if (!activeProfile) return;
    const rawPage = String(window.location.pathname || "").replace(/^\/+|\/+$/g, "");
    if (rawPage === "settings") {
      window.history.replaceState({}, "", "/administration");
    }
    if ((!routePages.has(rawPage) && rawPage !== "settings") || !canAccessPage(activeProfile, activePage)) {
      const fallbackPage = getVisibleNavItems(activeProfile)[0]?.id || "overview";
      setActivePage(fallbackPage);
      window.history.replaceState({}, "", pathFromPage(fallbackPage));
    }
  }, [activePage, activeProfile]);

  useEffect(() => {
    if (!supabase || demoMode || !activeProfile) return undefined;

    const channel = supabase
      .channel("recruitops-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () =>
        refreshData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidate_change_requests" },
        () => refreshData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        refreshData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews" }, () =>
        refreshData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProfile, demoMode, refreshData]);

  const visibleCandidates = useMemo(() => {
    return getCandidatesVisibleToProfile(candidates, activeProfile).filter(
      (candidate) => !candidate.is_archived,
    );
  }, [activeProfile, candidates]);

  const archivedCandidates = useMemo(
    () => (isAdmin(activeProfile) ? candidates.filter((candidate) => candidate.is_archived) : []),
    [activeProfile, candidates],
  );

  const filteredCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return visibleCandidates.filter((candidate) => {
      const matchesSearch =
        !query ||
        searchFields.some((field) =>
          String(candidate[field] || "")
            .toLowerCase()
            .includes(query),
        );

      const matchesRecruiter =
        !isAdmin(activeProfile) ||
        recruiterFilter === "all" ||
        (recruiterFilter === "unassigned"
          ? !candidate.owner_id
          : candidate.owner_id === recruiterFilter);
      const matchesStage = !stageFilter || candidate.stage === stageFilter;
      const matchesStale = !staleOnly || isCandidateStale(candidate);

      return matchesSearch && matchesRecruiter && matchesStage && matchesStale;
    });
  }, [activeProfile, recruiterFilter, searchTerm, stageFilter, staleOnly, visibleCandidates]);

  const followUpCandidates = useMemo(
    () =>
      filteredCandidates
        .filter((candidate) => candidate.next_follow_up || isCandidateStale(candidate))
        .sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up))),
    [filteredCandidates],
  );

  const duplicateWarningsByCandidate = useMemo(() => {
    const warnings = {};
    candidates.forEach((candidate) => {
      warnings[candidate.id] = findDuplicateWarnings(candidate, candidates, profiles);
    });
    return warnings;
  }, [candidates, profiles]);

  const pendingApprovalsCount = changeRequests.filter(
    (request) => request.status === "pending",
  ).length;

  const requestRows = useMemo(() => {
    if (isAdmin(activeProfile)) return changeRequests;
    return changeRequests.filter((request) => request.requested_by === activeProfile?.id);
  }, [activeProfile, changeRequests]);

  const handleSignIn = async (email, password, remember) => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await signIn(email, password, remember);
    setAuthLoading(false);
    if (error) setAuthMessage(friendlySupabaseError(error));
  };

  const handleResetPassword = async (email) => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await resetPassword(email);
    setAuthLoading(false);
    setAuthMessage(error ? friendlySupabaseError(error) : "Password reset email sent.");
  };

  const handleUpdatePassword = async (password) => {
    setAuthLoading(true);
    const { error } = await updatePassword(password);
    setAuthLoading(false);
    if (error) setAuthMessage(friendlySupabaseError(error));
    else {
      setAuthMode("login");
      setAuthMessage("");
      showNotice("Password updated.");
    }
  };

  const handleSignOut = async () => {
    if (demoMode) {
      setDemoMode(false);
      setActivePage("overview");
      window.history.replaceState({}, "", "/overview");
      return;
    }
    await signOut();
    setActivePage("overview");
    window.history.replaceState({}, "", "/login");
  };

  const handleChangePassword = () => {
    setAuthMode("update");
  };

  const navigate = (page) => {
    if (!canAccessPage(activeProfile, page)) {
      showNotice("You do not have permission to open that section.");
      return;
    }
    setActivePage(page);
    window.history.pushState({}, "", pathFromPage(page));
  };

  const runCandidateUpdate = async (id, field, value) => {
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate || !canDirectlyEditCandidateField(activeProfile, candidate, field)) {
      showNotice("You do not have permission to update that field.");
      return;
    }

    if (demoMode || !supabase) {
      setCandidates((current) =>
        current.map((item) =>
          item.id === id ? { ...item, [field]: value, updated_at: new Date().toISOString() } : item,
        ),
      );
      return;
    }

    const update = { [field]: value };
    const extensionFields = ["vacancy_id","relevant_experience","current_ctc","expected_ctc","current_location","preferred_location","grade","notice_period_days","last_working_date","past_client_association","offer_status","offered_ctc","final_ctc","offer_date","offer_accepted_date","resignation_date","expected_joining_date","actual_joining_date","joining_risk","joining_notes","document_checklist","retention_period_days","retention_start_date","retention_due_date","retention_status","replacement_guarantee_end_date","invoice_eligibility_date"];
    const result =
      isAdmin(activeProfile) && field !== "owner_id"
        ? await supabase.from("candidates").update(update).eq("id", id)
        : extensionFields.includes(field)
          ? await supabase.rpc("update_candidate_profile_extensions", { p_candidate_id: id, p_updates: update })
        : field === "owner_id"
          ? await supabase.rpc("assign_candidate_owner", {
              p_candidate_id: id,
              p_owner_id: value,
            })
          : await supabase.rpc("update_candidate_operations", {
              p_candidate_id: id,
              p_updates: update,
            });

    if (result.error) {
      showNotice(friendlySupabaseError(result.error));
      return;
    }
    await refreshData();
  };

  const saveCandidateDetails = async (updates) => {
    if (!candidateDetails?.candidate) return false;
    const normalizedUpdates = updates.document_checklist ? { ...updates, docs_status: deriveDocumentStatus(updates.document_checklist) } : updates;
    if (demoMode || !supabase) {
      setCandidates((current) => current.map((item) => item.id === candidateDetails.candidate.id ? { ...item, ...normalizedUpdates, updated_at: new Date().toISOString() } : item));
      showNotice("Candidate profile updated.");
      return true;
    }
    const result = isAdmin(activeProfile)
      ? await supabase.from("candidates").update(normalizedUpdates).eq("id", candidateDetails.candidate.id)
      : await supabase.rpc("update_candidate_profile_extensions", { p_candidate_id: candidateDetails.candidate.id, p_updates: normalizedUpdates });
    if (result.error) {
      showNotice(friendlySupabaseError(result.error));
      return false;
    }
    await refreshData();
    showNotice("Candidate profile updated.");
    return true;
  };

  const addCandidate = async () => {
    if (!canCreateCandidate(activeProfile)) {
      showNotice("Only Admin can create candidates manually.");
      return;
    }

    const blank = createBlankCandidate({
      organisationId: activeProfile.organisation_id,
      createdBy: activeProfile.id,
    });
    blank.name = "New candidate";

    if (demoMode || !supabase) {
      setCandidates((current) => [blank, ...current]);
      showNotice("Candidate created. Add details in the sheet.");
      return;
    }

    const { error } = await supabase.rpc("create_candidate", {
      p_candidate: { name: "New candidate" },
    });
    if (error) {
      showNotice(friendlySupabaseError(error));
      return;
    }
    await refreshData();
    showNotice("Candidate created. Add details in the sheet.");
  };

  const archiveCandidate = async (candidate) => {
    if (!canArchiveCandidate(activeProfile, candidate)) {
      showNotice("You do not have permission to archive this candidate.");
      return;
    }
    setConfirmationDialog({ type: "archive", candidate, busy: false });
  };

  const performArchiveCandidate = async (candidate) => {
    if (demoMode || !supabase) {
      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                is_archived: true,
                archived_at: new Date().toISOString(),
                archived_by: activeProfile.id,
              }
            : item,
        ),
      );
      showNotice("Candidate archived. Contact an Admin if the record needs to be restored or permanently deleted.");
      setConfirmationDialog(null);
      return;
    }

    const { error } = await supabase.rpc("archive_candidate", {
      p_candidate_id: candidate.id,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Candidate archived. Contact an Admin if the record needs to be restored or permanently deleted.");
      setConfirmationDialog(null);
    }
  };

  const restoreCandidate = async (candidate) => {
    if (!canRestoreCandidate(activeProfile)) return;
    setConfirmationDialog({ type: "restore", candidate, busy: false });
  };

  const performRestoreCandidate = async (candidate) => {
    if (demoMode || !supabase) {
      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? { ...item, is_archived: false, archived_at: null, archived_by: null }
            : item,
        ),
      );
      showNotice("Candidate restored.");
      setConfirmationDialog(null);
      return;
    }

    const { error } = await supabase.rpc("restore_candidate", {
      p_candidate_id: candidate.id,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Candidate restored.");
      setConfirmationDialog(null);
    }
  };

  const deleteCandidate = async (candidate) => {
    if (!canPermanentlyDeleteCandidate(activeProfile, candidate)) return;
    setConfirmationDialog({ type: "delete", candidate, busy: false });
  };

  const performDeleteCandidate = async (candidate) => {
    if (demoMode || !supabase) {
      setCandidates((current) => current.filter((item) => item.id !== candidate.id));
      showNotice("Candidate permanently deleted in demo data.");
      setConfirmationDialog(null);
      return;
    }

    const { error } = await supabase.rpc("permanently_delete_candidate", {
      p_candidate_id: candidate.id,
      p_confirmation: "PERMANENTLY DELETE",
    });
    if (error) {
      if (import.meta.env.DEV) console.error("Telora permanent candidate deletion failed", error);
      setConfirmationDialog((current) => (current ? { ...current, error: getPermanentDeleteErrorMessage(error) } : current));
    }
    else {
      await refreshData();
      showNotice("Candidate permanently deleted.");
      setConfirmationDialog(null);
    }
  };

  const submitChangeRequest = async ({ candidate, fieldName, proposedValue, reason }) => {
    if (!reason.trim()) {
      showNotice("A reason is required for protected-field requests.");
      return;
    }

    if (demoMode || !supabase) {
      const request = {
        id: crypto.randomUUID(),
        organisation_id: candidate.organisation_id,
        candidate_id: candidate.id,
        requested_by: activeProfile.id,
        field_name: fieldName,
        old_value: candidate[fieldName] ?? null,
        proposed_value: proposedValue,
        reason,
        status: "pending",
        reviewed_by: null,
        review_comment: "",
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setChangeRequests((current) => [request, ...current]);
      setRequestDialog(null);
      showNotice("Change request submitted.");
      return;
    }

    const { error } = await supabase.rpc("request_candidate_change", {
      p_candidate_id: candidate.id,
      p_field_name: fieldName,
      p_proposed_value: proposedValue,
      p_reason: reason,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      setRequestDialog(null);
      await refreshData();
      showNotice("Change request submitted.");
    }
  };

  const reviewChangeRequest = async (request, decision) => {
    if (decision === "rejected") {
      setReviewDialog({ request, decision, comment: "", busy: false });
      return;
    }

    await performReviewChangeRequest(request, decision, "");
  };

  const performReviewChangeRequest = async (request, decision, reviewComment = "") => {
    if (demoMode || !supabase) {
      setChangeRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: decision,
                reviewed_by: activeProfile.id,
                review_comment: reviewComment,
                reviewed_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      if (decision === "approved") {
        setCandidates((current) =>
          current.map((candidate) =>
            candidate.id === request.candidate_id
              ? { ...candidate, [request.field_name]: request.proposed_value }
              : candidate,
          ),
        );
      }
      showNotice(`Change request ${decision}.`);
      setReviewDialog(null);
      return;
    }

    const { error } = await supabase.rpc("review_candidate_change", {
      p_change_request_id: request.id,
      p_decision: decision,
      p_review_comment: reviewComment,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice(`Change request ${decision}.`);
      setReviewDialog(null);
    }
  };

  const openEmailDraft = async (candidate) => {
    const recruiterName = getRecruiterName(profiles, candidate.owner_id);
    setEmailDraft(buildCandidateEmailDraft(candidate, recruiterName, organisationName));

    if (supabase && !demoMode) {
      await supabase.rpc("record_email_draft_opened", { p_candidate_id: candidate.id });
    }
  };

  const exportFilteredRows = () => {
    downloadCsv("recruitops-candidates.csv", candidatesToCsv(filteredCandidates, profiles));
    showNotice(`Exported ${filteredCandidates.length} shown rows.`);
  };

  const importCsvFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!canImportCsv(activeProfile)) {
      showNotice("Only Admin can import CSV files.");
      return;
    }

    try {
      const text = await file.text();
      const parsedRows = parseCandidatesCsv(text);
      if (parsedRows.length === 0) {
        showNotice("No candidate rows found in that CSV.");
        return;
      }
      setImportRows(parsedRows);
    } catch {
      showNotice("Could not import that CSV. Please check the file format.");
    } finally {
      event.target.value = "";
    }
  };

  const importDuplicateWarnings = useMemo(() => {
    if (!importRows) return {};
    return importRows.reduce((warnings, row) => {
      warnings[row.id] = findDuplicateWarnings(row, candidates, profiles);
      return warnings;
    }, {});
  }, [candidates, importRows, profiles]);

  const confirmCsvImport = async () => {
    const validRows = importRows.filter((row) => row.name);
    if (demoMode || !supabase) {
      setCandidates((current) => [
        ...validRows.map((row) => ({
          ...row,
          organisation_id: activeProfile.organisation_id,
          created_by: activeProfile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        ...current,
      ]);
      setImportRows(null);
      showNotice(`Imported ${validRows.length} candidate rows.`);
      return;
    }

    for (const row of validRows) {
      const { error } = await supabase.rpc("create_candidate", {
        p_candidate: row,
      });
      if (error) {
        showNotice(friendlySupabaseError(error));
        return;
      }
    }
    setImportRows(null);
    await refreshData();
    showNotice(`Imported ${validRows.length} candidate rows.`);
  };

  const downloadInvoiceCsv = () => {
    const groups = groupInvoiceByBank(candidates);
    downloadCsv("recruitops-month-end-invoice.csv", invoiceGroupsToCsv(groups, profiles));
    showNotice("Downloaded invoice CSV for Joined candidates.");
  };

  const downloadInvoicePdfFile = () => {
    const groups = groupInvoiceByBank(candidates);
    const invoiceDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    downloadInvoicePdf({ groups, billingSettings, organisationName, invoiceNumber: `${billingSettings.invoice_prefix || "TELORA"}-${invoiceDate}-001` });
    showNotice("Downloaded invoice PDF. Tax details are included only when configured in billing settings.");
  };

  const markJoinedAsInvoiced = async () => {
    if (!canAccessInvoicing(activeProfile)) return;

    if (demoMode || !supabase) {
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.stage === "Joined" && !candidate.is_archived
            ? { ...candidate, stage: "Invoiced", updated_at: new Date().toISOString() }
            : candidate,
        ),
      );
      showNotice("Moved all Joined candidates to Invoiced.");
      return;
    }

    const joined = candidates.filter((candidate) => candidate.stage === "Joined");
    for (const candidate of joined) {
      const { error } = await supabase
        .from("candidates")
        .update({ stage: "Invoiced" })
        .eq("id", candidate.id);
      if (error) {
        showNotice(friendlySupabaseError(error));
        return;
      }
    }
    await refreshData();
    showNotice("Moved all Joined candidates to Invoiced.");
  };

  const updateProfile = async (profileId, updates) => {
    if (demoMode || !supabase) {
      const nextProfiles = profiles.map((item) =>
        item.id === profileId ? { ...item, ...updates } : item,
      );
      const activeCount = nextProfiles.filter((item) => item.is_active).length;
      if (activeCount > organisation.active_user_limit) {
        showNotice("Your free plan supports up to 15 active users. Upgrade the plan to add more users.");
        return;
      }
      setProfiles(nextProfiles);
      showNotice("Team profile updated.");
      return;
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", profileId);
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Team profile updated.");
    }
  };

  const saveSettings = async (nextSettings) => {
    if (demoMode || !supabase) {
      setSettings(nextSettings);
      showNotice("Administration changes saved in sample mode.");
      return;
    }

    const { error } = await supabase
      .from("organisation_settings")
      .update(nextSettings)
      .eq("organisation_id", activeProfile.organisation_id);
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Administration changes saved.");
    }
  };

  const saveBillingSettings = async (nextBillingSettings) => {
    if (demoMode || !supabase) {
      setBillingSettings(nextBillingSettings);
      showNotice("Billing settings saved in demo mode.");
      return;
    }
    const result = await supabase.from("billing_settings").upsert({ ...nextBillingSettings, organisation_id: activeProfile.organisation_id }).select("*").single();
    if (result.error) showNotice(friendlySupabaseError(result.error));
    else {
      setBillingSettings(result.data || nextBillingSettings);
      showNotice("Billing settings saved.");
    }
  };

  const saveSavedView = async ({ name, filters }) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;
    const local = { id: crypto.randomUUID(), name: cleanName, page: "pipeline", filters, is_shared: false, owner_id: activeProfile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (demoMode || !supabase) {
      setSavedViews((current) => [local, ...current]);
      showNotice(`Saved view “${cleanName}”.`);
      return;
    }
    try {
      const saved = await createSavedView(supabase, { organisation_id: activeProfile.organisation_id, owner_id: activeProfile.id, name: cleanName, page: "pipeline", filters, is_shared: false });
      setSavedViews((current) => [saved, ...current]);
      showNotice(`Saved view “${cleanName}”.`);
    } catch (error) {
      showNotice(/relation .*saved_views|does not exist|42P01/i.test(error?.message || "") ? "Saved views will be available after the database update is applied." : friendlySupabaseError(error));
    }
  };

  const removeSavedView = (view) => setSavedViewConfirmation(view);

  const confirmRemoveSavedView = async () => {
    if (!savedViewConfirmation) return;
    const view = savedViewConfirmation;
    setSavedViewConfirmation(null);
    if (demoMode || !supabase) {
      setSavedViews((current) => current.filter((item) => item.id !== view.id));
      return;
    }
    try {
      await deleteSavedView(supabase, view.id);
      setSavedViews((current) => current.filter((item) => item.id !== view.id));
    } catch (error) {
      showNotice(friendlySupabaseError(error));
    }
  };

  const saveVacancy = async (id, payload) => {
    if (demoMode || !supabase) {
      const local = { ...payload, id: id || crypto.randomUUID(), organisation_id: activeProfile.organisation_id, candidates: [], updated_at: new Date().toISOString() };
      setVacancies((current) => id ? current.map((v) => v.id === id ? { ...v, ...local } : v) : [local, ...current]);
      showNotice(id ? "Vacancy updated." : "Vacancy created.");
      return;
    }
    try { const saved = id ? await updateVacancy(id, payload) : await createVacancy({ ...payload, organisation_id: activeProfile.organisation_id }); setVacancies((current) => id ? current.map((v) => v.id === id ? { ...v, ...saved } : v) : [saved, ...current]); showNotice(id ? "Vacancy updated." : "Vacancy created."); }
    catch (error) { showNotice(/does not exist|42P01|relation .*vacancies/i.test(error?.message || "") ? "Vacancies are not available yet because the database update has not been applied." : friendlySupabaseError(error)); }
  };

  const buildInterviewPayload = (payload, extra = {}) => ({
    ...payload,
    ...extra,
    candidate: undefined,
    vacancy: undefined,
    organisation_id: activeProfile.organisation_id,
    created_by: payload.created_by || activeProfile.id,
    scheduled_at: payload.scheduled_date && payload.scheduled_time
      ? new Date(`${payload.scheduled_date}T${payload.scheduled_time}`).toISOString()
      : null,
  });

  const saveInterview = async (payload) => {
    const next = buildInterviewPayload(payload);
    if (demoMode || !supabase) {
      const local = { ...next, id: crypto.randomUUID(), candidates: undefined, vacancies: undefined, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setInterviews((current) => [...current, local].sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))));
      showNotice("Interview scheduled.");
      return local;
    }
    try {
      const saved = await createInterview(next);
      setInterviews((current) => [...current, saved].sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))));
      showNotice("Interview scheduled.");
      return saved;
    } catch (error) {
      showNotice(friendlySupabaseError(error));
      throw error;
    }
  };

  const updateInterviewRecord = async (id, updates) => {
    const next = { ...updates };
    if (next.scheduled_date && next.scheduled_time) next.scheduled_at = new Date(`${next.scheduled_date}T${next.scheduled_time}`).toISOString();
    if (demoMode || !supabase) {
      setInterviews((current) => current.map((interview) => interview.id === id ? { ...interview, ...next, updated_at: new Date().toISOString() } : interview));
      showNotice("Interview updated.");
      return;
    }
    try {
      const saved = await updateInterview(id, next);
      setInterviews((current) => current.map((interview) => interview.id === id ? saved : interview));
      showNotice("Interview updated.");
    } catch (error) {
      showNotice(friendlySupabaseError(error));
      throw error;
    }
  };

  const requestNoShow = (interview) => setInterviewConfirmation({ interview, busy: false });

  const scheduleInterviewForCandidate = (candidate) => {
    setCandidateDetails(null);
    setScheduleInterviewCandidateId(candidate?.id || "");
    navigate("interviews");
  };

  const confirmNoShow = async () => {
    if (!interviewConfirmation || interviewConfirmation.busy) return;
    setInterviewConfirmation((current) => ({ ...current, busy: true }));
    try {
      await updateInterviewRecord(interviewConfirmation.interview.id, {
        interview_status: "No Show",
        escalation_required: true,
        escalation_reason: "Follow-up required after candidate no-show",
      });
      setInterviewConfirmation(null);
    } finally {
      setInterviewConfirmation((current) => current ? { ...current, busy: false } : current);
    }
  };

  const rescheduleInterview = async (interview, payload) => {
    await updateInterviewRecord(interview.id, {
      interview_status: "Rescheduled",
      reschedule_reason: payload.internal_notes || "Replacement interview scheduled",
    });
    await saveInterview(buildInterviewPayload(payload, { previous_interview_id: interview.id, interview_status: "Scheduled", feedback_status: "Not Due" }));
    showNotice("Interview rescheduled and original history retained.");
  };

  const handleRemoveDemoData = async () => {
    if (!isAdmin(activeProfile) || demoActionBusy) return false;
    setDemoActionBusy(true);
    try {
      await removeDemoData();
      await supabase?.rpc("remove_demo_extensions");
      await refreshData();
      showNotice("Sample data removed. You can restore it from Administration.");
      return true;
    } catch (error) {
      showNotice(friendlySupabaseError(error));
      return false;
    } finally {
      setDemoActionBusy(false);
    }
  };

  const handleRestoreDemoData = async (batchId = null) => {
    if (!isAdmin(activeProfile) || demoActionBusy) return false;
    setDemoActionBusy(true);
    try {
      await restoreDemoData(batchId);
      await supabase?.rpc("restore_demo_extensions", { p_demo_batch_id: batchId });
      demoExtensionsSeededRef.current = false;
      await refreshData();
      showNotice("Sample data restored.");
      return true;
    } catch (error) {
      showNotice(friendlySupabaseError(error));
      return false;
    } finally {
      setDemoActionBusy(false);
    }
  };

  const submitAskCommand = (question) => {
    const command = question.trim().toLowerCase();
    const normalizedCommand = normalizeQueryText(command);
    if (!command) return;

    navigate("pipeline");

    if (/\b(stale|overdue)\b/.test(normalizedCommand)) {
      setSearchTerm("");
      setStageFilter(null);
      setStaleOnly(true);
      return { type: "filter", message: "Showing overdue follow-ups.", action: { kind: "stale" }, suggestions: [] };
    }

    const stageMatch = PIPELINE_STAGES.find((stage) => command.includes(stage.toLowerCase()));
    if (stageMatch) {
      setSearchTerm("");
      setStageFilter(stageMatch);
      setStaleOnly(false);
      return { type: "filter", message: `Showing ${stageMatch} candidates.`, action: { kind: "stage", value: stageMatch }, suggestions: [] };
    }

    const bankMatch = getUniqueBanks(visibleCandidates).find((bank) => {
      const normalizedBank = normalizeQueryText(bank);
      const bankTokens = normalizedBank
        .split(" ")
        .filter((token) => token.length >= 3 && !BANK_TOKEN_STOP_WORDS.includes(token));
      return (
        normalizedCommand.includes(normalizedBank) ||
        bankTokens.some((token) => normalizedCommand.includes(token))
      );
    });
    if (bankMatch) {
      setSearchTerm(bankMatch);
      setStageFilter(null);
      setStaleOnly(false);
      return { type: "filter", message: `Showing candidates matching ${bankMatch}.`, action: { kind: "search", value: bankMatch }, suggestions: [] };
    }

    return interpretRecruitOpsQuestion(question, { candidates: visibleCandidates, profiles, interviews, vacancies });
  };

  const askRecruitOps = (question) => {
    const response = submitAskCommand(question);
    if (response?.action?.kind === "search") { setSearchTerm(response.action.value); setStageFilter(null); setStaleOnly(false); navigate("pipeline"); }
    if (response?.action?.kind === "stage") { setSearchTerm(""); setStageFilter(response.action.value); setStaleOnly(false); navigate("pipeline"); }
    if (response?.action?.kind === "stale") { setSearchTerm(""); setStageFilter(null); setStaleOnly(true); navigate(isAdmin(activeProfile) ? "pipeline" : "followups"); }
    if (response?.action?.kind === "recruiter") { setSearchTerm(""); setRecruiterFilter(response.action.value); setStageFilter(null); setStaleOnly(false); navigate("pipeline"); }
    if (response?.action?.kind === "interviews") navigate("interviews");
    if (response?.action?.kind === "vacancies") navigate("vacancies");
    return response;
  };

  const copyEmailText = async () => {
    if (!emailDraft) return;
    await navigator.clipboard?.writeText(
      `To: ${emailDraft.recipient}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`,
    );
    showNotice("Email text copied.");
  };

  const dismissDuplicate = async (candidate, warning) => {
    setDismissedDuplicateKeys((current) => new Set(current).add(`${candidate.id}:${warning.candidate.id}`));
    setDuplicateDialog(null);
    if (supabase && !demoMode) {
      await supabase.rpc("record_duplicate_warning_dismissed", {
        p_candidate_id: candidate.id,
        p_linked_candidate_id: warning.candidate.id,
      });
    }
  };

  const linkDuplicate = async (candidate, warning) => {
    if (supabase && !demoMode) {
      const { error } = await supabase.rpc("link_candidate_records", {
        p_candidate_id: candidate.id,
        p_linked_candidate_id: warning.candidate.id,
      });
      if (error) {
        showNotice(friendlySupabaseError(error));
        return;
      }
    }
    setDuplicateDialog(null);
    showNotice("Candidate records linked.");
  };

  const openPreviousDuplicate = (warning) => {
    setActivePage(warning.isArchived ? "archived" : "pipeline");
    setSearchTerm(warning.candidate.name);
    setDuplicateDialog(null);
  };

  const selectOverviewSummary = (summary, candidate = null) => {
    setSearchTerm("");
    setRecruiterFilter("all");
    setStageFilter(null);
    setStaleOnly(false);

    if (summary === "candidate" && candidate) {
      setSearchTerm(candidate.name);
      navigate("pipeline");
      return;
    }
    if (summary === "overdue") {
      setStaleOnly(true);
      navigate(isAdmin(activeProfile) ? "pipeline" : "followups");
      return;
    }
    if (summary === "approvals") {
      navigate(isAdmin(activeProfile) ? "approvals" : "requests");
      return;
    }
    if (summary === "invoice") {
      navigate(isAdmin(activeProfile) ? "invoicing" : "pipeline");
      if (!isAdmin(activeProfile)) setStageFilter("Joined");
      return;
    }
    if (["interviews", "feedbackDue", "noShows"].includes(summary)) {
      navigate("interviews");
      return;
    }

    const stageBySummary = {
      interviewing: "Interviewing",
      selected: "Selected",
      joined: "Joined",
    };
    if (stageBySummary[summary]) setStageFilter(stageBySummary[summary]);
    navigate("pipeline");
  };

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app text-primary">
        <div className="rounded-lg border border-app bg-surface px-5 py-4 text-sm font-bold text-secondary">
          Checking Telora access...
        </div>
      </main>
    );
  }

  if ((passwordRecovery || authMode === "update") && session) {
    return (
      <AuthPage
        mode="update"
        onModeChange={(mode) => {
          setAuthMode(mode);
          cancelPasswordRecovery();
        }}
        onSignIn={handleSignIn}
        onResetPassword={handleResetPassword}
        onUpdatePassword={handleUpdatePassword}
        isSupabaseConfigured={hasSupabaseConfig}
        loading={authLoading}
        message={authMessage}
      />
    );
  }

  if ((!session || !profile) && !demoMode) {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={setAuthMode}
        onSignIn={handleSignIn}
        onResetPassword={handleResetPassword}
        onUpdatePassword={handleUpdatePassword}
        onDemo={() => {
          if (isDemoEnabled) setDemoMode(true);
          setAuthMessage("");
        }}
        allowDemo={isDemoEnabled}
        isSupabaseConfigured={hasSupabaseConfig}
        loading={authLoading}
        message={authMessage || authError}
      />
    );
  }

  const renderPage = () => {
    if (dataLoading) {
      return (
        <div className="rounded-lg border border-app bg-surface px-5 py-12 text-center text-sm font-semibold text-secondary">
          Loading Telora data...
        </div>
      );
    }
    if (activePage === "overview") {
      return (
        <OverviewPage
          candidates={visibleCandidates}
          interviews={interviews}
          pendingApprovalsCount={pendingApprovalsCount}
          profile={activeProfile}
          demoStatus={demoStatus}
          demoBusy={demoActionBusy}
          onRemoveDemo={handleRemoveDemoData}
          onRestoreDemo={handleRestoreDemoData}
          onNavigate={navigate}
          onSelectSummary={selectOverviewSummary}
        />
      );
    }
    if (activePage === "vacancies") {
      return <VacanciesPage vacancies={vacancies} vacanciesError={vacanciesError} profiles={profiles} activeProfile={activeProfile} candidates={visibleCandidates} interviews={interviews} onSave={saveVacancy} onUpdateCandidate={runCandidateUpdate} />;
    }
    if (activePage === "interviews") {
      return <InterviewsPage interviews={interviews} candidates={visibleCandidates} vacancies={vacancies} profiles={profiles} activeProfile={activeProfile} initialCandidateId={scheduleInterviewCandidateId} error={interviewsError} onRetry={() => refreshData()} onCreate={saveInterview} onUpdate={updateInterviewRecord} onNoShow={requestNoShow} onReschedule={rescheduleInterview} />;
    }
    if (activePage === "invoicing") {
      return (
        <InvoiceSection
          candidates={candidates}
          profiles={profiles}
          onDownloadInvoice={downloadInvoiceCsv}
          onDownloadInvoicePdf={downloadInvoicePdfFile}
          onMarkInvoiced={markJoinedAsInvoiced}
          billingSettings={billingSettings}
          organisationName={organisationName}
        />
      );
    }

    if (activePage === "approvals") {
      return (
        <ApprovalsPage
          requests={changeRequests}
          candidates={candidates}
          profiles={profiles}
          onReview={reviewChangeRequest}
        />
      );
    }

    if (activePage === "archived") {
      return (
        <CandidateGrid
          candidates={archivedCandidates}
          allCandidates={candidates}
          profiles={profiles}
          activeProfile={activeProfile}
          duplicateWarningsByCandidate={duplicateWarningsByCandidate}
          dismissedDuplicateKeys={dismissedDuplicateKeys}
          onUpdateCandidate={runCandidateUpdate}
          onRequestCorrection={(candidate, field) => setRequestDialog({ candidate, field })}
          onArchiveCandidate={archiveCandidate}
          onRestoreCandidate={restoreCandidate}
          onDeleteCandidate={deleteCandidate}
          onOpenEmailDraft={openEmailDraft}
          onOpenDuplicate={(candidate, warning) => setDuplicateDialog({ candidate, warning })}
          onDismissDuplicate={dismissDuplicate}
          onLinkDuplicate={linkDuplicate}
          onOpenDetails={(candidate) => setCandidateDetails({ candidate, mode: "view" })}
          onEditCandidate={(candidate) => setCandidateDetails({ candidate, mode: "edit" })}
          vacancies={vacancies}
          emptyMessage="No archived candidates found."
          archivedMode
        />
      );
    }

    if (activePage === "team") {
      return (
        <TeamPage
          profiles={profiles}
          activeUserLimit={organisation.active_user_limit}
          onUpdateProfile={updateProfile}
        />
      );
    }

    if (activePage === "administration") {
      return (
        <SettingsPage
          settings={settings}
          onSave={saveSettings}
          demoStatus={demoStatus}
          demoBusy={demoActionBusy}
          onRemoveDemo={handleRemoveDemoData}
          onRestoreDemo={handleRestoreDemoData}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          billingSettings={billingSettings}
          onSaveBilling={saveBillingSettings}
        />
      );
    }

    if (activePage === "requests") {
      return <MyRequestsPage requests={requestRows} candidates={candidates} />;
    }

    const gridRows = activePage === "followups" ? followUpCandidates : filteredCandidates;

    return (
      <div className="page-enter flex min-h-0 flex-1 flex-col space-y-4">
        <Toolbar
          searchTerm={searchTerm}
          recruiterFilter={recruiterFilter}
          stageFilter={stageFilter}
          profiles={profiles}
          activeProfile={activeProfile}
          shownCount={gridRows.length}
          totalCount={visibleCandidates.length}
          onSearchChange={setSearchTerm}
          onRecruiterChange={setRecruiterFilter}
          onStageChange={(stage) => {
            setStageFilter(stage);
            setStaleOnly(false);
          }}
          onClearFilters={() => {
            setSearchTerm("");
            setRecruiterFilter("all");
            setStageFilter(null);
            setStaleOnly(false);
          }}
          onAddCandidate={addCandidate}
          onImportClick={() => fileInputRef.current?.click()}
          onExport={exportFilteredRows}
          onResumeImport={() => setResumeDialogOpen(true)}
          savedViews={savedViews}
          onSaveView={saveSavedView}
          onDeleteView={removeSavedView}
          onApplyView={(view) => {
            const filters = view.filters || {};
            setSearchTerm(filters.searchTerm || "");
            setRecruiterFilter(filters.recruiterFilter || "all");
            setStageFilter(filters.stageFilter || null);
            setStaleOnly(Boolean(filters.staleOnly));
            showNotice(`Applied saved view “${view.name}”.`);
          }}
          currentViewFilters={{ searchTerm, recruiterFilter, stageFilter, staleOnly }}
        />
        <CandidateGrid
          candidates={gridRows}
          allCandidates={candidates}
          profiles={profiles}
          activeProfile={activeProfile}
          duplicateWarningsByCandidate={duplicateWarningsByCandidate}
          dismissedDuplicateKeys={dismissedDuplicateKeys}
          onUpdateCandidate={runCandidateUpdate}
          onRequestCorrection={(candidate, field) => setRequestDialog({ candidate, field })}
          onArchiveCandidate={archiveCandidate}
          onRestoreCandidate={restoreCandidate}
          onDeleteCandidate={deleteCandidate}
          onOpenEmailDraft={openEmailDraft}
          onOpenDuplicate={(candidate, warning) => setDuplicateDialog({ candidate, warning })}
          onDismissDuplicate={dismissDuplicate}
          onLinkDuplicate={linkDuplicate}
          onOpenDetails={(candidate) => setCandidateDetails({ candidate, mode: "view" })}
          onEditCandidate={(candidate) => setCandidateDetails({ candidate, mode: "edit" })}
          vacancies={vacancies}
          emptyMessage={
            activePage === "followups"
              ? "No assigned follow-ups are due."
              : "No candidates match the current filters."
          }
          fillHeight
        />
      </div>
    );
  };

  const confirmationCopy = confirmationDialog
    ? {
        archive: {
          title: `Archive ${confirmationDialog.candidate.name || "candidate"}?`,
          message: "The record will leave the active pipeline but its history will be retained.",
          confirmLabel: "Archive candidate",
          destructive: false,
          action: performArchiveCandidate,
        },
        restore: {
          title: `Restore ${confirmationDialog.candidate.name || "candidate"} to the active pipeline?`,
          message: "The candidate will be visible in the active pipeline again.",
          confirmLabel: "Restore candidate",
          destructive: false,
          action: performRestoreCandidate,
        },
        delete: {
          title: `Permanently delete ${confirmationDialog.candidate.name || "candidate"}?`,
          message: "This cannot be undone.",
          confirmLabel: "Delete permanently",
          destructive: true,
          action: performDeleteCandidate,
        },
      }[confirmationDialog.type]
    : null;

  const confirmCandidateAction = async () => {
    if (!confirmationDialog || confirmationDialog.busy || !confirmationCopy) return;
    const candidate = confirmationDialog.candidate;
    setConfirmationDialog((current) => (current ? { ...current, busy: true, error: "" } : current));
    try {
      await confirmationCopy.action(candidate);
    } finally {
      setConfirmationDialog((current) =>
        current?.candidate?.id === candidate.id ? { ...current, busy: false } : current,
      );
    }
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    if (!reviewDialog || reviewDialog.busy) return;
    const { request, decision, comment } = reviewDialog;
    setReviewDialog((current) => (current ? { ...current, busy: true } : current));
    try {
      await performReviewChangeRequest(request, decision, comment || "");
    } finally {
      setReviewDialog((current) =>
        current?.request?.id === request.id ? { ...current, busy: false } : current,
      );
    }
  };

  return (
    <ProtectedRoute bypass={demoMode}>
      <AppShell
      activePage={activePage}
      navItems={navItems}
      onNavigate={navigate}
      pageTitle={pageTitles[activePage] || "Telora"}
      profile={activeProfile}
      organisationName={organisationName}
      onSignOut={handleSignOut}
      onChangePassword={handleChangePassword}
      onAskAI={() => setAskPanelOpen(true)}
      pendingApprovalsCount={isAdmin(activeProfile) ? pendingApprovalsCount : 0}
      isDemoMode={demoMode}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={importCsvFile}
        className="hidden"
        aria-label="Import CSV file"
      />
      {notice ? (
        <div className="glass-panel mb-4 rounded-lg border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-800 dark:border-teal-800 dark:text-teal-200">
          {notice}
        </div>
      ) : null}
      {renderPage()}
      {askPanelOpen ? <AskAIPanel onAsk={askRecruitOps} onClose={() => setAskPanelOpen(false)} /> : null}

      {requestDialog ? (
        <ChangeRequestDialog
          candidate={requestDialog.candidate}
          initialField={requestDialog.field}
          profiles={profiles}
          onClose={() => setRequestDialog(null)}
          onSubmit={submitChangeRequest}
        />
      ) : null}

      {emailDraft ? (
        <EmailDraftDialog
          draft={emailDraft}
          onClose={() => setEmailDraft(null)}
          onCopy={copyEmailText}
        />
      ) : null}

      {duplicateDialog ? (
        <DuplicateWarningDialog
          candidate={duplicateDialog.candidate}
          warning={duplicateDialog.warning}
          onClose={() => setDuplicateDialog(null)}
          onOpenPrevious={() => openPreviousDuplicate(duplicateDialog.warning)}
          onLink={() => linkDuplicate(duplicateDialog.candidate, duplicateDialog.warning)}
          onDismiss={() => dismissDuplicate(duplicateDialog.candidate, duplicateDialog.warning)}
        />
      ) : null}

      {importRows ? (
        <CsvImportDialog
          rows={importRows}
          profiles={profiles}
          duplicateWarnings={importDuplicateWarnings}
          onAssignOwner={(index, ownerId) =>
            setImportRows((current) =>
              current.map((row, rowIndex) =>
                rowIndex === index ? { ...row, owner_id: ownerId } : row,
              ),
            )
          }
          onCancel={() => setImportRows(null)}
          onImport={confirmCsvImport}
        />
      ) : null}

      {resumeDialogOpen ? <ResumeImportPlaceholder onClose={() => setResumeDialogOpen(false)} /> : null}
      {confirmationDialog && confirmationCopy ? (
        <ConfirmationDialog
          title={confirmationCopy.title}
          message={confirmationDialog.type === "delete" ? `This will permanently remove ${confirmationDialog.candidate.name || "this candidate"} and cannot be undone.` : confirmationCopy.message}
          confirmLabel={confirmationCopy.confirmLabel}
          destructive={confirmationCopy.destructive}
          confirming={confirmationDialog.busy}
          error={confirmationDialog.error}
          onCancel={() => !confirmationDialog.busy && setConfirmationDialog(null)}
          onConfirm={confirmCandidateAction}
        />
      ) : null}

      {interviewConfirmation ? (
        <ConfirmationDialog
          title="Mark interview as a no-show?"
          message="The interview history will be retained and a follow-up will be flagged for the team."
          confirmLabel="Mark no-show"
          confirming={interviewConfirmation.busy}
          onCancel={() => !interviewConfirmation.busy && setInterviewConfirmation(null)}
          onConfirm={confirmNoShow}
        />
      ) : null}

      {savedViewConfirmation ? (
        <ConfirmationDialog
          title="Delete this view?"
          message={`"${savedViewConfirmation.name}" will be permanently removed.`}
          confirmLabel="Delete view"
          destructive
          onCancel={() => setSavedViewConfirmation(null)}
          onConfirm={confirmRemoveSavedView}
        />
      ) : null}

      {reviewDialog ? (
        <Modal
          title="Reject change request?"
          description="Add an Admin comment for this rejection."
          onClose={() => !reviewDialog.busy && setReviewDialog(null)}
          busy={reviewDialog.busy}
          size="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" disabled={reviewDialog.busy} onClick={() => setReviewDialog(null)} className="action-button border border-app bg-surface text-secondary hover:bg-raised disabled:opacity-50">
                Cancel
              </button>
              <button form="review-rejection-form" disabled={reviewDialog.busy} className="action-button bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
                {reviewDialog.busy ? "Rejecting..." : "Reject request"}
              </button>
            </div>
          }
        >
          <form id="review-rejection-form" onSubmit={submitRejection}>
            <label className="block text-sm font-medium text-secondary">
              Admin comment
              <textarea
                value={reviewDialog.comment}
                onChange={(event) => setReviewDialog((current) => ({ ...current, comment: event.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-lg border border-app bg-raised px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {candidateDetails ? (
        <CandidateDetailsDialog
          candidate={candidates.find((candidate) => candidate.id === candidateDetails.candidate.id) || candidateDetails.candidate}
          vacancies={vacancies}
          profiles={profiles}
          activeProfile={activeProfile}
          duplicateWarnings={(duplicateWarningsByCandidate[candidateDetails.candidate.id] || []).filter(
            (warning) => !dismissedDuplicateKeys.has(`${candidateDetails.candidate.id}:${warning.candidate.id}`),
          )}
          mode={candidateDetails.mode}
          activities={buildCandidateActivity(candidateDetails.candidate, auditRows, interviews, activityRows)}
          interviews={interviews.filter((interview) => interview.candidate_id === candidateDetails.candidate.id)}
          onSave={saveCandidateDetails}
          onScheduleInterview={scheduleInterviewForCandidate}
          onClose={() => setCandidateDetails(null)}
        />
      ) : null}
      </AppShell>
    </ProtectedRoute>
  );
}
