"use client";

export default function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    window.location.assign("/");
  }
  return <button className="workspace-signout" type="button" onClick={signOut}>Sign out <span aria-hidden="true">↗</span></button>;
}
