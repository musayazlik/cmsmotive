import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendAccountEmail } from "@/lib/plunk";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAccountEmail({
        to: user.email,
        subject: "Reset your CMSMotive password",
        actionUrl: url,
        actionText: "Reset password",
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAccountEmail({
        to: user.email,
        subject: "Confirm your CMSMotive email",
        actionUrl: url,
        actionText: "Confirm email",
      });
    },
  },
});
