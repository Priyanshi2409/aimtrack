/** Canonical form used to compare URLs (drops tracking params, www, hash, trailing slash). */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(k)) url.searchParams.delete(k);
    const s = url.toString().replace(/\/$/, "");
    return s.replace(/^http:\/\//, "https://").replace("://www.", "://").toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

/** Keep only items whose source URL was really returned by the search tool. */
export function verifySources<T extends { source_url: string }>(items: T[], allowed: string[]): { kept: T[]; dropped: T[] } {
  const set = new Set(allowed.map(normalizeUrl));
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const it of items) (set.has(normalizeUrl(it.source_url)) ? kept : dropped).push(it);
  return { kept, dropped };
}

/** A search link is always honest: it never pretends a specific page exists. */
export function searchLink(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
