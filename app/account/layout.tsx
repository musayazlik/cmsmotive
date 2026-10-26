import { headers } from "next/headers";
import type { ReactNode } from "react";
import { currentStoreId } from "@/lib/current-store";
import { requireCustomer } from "@/lib/customer-auth";
import { loadNotifications, unreadNotificationCount } from "@/lib/notifications";
import { presentNotifications } from "@/lib/notification-text";
import { LOCALE_HEADER, isLocale } from "@/lib/i18n/config";
import CustomerShell from "./customer-shell";
import "../panel.css";
import "../panel/workspace-shell.css";
import "./customer-workspace.css";
import "./customer-tables.css";
export const dynamic = "force-dynamic";
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireCustomer();
  const lang = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(lang) ? lang : "de";
  const year = new Date().getFullYear();
  const storeId = await currentStoreId();
  const [unread, latest] = await Promise.all([unreadNotificationCount(user.id, storeId), loadNotifications(user.id, storeId, 6)]);
  return (
    <>
      <link
        rel="stylesheet"
        href="/assets/css/fonts.css"
        precedence="default"
      />
      <CustomerShell
        user={{ name: user.name, email: user.email, image: user.image }}
        locale={locale}
        notifications={{ unread, items: presentNotifications(latest, locale) }}
        year={year}
      >
        {children}
      </CustomerShell>
    </>
  );
}
