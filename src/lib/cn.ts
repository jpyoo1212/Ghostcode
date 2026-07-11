/**
 * Tiny className joiner so we don't need to pull in a dependency just for
 * conditional Tailwind classes.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
