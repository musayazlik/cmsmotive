import { requireCustomer } from "@/lib/customer-auth";
import { loadCustomerDashboard } from "@/lib/customer-dashboard";
import { creemMode } from "@/lib/creem";
import { getRequestLocale } from "@/lib/i18n/request";
import { originOfStore } from "@/lib/current-store";
import DashboardView from "./dashboard-view";
import "./dashboard.css";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [user, locale, query] = await Promise.all([requireCustomer(), getRequestLocale(), searchParams]);
  const dashboard = await loadCustomerDashboard(user.id, creemMode());
  const storeIds = [...new Set([...dashboard.subscriptions, ...dashboard.payments].map((entry) => entry.storeId))];
  const billingLinks = Object.fromEntries(await Promise.all(storeIds.map(async (id) => [id, `${await originOfStore(id)}/account/billing?lang=${locale}`])));
  return <DashboardView user={user} locale={locale} dashboard={dashboard} billingLinks={billingLinks} checkoutPending={Boolean(query.checkout)} />;
}
