"use client";

export default function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    // Full reload on purpose: a client-side push would keep cached panel state around.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }
  return <button className="workspace-signout" type="button" onClick={signOut}>Sign out <span aria-hidden="true">↗</span></button>;
}
