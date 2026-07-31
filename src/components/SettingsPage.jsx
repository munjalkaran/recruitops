import { Moon, ShieldCheck, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import DemoDataManager from "./DemoDataManager";
import { TeloraLogo } from "./TeloraLogo";

export default function SettingsPage({
  settings,
  onSave,
  demoStatus,
  demoBusy,
  onRemoveDemo,
  onRestoreDemo,
  theme = "light",
  onToggleTheme,
  billingSettings = {},
  onSaveBilling,
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(billingSettings);
  const [billingSaving, setBillingSaving] = useState(false);

  useEffect(() => setForm(settings), [settings]);
  useEffect(() => setBilling(billingSettings), [billingSettings]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const saveBilling = async () => {
    setBillingSaving(true);
    try {
      await onSaveBilling?.(billing);
    } finally {
      setBillingSaving(false);
    }
  };

  return (
    <div className="page-enter mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 min-[900px]:grid-cols-2">
      <section className="glass-panel rounded-xl border p-5 sm:p-6 min-[900px]:col-start-1 min-[900px]:row-start-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Organisation</p>
          <h2 className="mt-1 text-xl font-semibold text-primary">Organisation and communication</h2>
          <p className="mt-1 text-sm text-secondary">Tenant branding and communication defaults used by Telora.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-primary">
            Display name
            <input value={form.display_name || ""} onChange={(event) => update("display_name", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm font-normal text-primary outline-none" />
          </label>
          <div className="rounded-lg border border-app bg-raised px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Product</p>
            <p className="mt-1 font-semibold text-primary">Telora</p>
            <p className="text-xs text-secondary">Product identity is fixed.</p>
          </div>
          <label className="block text-sm font-semibold text-primary md:col-span-2">
            Email signature
            <textarea value={form.email_signature || ""} onChange={(event) => update("email_signature", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm font-normal text-primary outline-none" />
          </label>
          <label className="block text-sm font-semibold text-primary md:col-span-2">
            Default email template
            <textarea value={form.default_email_template || ""} onChange={(event) => update("default_email_template", event.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm font-normal text-primary outline-none" />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-secondary">Changes apply to organisation communication defaults.</p>
          <button type="button" disabled={saving} onClick={save} className="action-button action-primary">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </section>

      <DemoDataManager
        status={demoStatus}
        busy={demoBusy}
        onRemove={onRemoveDemo}
        onRestore={onRestoreDemo}
      />

      <section className="glass-panel rounded-xl border p-5 sm:p-6 min-[900px]:col-start-1 min-[900px]:row-start-2">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-[var(--accent)]" />
          <div>
            <h2 className="text-base font-semibold text-primary">Security and session</h2>
            <p className="mt-1 text-sm text-secondary">Access is controlled by your Telora role and organisation policies.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-app bg-surface p-3">
            <p className="text-xs uppercase tracking-wide text-secondary">Session</p>
            <p className="mt-1 text-sm font-semibold text-primary">30-minute inactivity timeout</p>
          </div>
          <div className="rounded-lg border border-app bg-surface p-3">
            <p className="text-xs uppercase tracking-wide text-secondary">Data boundary</p>
            <p className="mt-1 text-sm font-semibold text-primary">Organisation-only access</p>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-xl border p-5 sm:p-6 min-[900px]:col-start-2 min-[900px]:row-start-2">
        <div className="flex items-center gap-3">
          <TeloraLogo size={36} />
          <div>
            <p className="font-semibold text-primary">Telora</p>
            <p className="text-xs text-secondary">Talent, tracked with clarity. Powered by AI.</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg border border-app bg-surface px-3 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Appearance</p>
            <p className="mt-1 text-sm font-semibold text-primary">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
          <button type="button" onClick={onToggleTheme} className="glass-control rounded-full border p-2" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </section>

      <section className="glass-panel rounded-xl border p-5 sm:p-6 min-[900px]:col-span-2 min-[900px]:row-start-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Billing</p>
          <h2 className="mt-1 text-base font-semibold text-primary">Invoice details</h2>
          <p className="mt-1 text-sm text-secondary">Tax and legal fields stay blank until your team configures them.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-primary">
            Legal name
            <input value={billing.legal_name || ""} onChange={(event) => setBilling((current) => ({ ...current, legal_name: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm font-normal text-primary outline-none" />
          </label>
          <label className="block text-sm font-semibold text-primary">
            GSTIN
            <input value={billing.gstin || ""} onChange={(event) => setBilling((current) => ({ ...current, gstin: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm font-normal text-primary outline-none" />
          </label>
          <label className="block text-sm font-semibold text-primary">
            Payment terms
            <input value={billing.payment_terms || ""} onChange={(event) => setBilling((current) => ({ ...current, payment_terms: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm font-normal text-primary outline-none" />
          </label>
          <label className="block text-sm font-semibold text-primary">
            Invoice prefix
            <input value={billing.invoice_prefix || ""} onChange={(event) => setBilling((current) => ({ ...current, invoice_prefix: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm font-normal text-primary outline-none" placeholder="TELORA" />
          </label>
          <label className="block text-sm font-semibold text-primary sm:col-span-2">
            Billing address
            <textarea value={billing.billing_address || ""} onChange={(event) => setBilling((current) => ({ ...current, billing_address: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm font-normal text-primary outline-none" />
          </label>
          <label className="block text-sm font-semibold text-primary sm:col-span-2">
            Payment instructions
            <textarea value={billing.payment_instructions || ""} onChange={(event) => setBilling((current) => ({ ...current, payment_instructions: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm font-normal text-primary outline-none" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" disabled={billingSaving} onClick={saveBilling} className="action-button action-primary">{billingSaving ? "Saving…" : "Save billing details"}</button>
        </div>
      </section>
    </div>
  );
}
