import type { ReactNode } from "react";

/**
 * Minimal stroke icon set for the blog editor toolbar, matching the panel's
 * 1.7px stroke style (see .wtopbar-icon svg in panel.css).
 */
function Icon({ children, viewBox = "0 0 24 24" }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function IconBold() {
  return (
    <Icon>
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
    </Icon>
  );
}

export function IconItalic() {
  return (
    <Icon>
      <path d="M19 4h-9M14 20H5M15 4L9 20" />
    </Icon>
  );
}

export function IconUnderline() {
  return (
    <Icon>
      <path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16" />
    </Icon>
  );
}

export function IconStrike() {
  return (
    <Icon>
      <path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16" />
    </Icon>
  );
}

export function IconBulletList() {
  return (
    <Icon>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Icon>
  );
}

export function IconOrderedList() {
  return (
    <Icon>
      <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </Icon>
  );
}

export function IconQuote() {
  return (
    <Icon>
      <path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v7a3 3 0 0 1-3 3M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v7a3 3 0 0 1-3 3" />
    </Icon>
  );
}

export function IconCode() {
  return (
    <Icon>
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </Icon>
  );
}

export function IconLink() {
  return (
    <Icon>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function IconUnlink() {
  return (
    <Icon>
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8M3 3l18 18" />
    </Icon>
  );
}

export function IconImage() {
  return (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </Icon>
  );
}

export function IconVideo() {
  return (
    <Icon>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 12l6-3.5v7L16 12z" />
    </Icon>
  );
}

export function IconYoutube() {
  return (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l5 3-5 3V9z" />
    </Icon>
  );
}

export function IconUndo() {
  return (
    <Icon>
      <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  );
}

export function IconRedo() {
  return (
    <Icon>
      <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </Icon>
  );
}
