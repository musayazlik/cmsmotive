"use client";

import { Icon } from "@iconify/react";
import { useSignOut } from "@/app/_components/use-sign-out";
import { PANEL_ICONS } from "./_components/panel-icons";

export default function SignOutButton() {
  const { signOut, pending } = useSignOut();
  return (
    <button
      className="workspace-signout"
      type="button"
      onClick={signOut}
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "Signing out" : "Sign out"}
      title="Sign out"
    >
      <Icon icon={PANEL_ICONS.signOut} aria-hidden="true" />
      <span className="visually-hidden">{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
