import type { ReactNode } from "react";
import "./auth-refined.css";

/** Account styles are scoped to the auth shell, independent of the public site. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
