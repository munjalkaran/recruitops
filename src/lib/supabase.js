import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const isDemoEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const friendlySupabaseError = (error) => {
  const message = error?.message || "";
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("15 active users") || message.includes("maximum 15")) return message;
  if (/permission|row-level security|admin permission/i.test(message)) {
    return "You do not have permission to perform that action.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "RecruitOps could not reach Supabase. Please check the project URL and network.";
  }
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  return "RecruitOps could not complete that action. Please check the details and try again.";
};

