import type { ReactNode } from "react";
import { requirePanelUser } from "@/lib/panel-auth";
import PanelShell from "./_components/panel-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  return <PanelShell user={user}>{children}</PanelShell>;
}
