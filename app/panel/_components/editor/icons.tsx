import type { ReactNode } from "react";

/**
 * Minimal stroke icon set for the panel's rich text editors (blog posts and
 * catalogue descriptions), matching the panel's 1.7px stroke style (see
 * .wtopbar-icon svg in panel.css).
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

export function IconInlineCode() {
  return (
    <Icon>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </Icon>
  );
}

export function IconSubscript() {
  return (
    <Icon>
      <path d="M4 5l8 10M12 5l-8 10M16 15.5a2 2 0 0 1 4 0c0 1.5-4 2.5-4 4.5h4" />
    </Icon>
  );
}

export function IconSuperscript() {
  return (
    <Icon>
      <path d="M4 9l8 10M12 9l-8 10M16 5.5a2 2 0 0 1 4 0c0 1.5-4 2.5-4 4.5h4" />
    </Icon>
  );
}

/** `swatch` paints the underline in the colour currently applied to the selection. */
export function IconTextColor({ swatch }: { swatch?: string }) {
  return (
    <Icon>
      <path d="M7 15l5-11 5 11M8.8 11h6.4" />
      <path d="M4 20h16" strokeWidth="3" stroke={swatch ?? "currentColor"} />
    </Icon>
  );
}

export function IconHighlight({ swatch }: { swatch?: string }) {
  return (
    <Icon>
      <path d="M15 4l5 5-8.5 8.5H6.5v-5L15 4z" />
      <path d="M4 20h16" strokeWidth="3" stroke={swatch ?? "currentColor"} />
    </Icon>
  );
}

export function IconAlignLeft() {
  return (
    <Icon>
      <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
    </Icon>
  );
}

export function IconAlignCenter() {
  return (
    <Icon>
      <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
    </Icon>
  );
}

export function IconAlignRight() {
  return (
    <Icon>
      <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
    </Icon>
  );
}

export function IconAlignJustify() {
  return (
    <Icon>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </Icon>
  );
}

export function IconTaskList() {
  return (
    <Icon>
      <rect x="3" y="4" width="6" height="6" rx="1.5" />
      <path d="M4.5 7l1.2 1.2L7.8 6M13 7h8M3 15.5h6M13 16h8" />
    </Icon>
  );
}

export function IconIndent() {
  return (
    <Icon>
      <path d="M4 6h16M11 10h9M11 14h9M4 18h16M4 9.5l3 2.5-3 2.5" />
    </Icon>
  );
}

export function IconOutdent() {
  return (
    <Icon>
      <path d="M4 6h16M11 10h9M11 14h9M4 18h16M7 9.5L4 12l3 2.5" />
    </Icon>
  );
}

export function IconDivider() {
  return (
    <Icon>
      <path d="M3 12h18M7 7h10M7 17h10" strokeOpacity=".45" />
      <path d="M3 12h18" />
    </Icon>
  );
}

export function IconTable() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 15h18M9 4v16M15 4v16" />
    </Icon>
  );
}

export function IconClearFormat() {
  return (
    <Icon>
      <path d="M6 5h12M12 5l-3 14M4 20l16-16" />
    </Icon>
  );
}

export function IconSource() {
  return (
    <Icon>
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
    </Icon>
  );
}

export function IconExpand() {
  return (
    <Icon>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </Icon>
  );
}

export function IconCollapse() {
  return (
    <Icon>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </Icon>
  );
}

export function IconUpload() {
  return (
    <Icon>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </Icon>
  );
}
