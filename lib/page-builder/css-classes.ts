/** Small class-name joiner shared by block renders (keeps JSX lean). */
export function cssClass(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(" ");
}
