import { renderContactAckEmail } from "@/emails/contact-ack";

type Message = { to: string; subject: string; actionUrl: string; actionText: string };

/** Plunk's JSON error body carries the real cause (invalid key, unverified sender, …). */
async function plunkError(response: Response): Promise<Error> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    // body already consumed or unreadable — status alone is still better than nothing
  }
  return new Error(`Plunk request failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export async function sendAccountEmail(message: Message) {
  const key = process.env.PLUNK_SECRET_KEY;
  const from = process.env.PLUNK_FROM_EMAIL;
  if (!key || !from) throw new Error("Plunk email configuration is incomplete.");

  const subject = escapeHtml(message.subject);
  const actionUrl = escapeHtml(message.actionUrl);
  const actionText = escapeHtml(message.actionText);
  const response = await fetch("https://next-api.useplunk.com/v1/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: message.to,
      from: { name: "CMSMotive", email: from },
      subject: message.subject,
      body: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#101418"><h1 style="font-size:28px">${subject}</h1><p>Continue to your CMSMotive account with the button below.</p><p><a href="${actionUrl}" style="display:inline-block;background:#4353e8;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none">${actionText}</a></p><p style="font-size:12px;color:#5e666d">If you did not request this, you can ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await plunkError(response);
}

export async function sendContactEmail(message: {
  name: string; email: string; agency: string; typo3Version: string; license: string; message: string;
}) {
  const key = process.env.PLUNK_SECRET_KEY;
  const from = process.env.PLUNK_FROM_EMAIL;
  const to = process.env.PLUNK_CONTACT_TO_EMAIL || "hello@cmsmotive.de";
  if (!key || !from) throw new Error("Plunk email configuration is incomplete.");

  const rows = [
    ["Name", message.name], ["Email", message.email], ["Agency", message.agency],
    ["TYPO3", message.typo3Version], ["License", message.license], ["Message", message.message],
  ];
  const body = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1>New CMSMotive inquiry</h1>${rows.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
  const response = await fetch("https://next-api.useplunk.com/v1/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to, from: { name: "CMSMotive", email: from }, reply: message.email,
      subject: `New inquiry from ${message.agency.replace(/[\r\n]/g, " ")}`,
      body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await plunkError(response);
}

/**
 * Auto-reply to the person who submitted the contact form. Replies to it land
 * on the contact inbox, so the conversation stays in one thread.
 */
export async function sendContactAckEmail(message: {
  to: string;
  name: string;
  agency: string;
  message: string;
}) {
  const key = process.env.PLUNK_SECRET_KEY;
  const from = process.env.PLUNK_FROM_EMAIL;
  if (!key || !from) throw new Error("Plunk email configuration is incomplete.");

  const body = await renderContactAckEmail({ name: message.name, agency: message.agency, message: message.message });
  const response = await fetch("https://next-api.useplunk.com/v1/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: message.to,
      from: { name: "CMSMotive", email: from },
      reply: process.env.PLUNK_CONTACT_TO_EMAIL || "hello@cmsmotive.de",
      subject: "We got your message — CMSMotive",
      body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await plunkError(response);
}
