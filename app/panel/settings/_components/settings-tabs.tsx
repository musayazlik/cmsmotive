import Link from "next/link";
import { SETTINGS_TABS, type SettingsTabId } from "../_tabs";

/** Section switcher; each tab is a link so sections can be bookmarked and shared. */
export default function SettingsTabs({ active }: { active: SettingsTabId }) {
  return (
    <nav className="wtabs" aria-label="Settings sections">
      {SETTINGS_TABS.map((tab, index) => (
        <Link
          key={tab.id}
          href={index === 0 ? "/panel/settings" : `/panel/settings?tab=${tab.id}`}
          className={`wtab${tab.id === active ? " is-active" : ""}`}
          aria-current={tab.id === active ? "page" : undefined}
          scroll={false}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
