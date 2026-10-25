import { redirect } from "next/navigation";

/** The Sales section opens on its orders list; the group has no own overview page. */
export default function SalesIndexPage() {
  redirect("/panel/sales/orders");
}
