import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./components/AppShell";
import AuthPage from "./components/AuthPage";
import Toolbar from "./components/Toolbar";
import CandidateGrid from "./components/CandidateGrid";
import InvoiceSection from "./components/InvoiceSection";
import AskSheetBar from "./components/AskSheetBar";
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
import { excludeRemovedDemoCandidates, getCandidatesVisibleToProfile } from "./utils/demoData";
import { removeDemoData, restoreDemoData } from "./services/demoDataService";
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
  settings: "Settings",
  followups: "My Follow-ups",
  requests: "My Requests",
};

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
  const [dataLoading, setDataLoading] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [askInput, setAskInput] = useState("");
  const [askResponse, setAskResponse] = useState("");
  const [requestDialog, setRequestDialog] = useState(null);
  const [emailDraft, setEmailDraft] = useState(null);
  const [duplicateDialog, setDuplicateDialog] = useState(null);
  const [importRows, setImportRows] = useState(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [demoStatus, setDemoStatus] = useState(null);
  const [demoActionBusy, setDemoActionBusy] = useState(false);
  const [dismissedDuplicateKeys, setDismissedDuplicateKeys] = useState(new Set());
  const fileInputRef = useRef(null);

  const activeProfile = profile || (demoMode ? DEMO_PROFILES[0] : null);
  const organisationName = settings?.display_name || organisation?.name || "Hiring Spartans";
  const navItems = useMemo(() => getVisibleNavItems(activeProfile), [activeProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("recruitops-theme", theme);
  }, [theme]);

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
        isAdmin(profileOverride)
          ? supabase.rpc("get_demo_data_status")
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = [
        organisationResult.error,
        settingsResult.error,
        profilesResult.error,
        candidatesResult.error,
        requestsResult.error,
        demoStatusResult.error,
      ].find(Boolean);

      if (firstError) {
        showNotice(friendlySupabaseError(firstError));
        setDataLoading(false);
        return;
      }

      setOrganisation(organisationResult.data);
      setSettings(settingsResult.data || DEMO_ORGANISATION_SETTINGS);
      setProfiles(profilesResult.data || []);
      setCandidates(excludeRemovedDemoCandidates(candidatesResult.data || []));
      setChangeRequests(requestsResult.data || []);
      setDemoStatus(demoStatusResult.data?.[0] || null);
      setDataLoading(false);
    },
    [activeProfile, demoMode],
  );

  useEffect(() => {
    if (profile && !demoMode) refreshData(profile);
  }, [demoMode, profile, refreshData]);

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
      return;
    }
    await signOut();
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
    const result =
      isAdmin(activeProfile) && field !== "owner_id"
        ? await supabase.from("candidates").update(update).eq("id", id)
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
    if (
      !window.confirm(
        "Archive this candidate? The record will leave your active pipeline but its history will be retained.",
      )
    ) {
      return;
    }

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
      return;
    }

    const { error } = await supabase.rpc("archive_candidate", {
      p_candidate_id: candidate.id,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Candidate archived. Contact an Admin if the record needs to be restored or permanently deleted.");
    }
  };

  const restoreCandidate = async (candidate) => {
    if (!canRestoreCandidate(activeProfile)) return;
    if (demoMode || !supabase) {
      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? { ...item, is_archived: false, archived_at: null, archived_by: null }
            : item,
        ),
      );
      showNotice("Candidate restored.");
      return;
    }

    const { error } = await supabase.rpc("restore_candidate", {
      p_candidate_id: candidate.id,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Candidate restored.");
    }
  };

  const deleteCandidate = async (candidate) => {
    if (!canPermanentlyDeleteCandidate(activeProfile, candidate)) return;
    const confirmation = window.prompt(
      `Permanently delete ${candidate.name}? Type PERMANENTLY DELETE to confirm.`,
    );
    if (confirmation !== "PERMANENTLY DELETE") return;

    if (demoMode || !supabase) {
      setCandidates((current) => current.filter((item) => item.id !== candidate.id));
      showNotice("Candidate permanently deleted in demo data.");
      return;
    }

    const { error } = await supabase.rpc("permanently_delete_candidate", {
      p_candidate_id: candidate.id,
      p_confirmation: confirmation,
    });
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Candidate permanently deleted.");
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
    const reviewComment =
      decision === "rejected"
        ? window.prompt("Add an Admin comment for this rejection.") || ""
        : "";

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
      showNotice("Settings saved in demo mode.");
      return;
    }

    const { error } = await supabase
      .from("organisation_settings")
      .update(nextSettings)
      .eq("organisation_id", activeProfile.organisation_id);
    if (error) showNotice(friendlySupabaseError(error));
    else {
      await refreshData();
      showNotice("Settings saved.");
    }
  };

  const handleRemoveDemoData = async () => {
    if (!isAdmin(activeProfile) || demoActionBusy) return false;
    setDemoActionBusy(true);
    try {
      await removeDemoData();
      await refreshData();
      showNotice("Sample data removed. You can restore it from Settings.");
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

  const submitAskCommand = () => {
    const command = askInput.trim().toLowerCase();
    const normalizedCommand = normalizeQueryText(command);
    if (!command) return;

    navigate("pipeline");

    if (/\b(stale|overdue)\b/.test(normalizedCommand)) {
      setSearchTerm("");
      setStageFilter(null);
      setStaleOnly(true);
      setAskResponse(`Showing overdue follow-ups.`);
      return;
    }

    const stageMatch = PIPELINE_STAGES.find((stage) => command.includes(stage.toLowerCase()));
    if (stageMatch) {
      setSearchTerm("");
      setStageFilter(stageMatch);
      setStaleOnly(false);
      setAskResponse(`Showing ${stageMatch} candidates.`);
      return;
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
      setAskResponse(`Showing candidates matching ${bankMatch}.`);
      return;
    }

    setAskResponse("I could not understand that yet. Try asking for stale candidates, a bank, or a stage.");
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
          Checking RecruitOps access...
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
          Loading RecruitOps data...
        </div>
      );
    }
    if (activePage === "overview") {
      return (
        <OverviewPage
          candidates={visibleCandidates}
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
    if (activePage === "invoicing") {
      return (
        <InvoiceSection
          candidates={candidates}
          profiles={profiles}
          onDownloadInvoice={downloadInvoiceCsv}
          onMarkInvoiced={markJoinedAsInvoiced}
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

    if (activePage === "settings") {
      return (
        <SettingsPage
          settings={settings}
          onSave={saveSettings}
          demoStatus={demoStatus}
          demoBusy={demoActionBusy}
          onRemoveDemo={handleRemoveDemoData}
          onRestoreDemo={handleRestoreDemoData}
        />
      );
    }

    if (activePage === "requests") {
      return <MyRequestsPage requests={requestRows} candidates={candidates} />;
    }

    const gridRows = activePage === "followups" ? followUpCandidates : filteredCandidates;

    return (
      <div className="page-enter space-y-4">
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
          emptyMessage={
            activePage === "followups"
              ? "No assigned follow-ups are due."
              : "No candidates match the current filters."
          }
        />
      </div>
    );
  };

  return (
    <ProtectedRoute bypass={demoMode}>
      <AppShell
      activePage={activePage}
      navItems={navItems}
      onNavigate={navigate}
      pageTitle={pageTitles[activePage] || "RecruitOps"}
      profile={activeProfile}
      organisationName={organisationName}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      onSignOut={handleSignOut}
      onChangePassword={handleChangePassword}
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
        <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
          {notice}
        </div>
      ) : null}
      {renderPage()}
      <AskSheetBar
        value={askInput}
        response={askResponse}
        onChange={setAskInput}
        onSubmit={submitAskCommand}
      />

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
      </AppShell>
    </ProtectedRoute>
  );
}
