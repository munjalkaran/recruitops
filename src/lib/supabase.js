import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "recruitops";
const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;
const AUTH_PERSISTENCE_KEY = "recruitops-remember-session";

const authStorage = {
  getItem(key) {
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem(key, value) {
    const persistent = window.localStorage.getItem(AUTH_PERSISTENCE_KEY) === "true";
    const target = persistent ? window.localStorage : window.sessionStorage;
    const other = persistent ? window.sessionStorage : window.localStorage;
    target.setItem(key, value);
    other.removeItem(key);
  },
  removeItem(key) {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  },
};

export const setAuthPersistence = (remember) => {
  window.localStorage.setItem(AUTH_PERSISTENCE_KEY, String(Boolean(remember)));
  if (!remember) window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const isDemoEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === "true";

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
        storage: authStorage,
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
