import type { StoreSeed } from "../types";
import { seedHomepage } from "../homepage";

/** cmsmotive.com: CMS systems, starter kits, themes and modules for other stacks, English only. */
const LEGAL_ENTITY = {
  legalName: "Musa Yazlık",
  address: "Esentepe Mah. Ecza Sk. Pol Center C Blok No: 4/6, Şişli / İstanbul",
  country: "Türkiye",
  supervisoryAuthority: "Kişisel Verileri Koruma Kurumu — https://www.kvkk.gov.tr",
};

export const globalStore: StoreSeed = {
  store: { key: "global", name: "CMSMotive Global", defaultLocale: "en", locales: ["en"], isDefault: false },
  domains: ["cmsmotive.com", "www.cmsmotive.com"],
  settings: {
    site: {
      siteName: "CMSMotive",
      twitterHandle: "@cmsmotive",
      contactEmail: "info@cmsmotive.com",
      socialProfiles: [
        "https://www.linkedin.com/company/cmsmotive",
        "https://github.com/cmsmotive",
        "https://x.com/cmsmotive",
        "https://www.youtube.com/@cmsmotive",
      ],
    },
    seo: {
      homeTitle: "Production-ready CMS systems, starter kits and themes",
      homeDescription:
        "CMSMotive builds documented, source-delivered CMS systems, SaaS starter kits, themes and modules for Next.js, Nuxt, Vue, Laravel and ASP.NET Core.",
    },
    email: { senderName: "CMSMotive", contactRecipient: "info@cmsmotive.com" },
    legal: { ...LEGAL_ENTITY, contactEmail: "info@cmsmotive.com", privacyEmail: "info@cmsmotive.com" },
    ai: { language: "en" },
  },
  content: (storeId) => seedHomepage(storeId),
};
