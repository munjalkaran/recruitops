export const FINALIZED_INVOICE_DELETE_MESSAGE =
  "This candidate is linked to a finalised invoice and cannot be permanently deleted. Archive the candidate instead.";

export const getPermanentDeleteErrorMessage = (error) => {
  const message = String(error?.message || error || "");
  if (/finali[sz]ed invoice|invoice|paid|invoiced/i.test(message)) return FINALIZED_INVOICE_DELETE_MESSAGE;
  if (/permission|row-level security|admin permission|not authorised|not authorized/i.test(message)) {
    return "You do not have permission to permanently delete this candidate.";
  }
  if (/network|failed to fetch|fetch/i.test(message)) {
    return "Could not reach the data service. Check your connection and retry.";
  }
  if (/not found|no longer available/i.test(message)) {
    return "This candidate is no longer available. Refresh the page and try again.";
  }
  return "Permanent deletion failed. Please retry or cancel.";
};
