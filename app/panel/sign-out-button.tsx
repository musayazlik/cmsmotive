"use client";

import { useSignOut } from "@/app/_components/use-sign-out";

export default function SignOutButton() {
  const { signOut, pending } = useSignOut();
  return <button className="workspace-signout" type="button" onClick={signOut} disabled={pending} aria-busy={pending}>{pending ? "Signing out…" : "Sign out"} <span aria-hidden="true">↗</span></button>;
}
