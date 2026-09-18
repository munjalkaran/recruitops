import { KeyRound } from "lucide-react";
import { ROLE_LABELS } from "../constants/pipeline";

const getInitials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function ProfileField({ label, value }) {
  return (
    <div className="rounded-lg border border-app bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-primary">{value || "-"}</p>
    </div>
  );
}

export default function ProfilePage({ profile, organisationName, onChangePassword }) {
  const initials = getInitials(profile?.full_name);
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "User";
  const createdDate = formatDate(profile?.created_at);

  return (
    <div className="page-enter mx-auto w-full max-w-3xl">
      <section className="glass-panel rounded-xl border p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-semibold text-white">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Account</p>
              <h2 className="mt-1 truncate text-xl font-semibold text-primary">
                {profile?.full_name || "Telora user"}
              </h2>
              <p className="mt-1 text-sm text-secondary">Profile details are managed by your administrator.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangePassword}
            className="action-button action-primary w-full justify-center sm:w-auto"
          >
            <KeyRound size={16} />
            Change Password
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ProfileField label="Full name" value={profile?.full_name} />
          <ProfileField label="Email" value={profile?.email} />
          <ProfileField label="Role" value={roleLabel} />
          <ProfileField label="Organisation" value={organisationName} />
          {createdDate ? <ProfileField label="Account created" value={createdDate} /> : null}
        </div>
      </section>
    </div>
  );
}
