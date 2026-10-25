import { betterAuth } from "better-auth";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { getStoreRole, isStoreAdmin } from "./store-access";
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
import { allStoreOrigins, resolveRequestStore } from "@/lib/stores";
import { currentStoreId } from "@/lib/current-store";

/** Store an auth request belongs to: its settings decide sign-up, consent versions and emails. */
async function authStoreId(source?: Request | Headers | null): Promise<string> {
  return source ? (await resolveRequestStore(source)).store.id : currentStoreId();
}

export const auth = betterAuth({
  plugins: [oneTimeToken({ disableClientRequest: true, storeToken: "hashed", expiresIn: 1 })],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // One auth server for every store: links, cookies and the Google callback
  // follow the request's host. Stores live in the database, so any host is
  // let through here and app/api/auth rejects hosts that are no store domain
  // (lib/stores.ts isAccountHost) before Better Auth sees the request.
  baseURL: { allowedHosts: ["*"], protocol: "auto" },
  // The reverse proxy's x-forwarded-host/-proto name the public store domain,
  // the same headers the host check reads.
  advanced: { trustedProxyHeaders: true },
  trustedOrigins: async (request) => {
    const origins = await allStoreOrigins();
    return request ? [...origins, (await resolveRequestStore(request)).origin] : origins;
  },
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
          const storeId = await authStoreId(ctx?.headers ?? ctx?.request);
          const legal = await getLegalSettings(storeId);
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
            !(await getSiteSettings(storeId)).allowSignup ||
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
        after: async (user, ctx) => {
          if (ctx?.path !== "/sign-up/email" && !ctx?.path.startsWith("/callback/")) return;
          const storeId = await authStoreId(ctx.headers ?? ctx.request);
          await prisma.storeMember.upsert({
            where: { storeId_userId: { storeId, userId: user.id } },
            create: { storeId, userId: user.id, role: "user" }, update: {},
          });
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          if (ctx?.path !== "/callback/:id") return { data: session };
          if (isStoreAdmin(await getStoreRole(session.userId, await authStoreId(ctx.headers ?? ctx.request)))) {
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
        const storeId = await authStoreId(ctx.headers ?? ctx.request);
        const legal = await getLegalSettings(storeId);
        const data = ctx.body.additionalData;
        if (
          data?.termsAccepted !== true ||
          data?.acceptedTermsVersion !== legal.termsVersion
        )
          throw new APIError("BAD_REQUEST", {
            message: "Please accept the current account terms.",
          });
        const locale = isLocale(data?.locale) ? data.locale : "en";
        const settings = await getSiteSettings(storeId);
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
        select: { id: true },
      });
      if (user && isStoreAdmin(await getStoreRole(user.id, await authStoreId(ctx.headers ?? ctx.request)))) {
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
    sendResetPassword: async ({ user, url }, request) => {
      await sendAccountEmail(await authStoreId(request), {
        to: user.email,
        subject: "Reset your CMSMotive password",
        actionUrl: url,
        actionText: "Reset password",
      }, request ? (await resolveRequestStore(request)).origin : undefined);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      await sendAccountEmail(await authStoreId(request), {
        to: user.email,
        subject: "Confirm your CMSMotive email",
        actionUrl: url,
        actionText: "Confirm email",
      }, request ? (await resolveRequestStore(request)).origin : undefined);
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
