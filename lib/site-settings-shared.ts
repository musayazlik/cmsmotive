/**
 * Client-safe contract for the site identity used in search results and link
 * previews: Open Graph, X cards and the Organization JSON-LD. Page copy and
 * the top bar links come from the static site and are not affected.
 */

export type SiteSettings = {
  siteName: string;
  /** X account with the leading @, or "" for none. */
  twitterHandle: string;
  /** Public contact address in the Organization JSON-LD, or "" for none. */
  contactEmail: string;
  /** Profile URLs listed as the organization's `sameAs`. */
  socialProfiles: string[];
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "CMSMotive",
  twitterHandle: "@cmsmotive",
  contactEmail: "hello@cmsmotive.de",
  socialProfiles: [
    "https://www.linkedin.com/company/cmsmotive",
    "https://github.com/cmsmotive",
    "https://x.com/cmsmotive",
    "https://www.youtube.com/@cmsmotive",
  ],
};

export const SITE_LIMITS = { siteName: 60, profiles: 8, profileUrl: 300 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/;

export function validateSiteSettings(input: Record<string, unknown>): { error: string } | { data: SiteSettings } {
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

  const siteName = text("siteName");
  if (!siteName || siteName.length > SITE_LIMITS.siteName) {
    return { error: `The site name must be 1–${SITE_LIMITS.siteName} characters.` };
  }

  const handle = text("twitterHandle");
  const handleMatch = handle ? HANDLE.exec(handle) : null;
  if (handle && !handleMatch) return { error: "The X handle may only use letters, digits and _ (up to 15)." };

  const contactEmail = text("contactEmail").toLowerCase();
  if (contactEmail && (!EMAIL.test(contactEmail) || contactEmail.length > 254)) {
    return { error: "Enter a valid contact e-mail address or leave it empty." };
  }

  const rawProfiles = Array.isArray(input.socialProfiles) ? input.socialProfiles : [];
  const socialProfiles = [
    ...new Set(rawProfiles.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)),
  ];
  if (socialProfiles.length > SITE_LIMITS.profiles) {
    return { error: `Add at most ${SITE_LIMITS.profiles} social profiles.` };
  }
  for (const profile of socialProfiles) {
    let url: URL | null = null;
    try {
      url = new URL(profile);
    } catch {
      url = null;
    }
    if (!url || url.protocol !== "https:" || profile.length > SITE_LIMITS.profileUrl) {
      return { error: `"${profile.slice(0, 60)}" is not a valid https:// profile URL.` };
    }
  }

  return {
    data: {
      siteName,
      twitterHandle: handleMatch ? `@${handleMatch[1]}` : "",
      contactEmail,
      socialProfiles,
    },
  };
}
