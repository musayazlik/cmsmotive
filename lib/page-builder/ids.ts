/**
 * Block id shape shared by the CSS scope compiler, the save validator and the
 * editor. Ids must survive as an HTML attribute value and a CSS selector, so
 * keep them to HTML-safe word characters (Puck generates cuid-like ids; the
 * demo doc uses readable ones).
 */
export const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
