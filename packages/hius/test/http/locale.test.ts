import { describe, expect, test } from "bun:test";
import { resolveLocale } from "@/http/locale";

describe("resolveLocale", () => {
  test("returns the default when there is no Accept-Language header", () => {
    expect(resolveLocale(null, ["en", "ru"], "en")).toBe("en");
  });

  test("returns the default when the header is empty", () => {
    expect(resolveLocale("", ["en", "ru"], "en")).toBe("en");
  });

  test("matches an exact supported tag", () => {
    expect(resolveLocale("ru", ["en", "ru"], "en")).toBe("ru");
  });

  test("matches case-insensitively, returning the canonical supported form", () => {
    expect(resolveLocale("RU", ["en", "ru"], "en")).toBe("ru");
  });

  test("falls back from a regional variant to its base language", () => {
    expect(resolveLocale("ru-RU", ["en", "ru"], "en")).toBe("ru");
  });

  test("prefers an exact regional match over the base language when both are supported", () => {
    expect(resolveLocale("pt-BR", ["pt", "pt-BR", "en"], "en")).toBe("pt-BR");
  });

  test("falls back to the default when nothing in the header is supported", () => {
    expect(resolveLocale("fr-FR,de", ["en", "ru"], "en")).toBe("en");
  });

  test("honors q-value ordering over header order", () => {
    // "ru" is listed first but has the lower quality — "en" should win.
    expect(resolveLocale("ru;q=0.5, en;q=0.9", ["en", "ru"], "ru")).toBe("en");
  });

  test("falls through multiple unsupported candidates before matching one that is", () => {
    expect(resolveLocale("fr, de, ru;q=0.5", ["en", "ru"], "en")).toBe("ru");
  });

  test("skips a wildcard candidate rather than matching it to an arbitrary locale", () => {
    expect(resolveLocale("*, ru", ["en", "ru"], "en")).toBe("ru");
  });

  test("falls back to the default when only a wildcard is present", () => {
    expect(resolveLocale("*", ["en", "ru"], "en")).toBe("en");
  });
});
