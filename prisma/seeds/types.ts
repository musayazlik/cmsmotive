import type { Locale } from "@/lib/i18n/config";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Everything one store starts with. Each store folder under prisma/seeds
 * exports one of these; prisma/seeds/index.ts applies them.
 */
export type StoreSeed = {
  store: {
    /** Stable handle; also the local preview host `<key>.localhost`. */
    key: string;
    name: string;
    defaultLocale: Locale;
    locales: Locale[];
    /** Serves hosts no domain matches. Exactly one seed sets it. */
    isDefault: boolean;
  };
  /** Hostnames, canonical first. */
  domains: string[];
  /**
   * Initial panel settings by group (`site`, `seo`, `email`, `legal`, …),
   * written only where the store has no value yet, so panel edits survive a
   * re-run. Fields left out use the defaults in lib/*-settings-shared.ts.
   */
  settings: Record<string, Record<string, Json>>;
  /** Catalogue and other content; must only add what is missing. */
  content?: (storeId: string) => Promise<void>;
};
