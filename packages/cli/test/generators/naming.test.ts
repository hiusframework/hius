import { describe, expect, test } from "bun:test";
import { toCamelCase, toKebabCase, toPascalCase } from "@/generators/naming";

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
});

describe("toCamelCase", () => {
  test("converts kebab-case", () => {
    expect(toCamelCase("charge-customer")).toBe("chargeCustomer");
  });

  test("converts PascalCase", () => {
    expect(toCamelCase("ChargeCustomer")).toBe("chargeCustomer");
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
});
