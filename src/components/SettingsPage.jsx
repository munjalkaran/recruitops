import { useEffect, useState } from "react";
import DemoDataManager from "./DemoDataManager";

export default function SettingsPage({ settings, onSave, demoStatus, demoBusy, onRemoveDemo, onRestoreDemo }) {
  const [form, setForm] = useState(settings);

  useEffect(() => setForm(settings), [settings]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="max-w-3xl space-y-4">
      <section className="rounded-lg border border-app bg-surface p-5">
        <h2 className="text-lg font-semibold text-primary">Organisation settings</h2>
        <p className="mt-1 text-sm text-secondary">
          Branding and email defaults shown throughout RecruitOps.
        </p>

        <div className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-primary">
          Display name
          <input
            value={form.display_name || ""}
            onChange={(event) => update("display_name", event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none"
          />
        </label>
        <label className="block text-sm font-bold text-primary">
          Email signature
          <textarea
            value={form.email_signature || ""}
            onChange={(event) => update("email_signature", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm text-primary outline-none"
          />
        </label>
        <label className="block text-sm font-bold text-primary">
          Default email template
          <textarea
            value={form.default_email_template || ""}
            onChange={(event) => update("default_email_template", event.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm text-primary outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => onSave(form)}
          className="action-button action-primary"
        >
          Save settings
        </button>
        </div>
      </section>
      <DemoDataManager
        status={demoStatus}
        busy={demoBusy}
        onRemove={onRemoveDemo}
        onRestore={onRestoreDemo}
      />
    </div>
  );
}
