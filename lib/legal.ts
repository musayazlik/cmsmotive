import { cache } from "react";
import { readSettingsGroup, writeSettingsGroup } from "./settings-store";
import {
  DEFAULT_LEGAL_SETTINGS,
  type LegalSettings,
} from "./legal-settings-shared";
export const getLegalSettings = cache(() =>
  readSettingsGroup("legal", DEFAULT_LEGAL_SETTINGS),
);
export const saveLegalSettings = (data: LegalSettings) =>
  writeSettingsGroup("legal", data);
