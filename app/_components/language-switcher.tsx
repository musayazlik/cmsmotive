"use client";

import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { languageHref } from "@/lib/i18n/language-navigation";
import styles from "./language-switcher.module.css";

type Props = {
  locale: Locale;
  /** The current public path, or the full account/auth path (including private auth entries). */
  path: string;
  routing?: "query" | "path";
  tone?: "light" | "dark";
};

/** Shared language navigation for account, authentication and public page headers. */
export default function LanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={<LanguageMenu {...props} search="" />}>
      <CurrentLanguageMenu {...props} />
    </Suspense>
  );
}

function CurrentLanguageMenu(props: Props) {
  const search = useSearchParams();
  return <LanguageMenu {...props} search={search.toString()} />;
}

function LanguageMenu({
  locale,
  path,
  routing = "query",
  tone = "light",
  search,
}: Props & { search: string }) {
  const label = { de: "Sprache", en: "Language", tr: "Dil" }[locale];
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(LOCALES.indexOf(locale));

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open) links.current[active]?.focus();
  }, [open, active]);

  function show(index = LOCALES.indexOf(locale)) {
    setActive(index);
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open)
        show(
          event.key === "ArrowUp"
            ? LOCALES.length - 1
            : LOCALES.indexOf(locale),
        );
      else
        setActive(
          (active + (event.key === "ArrowDown" ? 1 : -1) + LOCALES.length) %
            LOCALES.length,
        );
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : LOCALES.length - 1);
    }
  }

  return (
    <nav
      className={styles.root}
      data-tone={tone}
      aria-label={label}
      ref={root}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        className={styles.trigger}
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: ${LOCALE_LABELS[locale]}`}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <svg className={styles.globe} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z" />
        </svg>
        <span>{locale.toUpperCase()}</span>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul className={styles.menu} id={id}>
          {LOCALES.map((code, index) => (
            <li key={code}>
              <a
                ref={(node) => {
                  links.current[index] = node;
                }}
                href={languageHref(path, search, code, routing)}
                hrefLang={code}
                lang={code}
                aria-current={code === locale ? "true" : undefined}
                onFocus={() => setActive(index)}
                onClick={(event) => {
                  event.currentTarget.hash = window.location.hash;
                  setOpen(false);
                }}
              >
                <span className={styles.code}>{code.toUpperCase()}</span>
                <span>{LOCALE_LABELS[code]}</span>
                {code === locale && (
                  <svg
                    className={styles.check}
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
