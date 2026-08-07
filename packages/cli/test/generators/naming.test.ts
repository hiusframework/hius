import { describe, expect, test } from "bun:test";
import { createAcronyms, toCamelCase, toKebabCase, toPascalCase } from "@/generators/naming";

describe("toKebabCase", () => {
  test("converts camelCase", () => {
    expect(toKebabCase("chargeCustomer")).toBe("charge-customer");
  });

  test("converts PascalCase", () => {
    expect(toKebabCase("ChargeCustomer")).toBe("charge-customer");
  });

  test("passes through already-kebab input", () => {
    expect(toKebabCase("charge-customer")).toBe("charge-customer");
  });

  test("converts snake_case and spaces", () => {
    expect(toKebabCase("charge_customer")).toBe("charge-customer");
    expect(toKebabCase("charge customer")).toBe("charge-customer");
  });

  test("splits a run of consecutive capitals from the word that follows it", () => {
    // A naive lower-to-upper-only boundary regex merges this into one
    // unsplittable blob ("hrportal") instead of just losing the
    // acronym's casing — this is a word-boundary bug, not a casing one.
    expect(toKebabCase("HRPortal")).toBe("hr-portal");
    expect(toKebabCase("sendHREmail")).toBe("send-hr-email");
    expect(toKebabCase("GraphQLGateway")).toBe("graph-ql-gateway");
  });
});

describe("toCamelCase", () => {
  test("converts kebab-case", () => {
    expect(toCamelCase("charge-customer")).toBe("chargeCustomer");
  });

  test("converts PascalCase", () => {
    expect(toCamelCase("ChargeCustomer")).toBe("chargeCustomer");
  });

  test("without a registered acronym, an all-caps word degrades to a plain capitalized word", () => {
    expect(toCamelCase("hr-portal")).toBe("hrPortal");
    expect(toCamelCase("send-hr-email")).toBe("sendHrEmail");
  });

  test("a non-leading word matching a registered acronym keeps its exact casing", () => {
    const acronyms = createAcronyms(["API", "HR", "GraphQL"]);
    expect(toCamelCase("send-hr-email", acronyms)).toBe("sendHREmail");
    expect(toCamelCase("fetch-graphql-gateway", acronyms)).toBe("fetchGraphQLGateway");
  });

  test("the leading word is always plain-lowercased, even when it matches a registered acronym", () => {
    // A camelCase identifier starting with a run of capitals reads as a
    // constant, not a variable/function name.
    const acronyms = createAcronyms(["API", "HR"]);
    expect(toCamelCase("api-response", acronyms)).toBe("apiResponse");
    expect(toCamelCase("hr-portal", acronyms)).toBe("hrPortal");
  });
});

describe("toPascalCase", () => {
  test("converts kebab-case", () => {
    expect(toPascalCase("charge-customer")).toBe("ChargeCustomer");
  });

  test("converts camelCase", () => {
    expect(toPascalCase("chargeCustomer")).toBe("ChargeCustomer");
  });

  test("a single word is capitalized", () => {
    expect(toPascalCase("invoice")).toBe("Invoice");
  });

  test("without a registered acronym, an all-caps word degrades to a plain capitalized word", () => {
    expect(toPascalCase("api")).toBe("Api");
    expect(toPascalCase("hr-portal")).toBe("HrPortal");
  });

  test("every word, including the first, keeps a registered acronym's exact casing", () => {
    const acronyms = createAcronyms(["API", "HR", "GraphQL"]);
    expect(toPascalCase("api", acronyms)).toBe("API");
    expect(toPascalCase("hr-portal", acronyms)).toBe("HRPortal");
    expect(toPascalCase("graphql-gateway", acronyms)).toBe("GraphQLGateway");
  });

  test("acronym lookup is case-insensitive on the input side", () => {
    const acronyms = createAcronyms(["API"]);
    expect(toPascalCase("API", acronyms)).toBe("API");
    expect(toPascalCase("Api", acronyms)).toBe("API");
  });
});
