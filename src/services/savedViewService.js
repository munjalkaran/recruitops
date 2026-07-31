export const listSavedViews = async (supabase, page = "pipeline") => {
  const { data, error } = await supabase.from("saved_views").select("*").eq("page", page).order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createSavedView = async (supabase, payload) => {
  const { data, error } = await supabase.from("saved_views").insert(payload).select("*").single();
  if (error) throw error;
  return data;
};

export const deleteSavedView = async (supabase, id) => {
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw error;
};
