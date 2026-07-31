import { OPERATIONAL_FIELDS, PROTECTED_FIELDS, ROLES } from "../constants/pipeline";

export const isAdmin = (profile) => profile?.role === ROLES.ADMIN;

export const isRecruiter = (profile) => profile?.role === ROLES.RECRUITER;

export const isOperationalField = (field) => OPERATIONAL_FIELDS.includes(field);

export const isProtectedField = (field) => PROTECTED_FIELDS.includes(field);

export const canAccessInvoicing = (profile) => isAdmin(profile);

export const canImportCsv = (profile) => isAdmin(profile);

export const canCreateCandidate = (profile) => isAdmin(profile);

export const canManageDemoData = (profile) => isAdmin(profile);

export const canArchiveCandidate = (profile, candidate) =>
  isAdmin(profile) || (isRecruiter(profile) && candidate.owner_id === profile.id);

export const canRestoreCandidate = (profile) => isAdmin(profile);

export const canPermanentlyDeleteCandidate = (profile, candidate) =>
  isAdmin(profile) && !candidate?.is_demo;

export const canDirectlyEditCandidateField = (profile, candidate, field) => {
  if (!profile || !candidate) return false;
  if (isAdmin(profile)) return true;
  return (
    isRecruiter(profile) &&
    candidate.owner_id === profile.id &&
    isOperationalField(field) &&
    !candidate.is_archived
  );
};

export const canRequestCandidateChange = (profile, candidate, field) =>
  isRecruiter(profile) &&
  candidate?.owner_id === profile.id &&
  isProtectedField(field) &&
  !candidate.is_archived;

export const getVisibleNavItems = (profile) => {
  if (isAdmin(profile)) {
    return [
      { id: "overview", label: "Overview" },
      { id: "pipeline", label: "Pipeline" },
      { id: "vacancies", label: "Vacancies" },
      { id: "interviews", label: "Interviews" },
      { id: "invoicing", label: "Invoicing" },
      { id: "approvals", label: "Approvals" },
      { id: "archived", label: "Archived" },
      { id: "team", label: "Team" },
      { id: "administration", label: "Administration" },
    ];
  }

  return [
    { id: "overview", label: "Overview" },
    { id: "pipeline", label: "My Pipeline" },
    { id: "vacancies", label: "My Vacancies" },
    { id: "interviews", label: "Interviews" },
    { id: "followups", label: "My Follow-ups" },
    { id: "requests", label: "My Requests" },
  ];
};

export const canAccessPage = (profile, page) =>
  getVisibleNavItems(profile).some((item) => item.id === page);
