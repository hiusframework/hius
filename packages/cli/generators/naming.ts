// Shared name-casing for generators: a user types "chargeCustomer" or
// "charge-customer" or "ChargeCustomer" and expects the same file whatever
// form they used — filenames are kebab-case, identifiers are camelCase or
// PascalCase depending on what they name.

function toWords(input: string): string[] {
  return (
    input
      // A run of 2+ capitals immediately followed by a capital+lowercase
      // pair is an acronym running into the next word ("HRPortal",
      // "sendHREmail") — split before that trailing capital, or the
      // whole run collapses into one unsplittable blob ("hrportal")
      // instead of just losing its casing. Has to run before the plain
      // lower-to-upper split below, or it never sees the run intact.
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      // Event names conventionally use "." as a namespace separator
      // (invoice.paid, user.created) — it needs to split words exactly like
      // "-"/"_" do, or e.g. toCamelCase("on-invoice.paid") comes out as
      // "onInvoice.paid" instead of "onInvoicePaid".
      .split(/[\s_.-]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase())
  );
}

// A word's canonical casing, keyed lowercase — e.g. "api" -> "API",
// "graphql" -> "GraphQL". Hius ships no defaults here, the same
// reasoning as resolveLocale shipping no translation catalog: which
// words are acronyms/initialisms is a project decision, not a guess the
// framework should make on your behalf. Lookup is case-insensitive and
// exact-match — not restricted to all-caps input, since "GraphQL" isn't
// a pure acronym either.
export type Acronyms = ReadonlyMap<string, string>;

const NO_ACRONYMS: Acronyms = new Map();

export function createAcronyms(words: readonly string[]): Acronyms {
  return new Map(words.map((word) => [word.toLowerCase(), word]));
}

function capitalizeWord(word: string, acronyms: Acronyms): string {
  const override = acronyms.get(word);
  if (override) return override;
  return (word[0]?.toUpperCase() ?? "") + word.slice(1);
}

export function toKebabCase(input: string): string {
  return toWords(input).join("-");
}

// The leading word is always plain-lowercased, acronym or not — a
// camelCase identifier that starts with a run of capitals reads as a
// constant, not a variable/function name. Only words after the first
// take the acronym's registered casing.
export function toCamelCase(input: string, acronyms: Acronyms = NO_ACRONYMS): string {
  const [first, ...rest] = toWords(input);
  if (!first) return "";
  return first + rest.map((w) => capitalizeWord(w, acronyms)).join("");
}

export function toPascalCase(input: string, acronyms: Acronyms = NO_ACRONYMS): string {
  return toWords(input)
    .map((w) => capitalizeWord(w, acronyms))
    .join("");
}
