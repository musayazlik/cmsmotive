/**
 * Client-safe contract for outgoing e-mail. The Plunk key and the verified
 * sender address stay in the environment; these settings shape what is sent
 * and to whom.
 */

export type EmailSettings = {
  /** Display name on every outgoing e-mail. */
  senderName: string;
  /** Inbox for contact form inquiries and admin notifications; "" = PLUNK_CONTACT_TO_EMAIL. */
  contactRecipient: string;
  /** Send the "we got your message" auto-reply to people who use the contact form. */
  contactAutoReply: boolean;
  /** E-mail the contact inbox when a product review is submitted. */
  notifyReviews: boolean;
  /** E-mail the contact inbox when someone joins the newsletter. */
  notifySubscribers: boolean;
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  senderName: "CMSMotive",
  contactRecipient: "",
  contactAutoReply: true,
  notifyReviews: false,
  notifySubscribers: false,
};

/** Used when neither the setting nor PLUNK_CONTACT_TO_EMAIL names an inbox. */
export const FALLBACK_CONTACT_RECIPIENT = "hello@cmsmotive.de";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailSettings(input: Record<string, unknown>): { error: string } | { data: EmailSettings } {
  const senderName = typeof input.senderName === "string" ? input.senderName.trim().replace(/[\r\n]/g, " ") : "";
  if (!senderName || senderName.length > 60) return { error: "The sender name must be 1–60 characters." };

  const contactRecipient =
    typeof input.contactRecipient === "string" ? input.contactRecipient.trim().toLowerCase() : "";
  if (contactRecipient && (!EMAIL.test(contactRecipient) || contactRecipient.length > 254)) {
    return { error: "Enter a valid inbox address or leave it empty to use the environment default." };
  }

  const flags = ["contactAutoReply", "notifyReviews", "notifySubscribers"] as const;
  if (flags.some((flag) => typeof input[flag] !== "boolean")) return { error: "Invalid e-mail settings." };

  return {
    data: {
      senderName,
      contactRecipient,
      contactAutoReply: input.contactAutoReply as boolean,
      notifyReviews: input.notifyReviews as boolean,
      notifySubscribers: input.notifySubscribers as boolean,
    },
  };
}
