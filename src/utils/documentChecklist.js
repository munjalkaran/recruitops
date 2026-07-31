export const DOCUMENT_CHECKLIST_FIELDS = [
  ["id_proof", "ID proof"],
  ["address_proof", "Address proof"],
  ["education_documents", "Education documents"],
  ["experience_letters", "Experience letters"],
  ["salary_slips", "Salary slips"],
  ["offer_letter", "Offer letter"],
  ["resignation_proof", "Resignation proof"],
  ["appointment_acceptance", "Appointment letter acceptance"],
];

export const getDocumentProgress = (checklist) => {
  const values = DOCUMENT_CHECKLIST_FIELDS.map(([key]) => Boolean(checklist?.[key]));
  return { complete: values.filter(Boolean).length, total: values.length };
};

export const deriveDocumentStatus = (checklist) => {
  const { complete, total } = getDocumentProgress(checklist);
  if (complete === 0) return "Pending";
  if (complete === total) return "Complete";
  return "Partial";
};

export const normalizeChecklist = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return DOCUMENT_CHECKLIST_FIELDS.reduce((result, [key]) => {
    result[key] = Boolean(source[key]);
    return result;
  }, {});
};
