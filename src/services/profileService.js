import { supabase } from "../lib/supabase";

export const getCurrentProfile = async (userId) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
};

export const listOrganisationProfiles = async (organisationId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("full_name");
  if (error) throw error;
  return data;
};

export const updateProfile = async (profileId, updates) => {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", profileId).select().single();
  if (error) throw error;
  return data;
};

