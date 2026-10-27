import { DEFAULT_THEME_SETTINGS, type ThemeSettings } from "../theme-settings-shared";

/**
 * Compiles store theme settings into CSS custom property declarations for :root
 * (plan 5.5, Faz 2). Injected as an inline <style id="pb-theme"> on public builder
 * pages and editor canvas.
 */
export function themeToCssVariables(theme: Partial<ThemeSettings>): string {
  const merged: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, ...theme };
  // Second line of defense for rows stored before FONT_NAME_REGEX existed.
  const safeFont = (name: string) => name.replace(/[^A-Za-z0-9 _.-]/g, "").trim() || "sans-serif";
  const vars = [
    `--indigo:${merged.primaryColor}`,
    `--indigo-solid:${merged.primaryColor}`,
    `--canvas:${merged.canvasColor}`,
    `--surface:${merged.surfaceColor}`,
    `--raised:${merged.surfaceColor}`,
    `--ink:${merged.inkColor}`,
    `--radius:${merged.radius}`,
    `--font-sans:'${safeFont(merged.fontSans)}',sans-serif`,
    `--font-mono:'${safeFont(merged.fontMono)}',monospace`,
  ];
  return `:root{${vars.join(";")}}`;
}
