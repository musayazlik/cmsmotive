import { headers } from "next/headers";
import type { ReactNode } from "react";
import { requireCustomer } from "@/lib/customer-auth";
import { LOCALE_HEADER, isLocale } from "@/lib/i18n/config";
import CustomerShell from "./customer-shell";
import "../panel.css";
export const dynamic = "force-dynamic";
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireCustomer();
  const lang = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(lang) ? lang : "de";
  return (
    <>
      <link
        rel="stylesheet"
        href="/assets/css/fonts.css"
        precedence="default"
      />
      <CustomerShell
        user={{ name: user.name, email: user.email }}
        locale={locale}
      >
        {children}
      </CustomerShell>
    </>
  );
}
