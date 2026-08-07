// Resolves a request's locale from its Accept-Language header — a pure
// function, not a global/thread-local like Rails' `I18n.locale`
// (Rails' own guide warns `I18n.locale =` leaks across pooled-thread
// requests unless every call site remembers to use the block-scoped
// `I18n.with_locale` instead). Hius doesn't need that discipline in the
// first place: nothing here is set anywhere — a pipe calls this and
// stashes the result on the request's own ctx via `req.withCtx({
// locale })`, the same explicit, per-request-object pattern every other
// piece of request state in Hius already uses.
//
// Falls back the same way Rails' `config.i18n.fallbacks` chain does —
// a specific tag (`ru-RU`) that isn't supported falls back to its base
// language (`ru`) before falling back to the app's default — so a
// client asking for a regional variant the app doesn't specifically
// support still gets the right language rather than the default one.
//
// This implements the common case (quality-ordered candidates, exact
// tag match, base-language fallback) — it does not implement RFC 4647
// extended filtering, script subtags, or wildcard-to-specific-locale
// preference, none of which a typical app's supported-locale list needs.

type LocaleCandidate = { tag: string; quality: number };

function parseAcceptLanguage(header: string): LocaleCandidate[] {
  return header
    .split(",")
    .map((part): LocaleCandidate => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: (tag ?? "").trim(), quality: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((candidate) => candidate.tag.length > 0)
    .sort((a, b) => b.quality - a.quality); // stable — ties keep the header's own listed order
}

export function resolveLocale(
  acceptLanguage: string | null,
  supportedLocales: readonly string[],
  defaultLocale: string,
): string {
  if (!acceptLanguage) return defaultLocale;

  const supportedByLowercase = new Map(
    supportedLocales.map((locale) => [locale.toLowerCase(), locale]),
  );

  for (const { tag } of parseAcceptLanguage(acceptLanguage)) {
    if (tag === "*") continue;

    const lower = tag.toLowerCase();
    const exact = supportedByLowercase.get(lower);
    if (exact) return exact;

    const base = lower.split("-")[0] ?? lower;
    const baseMatch = supportedByLowercase.get(base);
    if (baseMatch) return baseMatch;
  }

  return defaultLocale;
}
