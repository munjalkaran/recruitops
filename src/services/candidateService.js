import { supabase } from "../lib/supabase";

const unwrap = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};

export const listCandidates = () =>
  unwrap(supabase.from("candidates").select("*").order("updated_at", { ascending: false }));

export const createCandidate = (candidate) =>
  unwrap(supabase.rpc("create_candidate", { p_candidate: candidate }));

export const updateCandidateOperations = (candidateId, updates) =>
  unwrap(supabase.rpc("update_candidate_operations", { p_candidate_id: candidateId, p_updates: updates }));

export const updateCandidateAsAdmin = (candidateId, updates) =>
  unwrap(supabase.from("candidates").update(updates).eq("id", candidateId).select().single());

export const assignCandidateOwner = (candidateId, ownerId) =>
  unwrap(supabase.rpc("assign_candidate_owner", { p_candidate_id: candidateId, p_owner_id: ownerId }));

export const archiveCandidate = (candidateId) =>
  unwrap(supabase.rpc("archive_candidate", { p_candidate_id: candidateId }));

export const restoreCandidate = (candidateId) =>
  unwrap(supabase.rpc("restore_candidate", { p_candidate_id: candidateId }));

export const permanentlyDeleteCandidate = (candidateId, confirmation) =>
  unwrap(supabase.rpc("permanently_delete_candidate", {
    p_candidate_id: candidateId,
    p_confirmation: confirmation,
  }));

export const subscribeToCandidates = (onChange) => {
  const channel = supabase
    .channel(`candidates:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
};

