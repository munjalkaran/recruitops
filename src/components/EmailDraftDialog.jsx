import { Copy, ExternalLink } from "lucide-react";
import {
  buildGmailUrl,
  buildMailtoUrl,
  buildOutlookUrl,
} from "../utils/emailTemplates";
import Modal from "./Modal";

export default function EmailDraftDialog({ draft, onClose, onCopy }) {
  return (
    <Modal title="Email draft preview" description="Review before opening your email client." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div>
            <p className="font-bold text-primary">Recipient</p>
            <p className="mt-1 rounded-lg border border-app bg-raised px-3 py-2 text-secondary">
              {draft.recipient || "No candidate email available"}
            </p>
          </div>
          <div>
            <p className="font-bold text-primary">Subject</p>
            <p className="mt-1 rounded-lg border border-app bg-raised px-3 py-2 text-secondary">
              {draft.subject}
            </p>
          </div>
          <div>
            <p className="font-bold text-primary">Body</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-app bg-raised px-3 py-2 font-sans text-sm leading-6 text-secondary">
              {draft.body}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <a
            href={buildGmailUrl(draft)}
            target="_blank"
            rel="noreferrer"
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <ExternalLink size={16} />
            Open in Gmail
          </a>
          <a
            href={buildOutlookUrl(draft)}
            target="_blank"
            rel="noreferrer"
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <ExternalLink size={16} />
            Open in Outlook
          </a>
          <a
            href={buildMailtoUrl(draft)}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Mail app
          </a>
          <button
            type="button"
            onClick={onCopy}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <Copy size={16} />
            Copy email text
          </button>
          <button
            type="button"
            onClick={onClose}
            className="action-button bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-zinc-950"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
