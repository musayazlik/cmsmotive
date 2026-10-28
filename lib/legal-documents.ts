import { cache } from "react";
import { readSettingsGroup, writeSettingsGroup } from "./settings-store";
import { DEFAULT_LEGAL_DOCUMENTS, type LegalDocumentSettings } from "./legal-documents-shared";

export const getLegalDocumentSettings = cache((storeId: string) =>
  readSettingsGroup(storeId, "legalPages", DEFAULT_LEGAL_DOCUMENTS),
);
export const saveLegalDocuments = (storeId: string, data: LegalDocumentSettings) =>
  writeSettingsGroup(storeId, "legalPages", data);

