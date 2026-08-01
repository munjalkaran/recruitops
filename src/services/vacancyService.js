import { supabase } from "../lib/supabase";

const unwrap = async (request) => { const { data, error } = await request; if (error) throw error; return data; };
export const listVacancies = () => unwrap(supabase.from("vacancies").select("*, candidates(id)").order("updated_at", { ascending: false }));
export const createVacancy = (payload) => unwrap(supabase.from("vacancies").insert(payload).select().single());
export const updateVacancy = (id, payload) => unwrap(supabase.from("vacancies").update(payload).eq("id", id).select().single());
