/** Auth callbacks may return only to product pages or the account checkout. */
export function safePurchaseReturn(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\%\r\n]/.test(value)
  )
    return null;
  const url = new URL(value, "https://purchase.invalid");
  if (
    !/^(?:\/(?:tr|en|de))?\/(?:theme|extension)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      url.pathname,
    ) &&
    url.pathname !== "/account/checkout"
  )
    return null;
  const query = new URLSearchParams();
  const plan = url.searchParams.get("plan");
  const lang = url.searchParams.get("lang");
  if (plan && /^[a-zA-Z0-9_-]{1,100}$/.test(plan)) query.set("plan", plan);
  if (lang && ["tr", "de", "en"].includes(lang)) query.set("lang", lang);
  return url.pathname + (query.size ? `?${query}` : "");
}
