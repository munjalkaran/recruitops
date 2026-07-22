import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { friendlySupabaseError, hasSupabaseConfig, supabase } from "../lib/supabase";
import { getCurrentProfile } from "../services/profileService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    const load = async (nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setProfile(null);
      setError("");
      if (!nextSession?.user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const nextProfile = await getCurrentProfile(nextSession.user.id);
        if (!nextProfile) throw new Error("Profile not configured. Ask an Admin to create your RecruitOps profile.");
        if (active) setProfile(nextProfile);
      } catch (loadError) {
        if (active) setError(loadError.message?.startsWith("Profile not configured") ? loadError.message : friendlySupabaseError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
      load(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    error,
    passwordRecovery,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    }),
    updatePassword: async (password) => {
      const result = await supabase.auth.updateUser({ password });
      if (!result.error) setPasswordRecovery(false);
      return result;
    },
    cancelPasswordRecovery: () => setPasswordRecovery(false),
  }), [error, loading, passwordRecovery, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
