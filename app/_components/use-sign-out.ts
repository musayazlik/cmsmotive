"use client";

import { useState } from "react";
import { showAccountToast, signOutAccount } from "@/public/assets/js/account-feedback.js";

export function useSignOut() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await signOutAccount();
    } catch (error) {
      showAccountToast(error instanceof Error ? error.message : "You could not be signed out. Please try again.");
      setPending(false);
    }
  }

  return { signOut, pending };
}
