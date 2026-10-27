import type { StoreSeed } from "../types";
import { seedCatalog } from "./catalog";

/** cmsmotive.de: TYPO3 themes and extensions for German-speaking markets. */
const LEGAL_ENTITY = {
  legalName: "Musa Yazlık",
  address: "Esentepe Mah. Ecza Sk. Pol Center C Blok No: 4/6, Şişli / İstanbul",
  country: "Türkiye",
  supervisoryAuthority: "Kişisel Verileri Koruma Kurumu — https://www.kvkk.gov.tr",
};

export const typo3Store: StoreSeed = {
  store: { key: "typo3", name: "CMSMotive TYPO3", defaultLocale: "de", locales: ["de", "en", "tr"], isDefault: true },
  domains: ["cmsmotive.de", "www.cmsmotive.de"],
  settings: {
    site: {
      siteName: "CMSMotive",
      twitterHandle: "@cmsmotive",
      contactEmail: "info@cmsmotive.de",
      socialProfiles: [
        "https://www.linkedin.com/company/cmsmotive",
        "https://github.com/cmsmotive",
        "https://x.com/cmsmotive",
        "https://www.youtube.com/@cmsmotive",
      ],
    },
    email: { senderName: "CMSMotive", contactRecipient: "info@cmsmotive.de" },
    // The TYPO3 Association's trademark policy: product names never contain "TYPO3".
    legal: { ...LEGAL_ENTITY, contactEmail: "info@cmsmotive.de", privacyEmail: "info@cmsmotive.de", reservedNameTerms: "TYPO3", gplCodeRequired: true },
  },
  content: seedCatalog,
};
