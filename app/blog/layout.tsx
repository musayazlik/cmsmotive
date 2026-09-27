import type { ReactNode } from "react";
import "../../public/assets/css/site.css";

/** Keep the public site stylesheet on both the journal and article routes. */
export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
