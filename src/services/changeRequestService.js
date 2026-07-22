import { supabase } from "../lib/supabase";

export const listChangeRequests = async () => {
  const { data, error } = await supabase
    .from("candidate_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const requestCandidateChange = async ({ candidateId, fieldName, proposedValue, reason }) => {
  const { data, error } = await supabase.rpc("request_candidate_change", {
    p_candidate_id: candidateId,
    p_field_name: fieldName,
    p_proposed_value: proposedValue,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
};

export const reviewCandidateChange = async ({ requestId, decision, reviewComment = "" }) => {
  const { data, error } = await supabase.rpc("review_candidate_change", {
    p_change_request_id: requestId,
    p_decision: decision,
    p_review_comment: reviewComment,
  });
  if (error) throw error;
  return data;
};

export const subscribeToChangeRequests = (onChange) => {
  const channel = supabase
    .channel(`change-requests:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "candidate_change_requests" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
};

