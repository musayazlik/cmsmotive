import { renderContactAckEmail } from "@/emails/contact-ack";
import { originOfStore } from "@/lib/current-store";
import { contactRecipient, getEmailSettings } from "@/lib/settings";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { panelHref } from "@/lib/admin-access-shared";
import { getLegalSettings } from "@/lib/legal";

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

/** Whether PLUNK_SECRET_KEY and the verified sender address are set. */
export function isPlunkConfigured(): boolean {
  return Boolean(process.env.PLUNK_SECRET_KEY && process.env.PLUNK_FROM_EMAIL);
}

/**
 * One Plunk send on behalf of a store. The key and verified sender address
 * come from the environment; the display name from the store's Settings →
 * Email. Every sender below takes the store whose settings, inbox and links
 * the mail uses.
 */
async function send(storeId: string, message: { to: string; subject: string; body: string; reply?: string }) {
  const key = process.env.PLUNK_SECRET_KEY;
  const from = process.env.PLUNK_FROM_EMAIL;
  if (!key || !from) throw new Error("Plunk email configuration is incomplete.");

  if (!message.to) throw new Error("No recipient: set the store's contact inbox in Settings → Email.");
  const { senderName } = await getEmailSettings(storeId);
  const response = await fetch("https://next-api.useplunk.com/v1/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: message.to,
      from: { name: senderName, email: from },
      ...(message.reply ? { reply: message.reply } : {}),
      subject: message.subject.replace(/[\r\n]/g, " "),
      body: message.body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await plunkError(response);
}

export async function sendAccountEmail(storeId: string, message: Message) {
  const subject = escapeHtml(message.subject);
  const actionUrl = escapeHtml(message.actionUrl);
  const actionText = escapeHtml(message.actionText);
  const legal=await getLegalSettings(storeId);
  const origin=await originOfStore(storeId);
  const footer=`<p style="font-size:12px;color:#5e666d">${escapeHtml(legal.legalName)}<br>${escapeHtml(legal.address)}<br>${escapeHtml(legal.country)}<br><a href="mailto:${escapeHtml(legal.contactEmail)}">${escapeHtml(legal.contactEmail)}</a><br><a href="${escapeHtml(origin)}/imprint">Impressum</a> · <a href="${escapeHtml(origin)}/privacy">Privacy / Datenschutz / Gizlilik</a></p>`;
  await send(storeId, {
    to: message.to,
    subject: message.subject,
    body: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#101418"><h1 style="font-size:28px">${subject}</h1><p>Complete your CMSMotive request using the button below.</p><p><a href="${actionUrl}" style="display:inline-block;background:#4353e8;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none">${actionText}</a></p><p style="font-size:12px;color:#5e666d">If you did not request this, you can ignore this email.</p>${footer}</div>`,
  });
}

/** Label/value rows as a simple, client-proof HTML mail. */
function rowsEmail(heading: string, rows: [string, string][], action?: { url: string; text: string }) {
  const button = action
    ? `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#4353e8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(action.text)}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1>${escapeHtml(heading)}</h1>${rows.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`).join("")}${button}</div>`;
}

export async function sendContactEmail(storeId: string, message: {
  name: string; email: string; agency: string; typo3Version: string; license: string; message: string;
}) {
  const rows: [string, string][] = [
    ["Name", message.name], ["Email", message.email], ["Agency", message.agency],
    ["TYPO3", message.typo3Version], ["License", message.license], ["Message", message.message],
  ];
  await send(storeId, {
    to: contactRecipient(await getEmailSettings(storeId)),
    reply: message.email,
    subject: `New inquiry from ${message.agency}`,
    body: rowsEmail("New CMSMotive inquiry", rows),
  });
}

/**
 * Auto-reply to the person who submitted the contact form. Replies to it land
 * on the contact inbox, so the conversation stays in one thread.
 */
export async function sendContactAckEmail(storeId: string, message: {
  to: string;
  name: string;
  agency: string;
  message: string;
}) {
  const body = await renderContactAckEmail({ name: message.name, agency: message.agency, message: message.message });
  await send(storeId, {
    to: message.to,
    reply: contactRecipient(await getEmailSettings(storeId)),
    subject: "We got your message — CMSMotive",
    body,
  });
}

/**
 * Admin notification (new review, new subscriber) to the contact inbox.
 * `actionPath` is a panel path, made absolute against the site origin.
 */
export async function sendNotificationEmail(storeId: string, message: {
  subject: string;
  heading: string;
  rows: [string, string][];
  replyTo?: string;
  actionPath?: string;
  actionText?: string;
}) {
  const action = message.actionPath
    ? { url: `${await originOfStore(storeId)}${panelHref(message.actionPath, (await getAdminAccessSettings()).panelPath)}`, text: message.actionText ?? "Open the panel" }
    : undefined;
  await send(storeId, {
    to: contactRecipient(await getEmailSettings(storeId)),
    reply: message.replyTo,
    subject: message.subject,
    body: rowsEmail(message.heading, message.rows, action),
  });
}

/** Settings → Email "Send test e-mail": proves the key, sender and inbox work together. */
export async function sendTestEmail(storeId: string): Promise<string> {
  const to = contactRecipient(await getEmailSettings(storeId));
  await sendNotificationEmail(storeId, {
    subject: "CMSMotive test e-mail",
    heading: "Your e-mail settings work",
    rows: [
      ["Sent to", to],
      ["Sent at", new Date().toUTCString()],
    ],
    actionPath: "/panel/settings?tab=email",
    actionText: "Back to the settings",
  });
  return to;
}
