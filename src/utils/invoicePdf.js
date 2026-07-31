const escapePdfText = (value) => String(value ?? "").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("\n", " ");

const line = (text, x, y, size = 10, bold = false) => `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;

export const buildInvoicePdf = ({ groups = [], billingSettings = {}, organisationName = "Hiring Spartans", invoiceNumber = "TELORA-DRAFT", generatedAt = new Date() }) => {
  const lines = [
    [organisationName, 50, 800, 18, true],
    [`Invoice ${invoiceNumber}`, 50, 778, 10, true],
    [billingSettings.legal_name || "Legal name not configured", 50, 758, 10, false],
    [billingSettings.billing_address || "Billing address not configured", 50, 742, 10, false],
    [`Invoice date: ${generatedAt.toISOString().slice(0, 10)}`, 50, 726, 10, false],
    [`Payment terms: ${billingSettings.payment_terms || "Not configured"}`, 50, 710, 10, false],
    ["Candidate", 50, 678, 10, true],
    ["Client", 280, 678, 10, true],
    ["Fee", 470, 678, 10, true],
  ];
  let y = 658;
  groups.forEach((group) => group.candidates.forEach((candidate) => {
    lines.push([candidate.name || "Unnamed candidate", 50, y, 10, false]);
    lines.push([group.bank || "Unassigned client", 280, y, 10, false]);
    lines.push([`INR ${Number(candidate.fee || 0).toLocaleString("en-IN")}`, 470, y, 10, false]);
    y -= 18;
  }));
  const total = groups.reduce((sum, group) => sum + Number(group.subtotal || 0), 0);
  lines.push([`Total: INR ${total.toLocaleString("en-IN")}`, 360, Math.max(y - 8, 60), 12, true]);
  if (billingSettings.gstin) lines.push([`GSTIN: ${billingSettings.gstin}`, 50, Math.max(y - 8, 60), 9, false]);
  if (billingSettings.payment_instructions) lines.push([billingSettings.payment_instructions, 50, Math.max(y - 28, 42), 9, false]);

  const content = lines.map(([text, x, top, size, bold]) => line(text, x, top, size, bold)).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
};

export const downloadInvoicePdf = (payload, filename = "telora-invoice.pdf") => {
  const url = URL.createObjectURL(buildInvoicePdf(payload));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
