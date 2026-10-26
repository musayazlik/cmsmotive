"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteAccount, deletionBlockers } from "@/lib/account-data";
import { auth } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { prisma } from "@/lib/prisma";

export type DeleteState = { status: "idle" | "error"; message: string };

/**
 * Deletes the signed-in account. Confirmed with the password, or for Google-only
 * accounts by typing the email address; refused for staff accounts and while a
 * subscription can still bill.
 */
export async function deleteAccountAction(_previous: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  if ((await deletionBlockers(user.id)).length)
    return { status: "error", message: copy(l, "This account cannot be deleted yet; see the notes above.", "Dieses Konto kann noch nicht gelöscht werden; siehe Hinweise oben.", "Bu hesap henüz silinemez; yukarıdaki notlara bakın.") };
  if (formData.get("confirm") !== "on")
    return { status: "error", message: copy(l, "Confirm that you understand the deletion is permanent.", "Bestätigen Sie, dass die Löschung endgültig ist.", "Silme işleminin kalıcı olduğunu onaylayın.") };
  const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential", password: { not: null } }, select: { id: true } });
  if (credential) {
    try {
      await auth.api.verifyPassword({ body: { password: String(formData.get("password") ?? "") }, headers: await headers() });
    } catch {
      return { status: "error", message: copy(l, "The password is incorrect.", "Das Passwort ist falsch.", "Şifre hatalı.") };
    }
  } else if (String(formData.get("email") ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    return { status: "error", message: copy(l, "Type your email address exactly to confirm.", "Geben Sie zur Bestätigung Ihre E-Mail-Adresse genau ein.", "Onaylamak için e-posta adresinizi aynen yazın.") };
  }
  if (!(await deleteAccount(user.id)))
    return { status: "error", message: copy(l, "The account could not be deleted. Contact us and we will do it for you.", "Das Konto konnte nicht gelöscht werden. Kontaktieren Sie uns, wir erledigen das.", "Hesap silinemedi. Bize ulaşın, sizin için silelim.") };
  // The sessions are gone with the account; drop the now useless cookies too.
  const jar = await cookies();
  for (const { name } of jar.getAll()) if (name.includes("better-auth")) jar.delete(name);
  redirect(l === "de" ? "/?account=deleted" : `/${l}?account=deleted`);
}
