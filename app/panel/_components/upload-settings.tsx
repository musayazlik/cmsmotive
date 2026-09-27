"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_UPLOAD_SETTINGS, type UploadSettings } from "@/lib/upload-settings-shared";

const UploadSettingsContext = createContext<UploadSettings>(DEFAULT_UPLOAD_SETTINGS);

/**
 * Image-optimization settings loaded once in the panel layout and shared
 * with every client component that uploads files, so new upload surfaces
 * pick the conversion up without prop threading.
 */
export function UploadSettingsProvider({ value, children }: { value: UploadSettings; children: ReactNode }) {
  return <UploadSettingsContext.Provider value={value}>{children}</UploadSettingsContext.Provider>;
}

export function useUploadSettings(): UploadSettings {
  return useContext(UploadSettingsContext);
}
