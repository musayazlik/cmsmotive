import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getSiteSettings } from "@/lib/settings";
import { AUTH_CONTENT, type AuthPageName } from "./auth-content";
import AuthScreen from "./auth-screen";
import { isLocale } from "@/lib/i18n/config";
import { authText } from "@/lib/auth-copy";
import { getLegalSettings } from "@/lib/legal";
import { accountRegistrationReady, googleAuthConfigured, localRegistrationPreview } from "@/lib/account-registration";
import { safePurchaseReturn } from "@/lib/purchase-flow";

type AuthSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Shared page factory for the account pages: settings and the private admin
 * entry (proxy.ts rewrites <panelPath>/login to /auth/sign-in) resolve per
 * request, then the page renders from the AUTH_CONTENT copy.
 */
export function authRoute(page: AuthPageName) {
  /** Same titles and descriptions the static previews ship. */
  async function generateMetadata({ searchParams }: { searchParams: AuthSearchParams }): Promise<Metadata> {
    const content = AUTH_CONTENT[page];
    const lang=(await searchParams).lang;
    const locale=isLocale(typeof lang==="string"?lang:undefined)?lang as "de"|"en"|"tr":"de";
    return {
      title: `${authText(locale,content.documentTitle)} — CMSMotive`,
      description: authText(locale,content.description),
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
    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    const next = privateEntry ? null : safePurchaseReturn(first(query.next));

    // Settings → General → Accounts: with sign-ups off, the sign-up page sends
    // people to sign-in, and the sign-in page drops its create-account link.
    if (page === "sign-up" && !allowSignup) redirect(`${privateEntry ? panelPath : "/auth"}/sign-in?${new URLSearchParams({lang:first(query.lang) ?? "de",...(next?{next}:{})})}`);

    const lang=first(query.lang);
    const locale=isLocale(lang)?lang:"de";
    const legal=await getLegalSettings();
    const source=AUTH_CONTENT[page];
    const content={...source, ...Object.fromEntries(Object.entries(source).filter(([,v])=>typeof v==="string").map(([key,v])=>[key,authText(locale,String(v))])),fields:source.fields.map(f=>({...f,label:authText(locale,f.label),placeholder:authText(locale,f.placeholder),hint:f.hint?authText(locale,f.hint):undefined}))};

    return (
      <AuthScreen
        page={page}
        content={content}
        locale={locale}
        termsVersion={legal.termsVersion}
        signupReady={accountRegistrationReady(legal)}
        googleReady={googleAuthConfigured()}
        localPreview={localRegistrationPreview()}
        authRoot={privateEntry ? panelPath : "/auth"}
        authTarget={privateEntry ? panelPath : next ?? `/account?lang=${locale}`}
        showSwitch={!privateEntry && (page==="verify-email"?allowSignup:(allowSignup || page !== "sign-in"))}
        query={{
          email: first(query.email),
          token: first(query.token),
          error: first(query.error),
          reset: first(query.reset),
          next: next ?? undefined,
        }}
      />
    );
  }

  return { generateMetadata, Page };
}
