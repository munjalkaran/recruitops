import { useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export default function AuthPage({
  mode,
  onModeChange,
  onSignIn,
  onResetPassword,
  onUpdatePassword,
  onDemo,
  allowDemo,
  isSupabaseConfigured,
  loading,
  message,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    if (mode === "reset") {
      onResetPassword(email);
      return;
    }
    if (mode === "update") {
      onUpdatePassword(password);
      return;
    }
    onSignIn(email, password, remember);
  };

  return (
    <main className="min-h-screen bg-app px-4 py-10 text-primary">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-app bg-surface px-3 py-1.5 text-sm font-bold text-teal-700 dark:text-teal-300">
            <ShieldCheck size={16} />
            Hiring Spartans
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            RecruitOps
          </h1>
          <p className="mt-3 text-xl font-semibold text-secondary">
            From candidate to payment, all in one place
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-secondary">
            A secure recruitment operations workspace for staffing teams placing candidates into
            banks and NBFCs in India. It keeps the spreadsheet feel, but adds roles, approvals,
            audit history and Supabase-backed data controls.
          </p>
        </section>

        <section className="rounded-lg border border-app bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">
            {mode === "reset" ? "Reset password" : mode === "update" ? "Choose a new password" : "Sign in"}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {mode === "update"
              ? "Enter a new password for your RecruitOps account."
              : "Use your Supabase email/password account for this organisation."}
          </p>

          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Supabase is not configured yet. Add `VITE_SUPABASE_URL` and
              `VITE_SUPABASE_ANON_KEY`{allowDemo ? ", or use demo mode to inspect the interface." : "."}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
              {message}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode !== "update" ? (
              <label className="block text-sm font-bold text-primary">
                Email
                <span className="mt-1 flex items-center gap-2 rounded-lg border border-app bg-raised px-3">
                  <Mail size={16} className="text-secondary" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full bg-transparent text-sm outline-none"
                    placeholder="you@company.com"
                  />
                </span>
              </label>
            ) : null}

            {mode !== "reset" ? (
              <label className="block text-sm font-bold text-primary">
                Password
                <span className="mt-1 flex items-center gap-2 rounded-lg border border-app bg-raised px-3">
                  <LockKeyhole size={16} className="text-secondary" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full bg-transparent text-sm outline-none"
                    minLength={8}
                    placeholder={mode === "update" ? "At least 8 characters" : "Password"}
                  />
                </span>
              </label>
            ) : null}

            {mode === "login" ? (
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-app accent-[var(--accent)]"
                />
                Remember me on this device
              </label>
            ) : null}

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="action-button action-primary w-full"
            >
              {loading ? "Please wait..." : mode === "reset" ? "Send reset link" : mode === "update" ? "Save new password" : "Sign in"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => onModeChange(mode === "login" ? "reset" : "login")}
              className="font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              {mode === "login" ? "Forgot password?" : "Back to sign in"}
            </button>
            {!isSupabaseConfigured && allowDemo ? (
              <button
                type="button"
                onClick={onDemo}
                className="font-semibold text-secondary hover:text-primary hover:underline"
              >
                Continue in demo mode
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
