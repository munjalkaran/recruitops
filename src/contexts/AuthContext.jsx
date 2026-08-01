import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { friendlySupabaseError, hasSupabaseConfig, setAuthPersistence, supabase } from "../lib/supabase";
import { getCurrentProfile } from "../services/profileService";

const AuthContext = createContext(null);
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const IDLE_WARNING_MS = 28 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const warningTimer = useRef(null);
  const logoutTimer = useRef(null);
  const activityChannel = useRef(null);
  const lastActivity = useRef(0);

  const clearIdleTimers = useCallback(() => {
    window.clearTimeout(warningTimer.current);
    window.clearTimeout(logoutTimer.current);
  }, []);

  const armIdleTimers = useCallback((broadcast = false) => {
    if (!supabase) return;
    clearIdleTimers();
    setIdleWarning(false);
    warningTimer.current = window.setTimeout(() => setIdleWarning(true), IDLE_WARNING_MS);
    logoutTimer.current = window.setTimeout(() => supabase.auth.signOut(), IDLE_LIMIT_MS);
    if (broadcast) activityChannel.current?.postMessage({ type: "activity" });
  }, [clearIdleTimers]);

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
        if (!nextProfile) throw new Error("Profile not configured. Ask an Admin to create your Telora profile.");
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

  useEffect(() => {
    if (!session) {
      clearIdleTimers();
      setIdleWarning(false);
      return undefined;
    }

    activityChannel.current =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("recruitops-auth");
    activityChannel.current?.addEventListener("message", (event) => {
      if (event.data?.type === "activity") armIdleTimers(false);
      if (event.data?.type === "signout") supabase.auth.signOut();
    });

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity.current < 1000) return;
      lastActivity.current = now;
      armIdleTimers(true);
    };
    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, onActivity, { passive: true }),
    );
    armIdleTimers(false);

    return () => {
      clearIdleTimers();
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      activityChannel.current?.close();
      activityChannel.current = null;
    };
  }, [armIdleTimers, clearIdleTimers, session]);

  const signOut = useCallback(async () => {
    activityChannel.current?.postMessage({ type: "signout" });
    return supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    error,
    passwordRecovery,
    idleWarning,
    staySignedIn: () => armIdleTimers(true),
    signIn: (email, password, remember = false) => {
      setAuthPersistence(remember);
      return supabase.auth.signInWithPassword({ email, password });
    },
    signOut,
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    }),
    updatePassword: async (password) => {
      const result = await supabase.auth.updateUser({ password });
      if (!result.error) setPasswordRecovery(false);
      return result;
    },
    cancelPasswordRecovery: () => setPasswordRecovery(false),
  }), [armIdleTimers, error, idleWarning, loading, passwordRecovery, profile, session, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {idleWarning ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="idle-title">
          <div className="premium-card w-full max-w-md p-6">
            <h2 id="idle-title" className="text-lg text-primary">Your session will end soon due to inactivity.</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">For your security, Telora signs you out after 30 minutes without activity.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={signOut} className="action-button border border-app bg-surface text-secondary hover:bg-raised">Sign out now</button>
              <button type="button" onClick={() => armIdleTimers(true)} className="action-button action-primary">Stay signed in</button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
