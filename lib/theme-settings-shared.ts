import { z } from "zod";

/**
 * Store appearance and theme settings contract (plan 5.5, Faz 2).
 * Maps store-level theme tokens to site.css custom properties.
 */
export type ThemeSettings = {
  primaryColor: string;
  canvasColor: string;
  surfaceColor: string;
  inkColor: string;
  radius: string;
  fontSans: string;
  fontMono: string;
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: "#4353e8",
  canvasColor: "#f7f8f5",
  surfaceColor: "#ffffff",
  inkColor: "#101418",
  radius: "14px",
  fontSans: "Manrope",
  fontMono: "DM Mono",
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RADIUS_REGEX = /^\d{1,3}(?:px|rem)$/;

export const themeSettingsSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR_REGEX, "Primary color must be a valid HEX color code (e.g. #4353e8)."),
  canvasColor: z.string().regex(HEX_COLOR_REGEX, "Canvas color must be a valid HEX color code (e.g. #f7f8f5)."),
  surfaceColor: z.string().regex(HEX_COLOR_REGEX, "Surface color must be a valid HEX color code (e.g. #ffffff)."),
  inkColor: z.string().regex(HEX_COLOR_REGEX, "Text color must be a valid HEX color code (e.g. #101418)."),
  radius: z.string().regex(RADIUS_REGEX, "Corner radius must be specified in px or rem (e.g. 14px or 1rem)."),
  fontSans: z.string().min(1).max(50),
  fontMono: z.string().min(1).max(50),
});

export function validateThemeSettings(input: unknown): { error?: string; data?: ThemeSettings } {
  const result = themeSettingsSchema.safeParse(input);
  if (!result.success) {
    return { error: result.error.issues[0]?.message || "Invalid theme settings." };
  }
  return { data: result.data };
}
