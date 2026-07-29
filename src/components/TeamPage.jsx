import { ROLE_LABELS } from "../constants/pipeline";

export default function TeamPage({ profiles, activeUserLimit, onUpdateProfile }) {
  const activeCount = profiles.filter((profile) => profile.is_active).length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-app bg-surface p-4">
        <p className="text-sm font-bold text-secondary">Free plan user limit</p>
        <p className="mt-1 text-xl font-semibold text-primary">
          {activeCount} of {activeUserLimit} active users
        </p>
        {activeCount >= activeUserLimit ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Your free plan supports up to 15 active users. Upgrade the plan to add more users.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-app bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-raised text-xs uppercase text-secondary">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td className="px-3 py-2 font-bold text-primary">{profile.full_name}</td>
                <td className="px-3 py-2 text-secondary">{profile.email || "-"}</td>
                <td className="px-3 py-2">
                  <select
                    value={profile.role}
                    onChange={(event) => onUpdateProfile(profile.id, { role: event.target.value })}
                    className="h-9 rounded-lg border border-app bg-raised px-2 text-sm text-primary"
                    aria-label={`Role for ${profile.full_name}`}
                  >
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
                    <input
                      type="checkbox"
                      checked={profile.is_active}
                      onChange={(event) =>
                        onUpdateProfile(profile.id, { is_active: event.target.checked })
                      }
                    />
                    {profile.is_active ? "Active" : "Inactive"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
