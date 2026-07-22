import { supabase } from "../lib/supabase";

const unwrap = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};

export const getDemoDataStatus = async () => {
  const rows = await unwrap(supabase.rpc("get_demo_data_status"));
  return rows?.[0] || null;
};

export const removeDemoData = () => unwrap(supabase.rpc("remove_demo_data"));

export const restoreDemoData = (batchId = null) =>
  unwrap(supabase.rpc("restore_demo_data", { p_demo_batch_id: batchId }));

export const seedDemoData = () =>
  unwrap(supabase.rpc("seed_demo_data_for_current_organisation"));

