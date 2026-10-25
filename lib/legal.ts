import { cache } from "react";
import { readSettingsGroup, writeSettingsGroup } from "./settings-store";
import {
  DEFAULT_LEGAL_SETTINGS,
  type LegalSettings,
} from "./legal-settings-shared";
export const getLegalSettings = cache((storeId: string) =>
  readSettingsGroup(storeId, "legal", DEFAULT_LEGAL_SETTINGS),
);
export const saveLegalSettings = (storeId: string, data: LegalSettings) =>
  writeSettingsGroup(storeId, "legal", data);
