"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react";
import { DEFAULT_ADMIN_ACCESS_SETTINGS, internalPanelPath, panelHref } from "@/lib/admin-access-shared";

const PanelPathContext = createContext(DEFAULT_ADMIN_ACCESS_SETTINGS.panelPath);

/** Keep panel components independent of the public URL chosen in settings. */
export function PanelNavigationProvider({ basePath, children }: { basePath: string; children: ReactNode }) {
  return <PanelPathContext.Provider value={basePath}>{children}</PanelPathContext.Provider>;
}

type LinkProps = ComponentProps<typeof NextLink>;

function publicHref(href: LinkProps["href"], basePath: string): LinkProps["href"] {
  if (typeof href === "string") return panelHref(href, basePath);
  return typeof href.pathname === "string" ? { ...href, pathname: panelHref(href.pathname, basePath) } : href;
}

export default function Link({ href, as, ...props }: LinkProps) {
  const basePath = useContext(PanelPathContext);
  return <NextLink {...props} href={publicHref(href, basePath)} as={as === undefined ? undefined : publicHref(as, basePath)} />;
}

/** Active navigation and breadcrumbs use the stable internal route names. */
export function usePathname() {
  const basePath = useContext(PanelPathContext);
  return internalPanelPath(useNextPathname(), basePath);
}

export function useRouter() {
  const router = useNextRouter();
  const basePath = useContext(PanelPathContext);
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(panelHref(href, basePath), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(panelHref(href, basePath), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(panelHref(href, basePath), options),
    }),
    [router, basePath],
  );
}
