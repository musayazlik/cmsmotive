"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomer } from "@/lib/customer-auth";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import { prisma } from "@/lib/prisma";
import { profileFieldMaxLengths } from "./_limits";

/**
 * The customer's own profile details, edited in /account/profile.
 * Every action re-checks the session because server actions are reachable
 * endpoints, unlike the page layout.
 */

/** Client feedback echoed back through useActionState; the message is localized server-side. */
export type ProfileActionState = { status: "idle" | "ok" | "error"; message: string };

/** Optional profile columns: trimmed, empty becomes NULL so "no value" reads cleanly. */
const nullable = (max: number) => z.string().trim().max(max).transform((value) => value || null);

const detailsSchema = z.object({
  name: z.string().trim().min(1).max(profileFieldMaxLengths.name),
  bio: nullable(profileFieldMaxLengths.bio),
});

const addressSchema = z.object({
  phone: nullable(profileFieldMaxLengths.phone),
  company: nullable(profileFieldMaxLengths.company),
  street: nullable(profileFieldMaxLengths.street),
  postalCode: nullable(profileFieldMaxLengths.postalCode),
  city: nullable(profileFieldMaxLengths.city),
  country: nullable(profileFieldMaxLengths.country),
});

/** Details form: display name and the short "about" text. */
export async function saveProfileDetailsAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: copy(
        l,
        "The name is required and must be at most 70 characters.",
        "Der Name ist erforderlich und darf höchstens 70 Zeichen lang sein.",
        "Ad zorunludur ve en fazla 70 karakter olabilir.",
      ),
    };
  }
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/account/profile");
  return { status: "ok", message: copy(l, "Saved.", "Gespeichert.", "Kaydedildi.") };
}

/** Address and contact form: phone plus the postal address lines. */
export async function saveAddressAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  const parsed = addressSchema.safeParse({
    phone: formData.get("phone"),
    company: formData.get("company"),
    street: formData.get("street"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: copy(
        l,
        "Check the field lengths and try again.",
        "Prüfen Sie die Feldlängen und versuchen Sie es erneut.",
        "Alan uzunluklarını kontrol edip tekrar deneyin.",
      ),
    };
  }
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/account/profile");
  return { status: "ok", message: copy(l, "Saved.", "Gespeichert.", "Kaydedildi.") };
}

/** Clears the uploaded profile picture (Google avatars are re-synced on sign-in). */
export async function removeAvatarAction(): Promise<ProfileActionState> {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  if (user.image) {
    await prisma.user.update({ where: { id: user.id }, data: { image: null } });
    revalidatePath("/account/profile");
  }
  return {
    status: "ok",
    message: copy(l, "Profile picture removed.", "Profilbild entfernt.", "Profil fotoğrafı kaldırıldı."),
  };
}
