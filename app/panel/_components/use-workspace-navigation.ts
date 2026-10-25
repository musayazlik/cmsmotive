"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "cmsmotive:sidebar-collapsed";
const CHANGE_EVENT = "cmsmotive:sidebar-change";
function subscribeCollapse(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 1024px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const readMobile = () => window.matchMedia("(max-width: 1024px)").matches;
const serverSnapshot = () => false;

export function useWorkspaceNavigation() {
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    readCollapsed,
    serverSnapshot,
  );
  const mobile = useSyncExternalStore(
    subscribeMobile,
    readMobile,
    serverSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const setCollapsed = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* Preference persistence is optional. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);
  const expand = useCallback(() => setCollapsed(false), [setCollapsed]);
  const toggle = () => {
    if (mobile) setMobileOpen((value) => !value);
    else setCollapsed(!collapsed);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>("[data-sidebar-close]")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter(
        (item) => item.getClientRects().length && !item.closest("[inert]"),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (!readMobile()) closeMobile();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileOpen, closeMobile]);
  return {
    collapsed: collapsed && !mobile,
    mobile,
    mobileOpen,
    sidebarRef,
    triggerRef,
    toggle,
    expand,
    closeMobile,
  };
}
