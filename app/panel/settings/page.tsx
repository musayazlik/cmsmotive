import { redirect } from "next/navigation";
import { SETTINGS_TABS } from "./_tabs";

/** The Settings section opens on its first page; the group has no own overview. */
export default function SettingsIndexPage() {
  redirect(`/panel/settings/${SETTINGS_TABS[0].id}`);
}
