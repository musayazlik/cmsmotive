"use client";

import { useEffect } from "react";
import { initAccountFeedback } from "@/public/assets/js/account-feedback.js";

/** Also initialized by site.js for public pages served as complete HTML documents. */
export default function AccountFeedback() {
  useEffect(() => { initAccountFeedback(); }, []);
  return null;
}
