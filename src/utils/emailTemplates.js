export const buildCandidateEmailDraft = (candidate, recruiterName, organisationDisplayName) => {
  const name = candidate?.name || "there";
  const bank = candidate?.target_bank || "";
  const role = candidate?.role || "";
  const orgName = organisationDisplayName || "Telora";
  const recruiter = recruiterName || "";
  const subject = bank
    ? `Follow-up on your candidature for ${bank}`
    : "Follow-up on your candidature";

  const lines = [`Hello ${name},`, ""];

  if (recruiter) {
    lines.push(`I am ${recruiter} from ${orgName}.`);
  } else {
    lines.push(`I am reaching out from ${orgName}.`);
  }

  if (role && bank) {
    lines.push(
      `I am following up regarding your candidature for the ${role} opportunity with ${bank}.`,
    );
  } else if (role) {
    lines.push(`I am following up regarding your candidature for the ${role} opportunity.`);
  } else if (bank) {
    lines.push(`I am following up regarding your candidature with ${bank}.`);
  }

  if (candidate?.last_contact) {
    lines.push(`We last spoke on ${candidate.last_contact}.`);
  }

  lines.push(
    "Please confirm whether you are still interested in proceeding with this opportunity.",
    "",
    "Regards,",
  );

  if (recruiter) lines.push(recruiter);
  lines.push(orgName);

  return {
    recipient: candidate?.email || "",
    subject,
    body: lines.join("\n"),
  };
};

export const buildMailtoUrl = ({ recipient, subject, body }) =>
  `mailto:${encodeURIComponent(recipient || "")}?subject=${encodeURIComponent(
    subject || "",
  )}&body=${encodeURIComponent(body || "")}`;

export const buildGmailUrl = ({ recipient, subject, body }) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: recipient || "",
    su: subject || "",
    body: body || "",
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const buildOutlookUrl = ({ recipient, subject, body }) => {
  const params = new URLSearchParams({
    to: recipient || "",
    subject: subject || "",
    body: body || "",
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
};
