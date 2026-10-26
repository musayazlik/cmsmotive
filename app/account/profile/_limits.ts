/**
 * Profile field limits shared by the profile forms (HTML maxLength) and the
 * server actions' zod schemas. Plain module — "use server" files may only
 * export async functions.
 */
export const profileFieldMaxLengths = {
  name: 70,
  bio: 400,
  phone: 40,
  company: 100,
  street: 160,
  postalCode: 24,
  city: 80,
  country: 60,
} as const;
