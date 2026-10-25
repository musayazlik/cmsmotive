import { copy } from "./legal-copy";
import { localizePath, type Locale } from "./i18n/config";
export type PublicAccount = {
  name: string;
  email: string;
  image: string | null;
};
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function accountMenuHtml(
  user: PublicAccount,
  l: Locale,
  adminHref?: string,
) {
  const name = esc(user.name || user.email);
  const initials = esc(
    (user.name || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase(),
  );
  const image =
    user.image && /^https:\/\//.test(user.image)
      ? `<img src="${esc(user.image)}" alt="" width="36" height="36" referrerpolicy="no-referrer">`
      : `<span aria-hidden="true">${initials}</span>`;
  const links = [
    ["/account", copy(l, "My products", "Meine Produkte", "Ürünlerim")],
    [
      "/account/billing",
      copy(
        l,
        "Subscriptions & invoices",
        "Abos & Rechnungen",
        "Abonelikler ve faturalar",
      ),
    ],
    [
      "/account/profile",
      copy(l, "Account settings", "Kontoeinstellungen", "Hesap ayarları"),
    ],
  ];
  return `<details class="site-account-menu"><summary aria-label="${esc(copy(l, "Account menu for", "Kontomenü für", "Hesap menüsü:"))} ${name}"><span class="site-account-avatar">${image}</span><span class="site-account-label">${esc(copy(l, "My account", "Mein Konto", "Hesabım"))}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="site-account-dropdown"><div class="site-account-person"><strong>${name}</strong><span>${esc(user.email)}</span></div><nav aria-label="${esc(copy(l, "Account navigation", "Kontonavigation", "Hesap menüsü"))}">${links.map(([path, label]) => `<a href="${path}?lang=${l}">${esc(label)}</a>`).join("")}${adminHref ? `<a href="${esc(adminHref)}">${esc(copy(l, "Admin panel", "Adminbereich", "Yönetici paneli"))}</a>` : ""}</nav><button type="button" data-site-sign-out data-home="${localizePath("/", l)}" data-pending="${esc(copy(l, "Signing out…", "Abmeldung…", "Çıkış yapılıyor…"))}" data-error="${esc(copy(l, "Could not sign out. Please try again.", "Abmeldung fehlgeschlagen. Bitte erneut versuchen.", "Çıkış yapılamadı. Lütfen yeniden deneyin."))}">${esc(copy(l, "Sign out", "Abmelden", "Çıkış yap"))}</button><p data-sign-out-error role="alert" hidden></p></div></details>`;
}
export function injectAccountMenu(
  html: string,
  user: PublicAccount,
  l: Locale,
  adminHref?: string,
) {
  const menu = accountMenuHtml(user, l, adminHref);
  let out = html.replace(
    /(<div class="header-actions">)\s*<a\b[^>]*class="btn btn-primary"[^>]*>[\s\S]*?<\/a\s*>/,
    (_all, open) => open + menu,
  );
  // The avatar menu in the header covers the account on mobile too, so the
  // signed-in mobile navigation carries no account link of its own.
  out = out.replace(
    /(<nav\b[^>]*class="mobile-nav"[^>]*>)([\s\S]*?)(<\/nav\s*>)/,
    (_all, open, body, close) => open + body.replace(/<a\b[^>]*class="btn btn-primary"[^>]*>[\s\S]*?<\/a\s*>/, "") + close,
  );
  return out.replace(
    "</head>",
    '<link rel="stylesheet" href="/assets/css/site-account.css"></head>',
  );
}
