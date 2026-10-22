import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendAccountEmail } from "@/lib/plunk";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { validAdminEntry } from "@/lib/admin-entry";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" || typeof ctx.body?.email !== "string") return;
      const { panelPath } = await getAdminAccessSettings();
      if (panelPath === "/panel" || validAdminEntry(ctx.headers, panelPath)) return;
      const user = await prisma.user.findUnique({
        where: { email: ctx.body.email.trim().toLowerCase() }, select: { role: true },
      });
      if (user?.role === "admin" || user?.role === "superadmin") {
        // Match the provider's credential failure and hashing cost; do not disclose an admin account or its entry path.
        await ctx.context.password.hash(typeof ctx.body.password === "string" ? ctx.body.password : "");
        throw new APIError("UNAUTHORIZED", { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" });
      }
    }),
  },
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
