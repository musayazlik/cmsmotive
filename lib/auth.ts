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
  rateLimit: {
    // Explicit so dev and prod behave the same (better-auth otherwise only
    // limits in production). "memory" counts per process, which is fine for
    // the single-instance deployment; switch to "database" when scaling out.
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory",
    customRules: {
      // Brute-force protection for credential sign-in: 5 attempts per minute
      // per IP address, then 429 with a Retry-After header.
      "/sign-in/email": { window: 60, max: 5 },
      // These endpoints trigger an e-mail each hit, so keep them tight.
      "/request-password-reset": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 3 },
    },
  },
});
