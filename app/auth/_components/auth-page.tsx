import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getSiteSettings } from "@/lib/settings";
import { AUTH_CONTENT, type AuthPageName } from "./auth-content";
import AuthScreen from "./auth-screen";

type AuthSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Shared page factory for the account pages: settings and the private admin
 * entry (proxy.ts rewrites <panelPath>/login to /auth/sign-in) resolve per
 * request, then the page renders from the AUTH_CONTENT copy.
 */
export function authRoute(page: AuthPageName) {
  /** Same titles and descriptions the static previews ship. */
  async function generateMetadata(): Promise<Metadata> {
    const content = AUTH_CONTENT[page];
    return {
      title: `${content.documentTitle} — CMSMotive`,
      description: content.description,
      robots: { index: false, follow: false },
    };
  }

  async function Page({ searchParams }: { searchParams: AuthSearchParams }) {
    const [{ panelPath }, { allowSignup }, query, requestHeaders] = await Promise.all([
      getAdminAccessSettings(),
      getSiteSettings(),
      searchParams,
      headers(),
    ]);
    // Only the proxy may assert the private entry (it strips client copies of the header).
    const privateEntry = panelPath !== "/panel" && requestHeaders.get("x-admin-gateway") === panelPath;

    // Settings → General → Accounts: with sign-ups off, the sign-up page sends
    // people to sign-in, and the sign-in page drops its create-account link.
    if (page === "sign-up" && !allowSignup) redirect(`${privateEntry ? panelPath : "/auth"}/sign-in`);

    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

    return (
      <AuthScreen
        page={page}
        content={AUTH_CONTENT[page]}
        authRoot={privateEntry ? panelPath : "/auth"}
        authTarget={privateEntry || panelPath === "/panel" ? panelPath : "/"}
        showSwitch={!privateEntry && (allowSignup || page !== "sign-in")}
        query={{
          email: first(query.email),
          token: first(query.token),
          error: first(query.error),
          reset: first(query.reset),
        }}
      />
    );
  }

  return { generateMetadata, Page };
}
