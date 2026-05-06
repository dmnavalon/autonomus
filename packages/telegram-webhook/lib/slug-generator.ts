/**
 * Generates a URL-safe slug from a human name.
 *
 * Rules:
 *  - lowercase
 *  - kebab-case (spaces and runs of non-alphanumerics → single dash)
 *  - strip diacritics (NFD)
 *  - leading char must be a letter (prepends "p-" if it would start with digit/dash)
 *  - max 30 chars
 *  - if it collides with `existingSlugs`, append `-2`, `-3`, … until unique
 *
 * The slug pattern matches `registry/apps.schema.json#/properties/slug`.
 */
const MAX_LEN = 30;

export function nameToSlug(name: string, existingSlugs: ReadonlySet<string> = new Set()): string {
  const base = baseSlug(name);
  if (!existingSlugs.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = truncateAndSuffix(base, `-${i}`);
    if (!existingSlugs.has(candidate)) return candidate;
  }
  // Practically unreachable — fall back to a timestamped suffix
  return truncateAndSuffix(base, `-${Date.now().toString(36)}`);
}

function baseSlug(name: string): string {
  let s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) s = 'proyecto';
  if (!/^[a-z]/.test(s)) s = `p-${s}`;
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN).replace(/-+$/g, '');
  return s;
}

function truncateAndSuffix(base: string, suffix: string): string {
  if (base.length + suffix.length <= MAX_LEN) return base + suffix;
  return base.slice(0, MAX_LEN - suffix.length).replace(/-+$/g, '') + suffix;
}
