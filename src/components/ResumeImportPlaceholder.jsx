import { FileUp } from "lucide-react";
import Modal from "./Modal";

export default function ResumeImportPlaceholder({ onClose }) {
  return (
    <Modal title="Import Resume" onClose={onClose}>
      <div className="rounded-lg border border-dashed border-app bg-raised px-4 py-10 text-center">
        <FileUp className="mx-auto mb-3 text-secondary" size={30} />
        <p className="font-extrabold text-primary">Resume parsing will be enabled in the next AI phase.</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
          The action is placed in the Admin workflow now, but no OpenAI, PDF parsing, or unsafe
          client-side AI code has been added in this build.
        </p>
      </div>
    </Modal>
  );
}
