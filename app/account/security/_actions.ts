"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { prisma } from "@/lib/prisma";

/**
 * Sign-in security for the customer's own account. Each action re-reads the
 * session (server actions are public endpoints) and goes through Better Auth,
 * which checks the session again and applies its own rules (password length,
 * never unlinking the last sign-in method, email verification).
 */

export type SecurityState = { status: "idle" | "ok" | "error"; message: string };

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const apiMessage = (error: unknown) =>
  error && typeof error === "object" && "body" in error && error.body && typeof error.body === "object" && "message" in error.body
    ? String(error.body.message)
    : "";

/** For accounts created with Google: adds an email-and-password sign-in. */
export async function setPasswordAction(_previous: SecurityState, formData: FormData): Promise<SecurityState> {
  await requireCustomer();
  const l = await getRequestLocale();
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)
    return { status: "error", message: copy(l, "Use 8 to 128 characters.", "Verwenden Sie 8 bis 128 Zeichen.", "8 ile 128 karakter arasında bir şifre kullanın.") };
  if (password !== formData.get("confirm"))
    return { status: "error", message: copy(l, "The passwords do not match.", "Die Passwörter stimmen nicht überein.", "Şifreler eşleşmiyor.") };
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
  } catch (error) {
    console.error("set password failed", apiMessage(error));
    return { status: "error", message: copy(l, "The password could not be set.", "Das Passwort konnte nicht gesetzt werden.", "Şifre belirlenemedi.") };
  }
  revalidatePath("/account/security");
  return { status: "ok", message: copy(l, "Password set. You can now also sign in with email and password.", "Passwort gesetzt. Sie können sich jetzt auch mit E-Mail und Passwort anmelden.", "Şifre belirlendi. Artık e-posta ve şifreyle de giriş yapabilirsiniz.") };
}

/** Sends a verification link to the new address; the account switches only once it is confirmed. */
export async function changeEmailAction(_previous: SecurityState, formData: FormData): Promise<SecurityState> {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success)
    return { status: "error", message: copy(l, "Enter a valid email address.", "Geben Sie eine gültige E-Mail-Adresse ein.", "Geçerli bir e-posta adresi girin.") };
  if (email.data === user.email.toLowerCase())
    return { status: "error", message: copy(l, "This is already your email address.", "Das ist bereits Ihre E-Mail-Adresse.", "Bu zaten e-posta adresiniz.") };
  const requestHeaders = await headers();
  const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential", password: { not: null } }, select: { id: true } });
  if (credential) {
    try {
      await auth.api.verifyPassword({ body: { password: String(formData.get("password") ?? "") }, headers: requestHeaders });
    } catch {
      return { status: "error", message: copy(l, "The password is incorrect.", "Das Passwort ist falsch.", "Şifre hatalı.") };
    }
  }
  try {
    await auth.api.changeEmail({ body: { newEmail: email.data, callbackURL: `/account/security?lang=${l}&email=changed` }, headers: requestHeaders });
  } catch (error) {
    console.error("change email failed", apiMessage(error));
    return { status: "error", message: copy(l, "The change could not be started. Try again later.", "Die Änderung konnte nicht gestartet werden. Versuchen Sie es später erneut.", "Değişiklik başlatılamadı. Daha sonra tekrar deneyin.") };
  }
  // Same answer whether or not the address is taken, so this form cannot reveal other accounts.
  return {
    status: "ok",
    message: copy(
      l,
      `If ${email.data} can be used, a confirmation link is on its way there. Your address changes once you open it.`,
      `Falls ${email.data} verwendet werden kann, ist ein Bestätigungslink unterwegs. Ihre Adresse ändert sich, sobald Sie ihn öffnen.`,
      `${email.data} kullanılabiliyorsa oraya bir onay bağlantısı gönderildi. Bağlantıyı açtığınızda adresiniz değişir.`,
    ),
  };
}

/** Signs out one other device. The current session is never revoked here (sign out instead). */
export async function revokeSessionAction(sessionId: string) {
  const user = await requireCustomer();
  const requestHeaders = await headers();
  const current = await auth.api.getSession({ headers: requestHeaders });
  const target = await prisma.session.findFirst({ where: { id: String(sessionId), userId: user.id }, select: { id: true, token: true } });
  if (!target || target.id === current?.session.id) return;
  await auth.api.revokeSession({ body: { token: target.token }, headers: requestHeaders });
  revalidatePath("/account/security");
}

export async function revokeOtherSessionsAction() {
  await requireCustomer();
  await auth.api.revokeOtherSessions({ headers: await headers() });
  revalidatePath("/account/security");
}

/** Removes Google as a sign-in method; Better Auth refuses when it is the only one left. */
export async function unlinkGoogleAction(): Promise<SecurityState> {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  const google = await prisma.account.findFirst({ where: { userId: user.id, providerId: "google" }, select: { id: true } });
  if (!google) return { status: "ok", message: "" };
  try {
    await auth.api.unlinkAccount({ body: { accountId: google.id }, headers: await headers() });
  } catch (error) {
    console.error("unlink google failed", apiMessage(error));
    return { status: "error", message: copy(l, "Set a password first: Google is your only way to sign in.", "Legen Sie zuerst ein Passwort fest: Google ist Ihre einzige Anmeldemethode.", "Önce bir şifre belirleyin: Google tek giriş yönteminiz.") };
  }
  revalidatePath("/account/security");
  return { status: "ok", message: "" };
}
