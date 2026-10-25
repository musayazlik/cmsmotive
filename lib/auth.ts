import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendAccountEmail } from "@/lib/plunk";
import {
  APIError,
  createAuthMiddleware,
  addOAuthServerContext,
  getOAuthState,
} from "better-auth/api";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { validAdminEntry } from "@/lib/admin-entry";
import { getLegalSettings } from "@/lib/legal";
import {
  accountRegistrationReady,
  googleAuthConfigured,
} from "@/lib/account-registration";
import { getSiteSettings } from "@/lib/settings";
import { safePurchaseReturn } from "@/lib/purchase-flow";
import { isLocale } from "@/lib/i18n/config";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: googleAuthConfigured()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          disableImplicitSignUp: true,
          disableIdTokenSignIn: true,
          prompt: "select_account",
        },
      }
    : {},
  account: { accountLinking: { disableImplicitLinking: true } },
  user: {
    additionalFields: {
      termsVersion: { type: "string", required: false, input: false },
      privacyVersion: { type: "string", required: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
      accountLocale: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const social = ctx?.path === "/callback/:id";
          if (ctx?.path !== "/sign-up/email" && !social) return { data: user };
          const legal = await getLegalSettings();
          const state = social
            ? (await getOAuthState())?.serverContext?.registrationConsent
            : undefined;
          const consent =
            state && typeof state === "object"
              ? (state as Record<string, unknown>)
              : null;
          const accepted = social
            ? consent?.termsVersion === legal.termsVersion &&
              consent?.privacyVersion === legal.privacyVersion
            : ctx?.body?.termsAccepted === true &&
              ctx.body?.acceptedTermsVersion === legal.termsVersion;
          if (
            !(await getSiteSettings()).allowSignup ||
            !accountRegistrationReady(legal) ||
            !accepted ||
            (social && !user.emailVerified)
          ) {
            throw new APIError("BAD_REQUEST", {
              message:
                "Please accept the current account terms. Registration requires completed legal information.",
            });
          }
          const locale = social ? consent?.locale : ctx?.body?.locale;
          return {
            data: {
              ...user,
              termsVersion: legal.termsVersion,
              privacyVersion: legal.privacyVersion,
              termsAcceptedAt: new Date(),
              accountLocale: isLocale(locale) ? locale : "en",
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          if (ctx?.path !== "/callback/:id") return { data: session };
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { role: true },
          });
          if (user?.role === "admin" || user?.role === "superadmin") {
            const { panelPath } = await getAdminAccessSettings();
            if (
              panelPath !== "/panel" &&
              !validAdminEntry(ctx.headers, panelPath)
            )
              throw new APIError("UNAUTHORIZED", {
                message: "Sign in from the administrator entry.",
              });
          }
          return { data: session };
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social") {
        if (ctx.body?.provider !== "google" || !googleAuthConfigured())
          throw new APIError("BAD_REQUEST", {
            message: "Google sign-in is currently unavailable.",
          });
        const legal = await getLegalSettings();
        const data = ctx.body.additionalData;
        if (
          data?.termsAccepted !== true ||
          data?.acceptedTermsVersion !== legal.termsVersion
        )
          throw new APIError("BAD_REQUEST", {
            message: "Please accept the current account terms.",
          });
        const locale = isLocale(data?.locale) ? data.locale : "en";
        const settings = await getSiteSettings();
        ctx.body.requestSignUp =
          settings.allowSignup && accountRegistrationReady(legal);
        ctx.body.callbackURL =
          safePurchaseReturn(ctx.body.callbackURL) ?? `/account?lang=${locale}`;
        await addOAuthServerContext({
          registrationConsent: {
            termsVersion: legal.termsVersion,
            privacyVersion: legal.privacyVersion,
            locale,
          },
        });
        return;
      }
      if (ctx.path !== "/sign-in/email" || typeof ctx.body?.email !== "string")
        return;
      const { panelPath } = await getAdminAccessSettings();
      if (panelPath === "/panel" || validAdminEntry(ctx.headers, panelPath))
        return;
      const user = await prisma.user.findUnique({
        where: { email: ctx.body.email.trim().toLowerCase() },
        select: { role: true },
      });
      if (user?.role === "admin" || user?.role === "superadmin") {
        // Match the provider's credential failure and hashing cost; do not disclose an admin account or its entry path.
        await ctx.context.password.hash(
          typeof ctx.body.password === "string" ? ctx.body.password : "",
        );
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid email or password",
          code: "INVALID_EMAIL_OR_PASSWORD",
        });
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
