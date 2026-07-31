import { supabase } from "../lib/supabase";

const interviewSelect = "*, candidates(id,name,owner_id,stage), vacancies(id,client_name,job_title)";

export const listInterviews = async () => {
  const result = await supabase.from("interviews").select(interviewSelect).order("scheduled_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
};

export const createInterview = async (payload) => {
  const result = await supabase.from("interviews").insert(payload).select(interviewSelect).single();
  if (result.error) throw result.error;
  return result.data;
};

export const updateInterview = async (id, payload) => {
  const result = await supabase.from("interviews").update(payload).eq("id", id).select(interviewSelect).single();
  if (result.error) throw result.error;
  return result.data;
};
