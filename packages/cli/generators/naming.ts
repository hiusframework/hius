// Shared name-casing for generators: a user types "chargeCustomer" or
// "charge-customer" or "ChargeCustomer" and expects the same file whatever
// form they used — filenames are kebab-case, identifiers are camelCase or
// PascalCase depending on what they name.

function toWords(input: string): string[] {
  return (
    input
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

export function toKebabCase(input: string): string {
  return toWords(input).join("-");
}

export function toCamelCase(input: string): string {
  const [first, ...rest] = toWords(input);
  if (!first) return "";
  return first + rest.map((w) => w[0]?.toUpperCase() + w.slice(1)).join("");
}

export function toPascalCase(input: string): string {
  const camel = toCamelCase(input);
  return camel ? camel[0]?.toUpperCase() + camel.slice(1) : "";
}
