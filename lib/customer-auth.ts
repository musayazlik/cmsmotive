import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";
export const requireCustomer = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      accountLocale: true,
      role: true,
      image: true,
      // Profile the customer edits in their account.
      bio: true,
      phone: true,
      company: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });
  if (!user) redirect("/auth/sign-in");
  return user;
});
