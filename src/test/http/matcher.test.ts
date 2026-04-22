import { describe, expect, test } from "bun:test";
import { matchPath } from "@/http/routing/matcher.ts";

describe("matchPath", () => {
  test("static path matches exactly", () => {
    expect(matchPath("/users", "/users")).toEqual({ params: {} });
  });

  test("static path does not match different path", () => {
    expect(matchPath("/users", "/posts")).toBeNull();
  });

  test("extracts single param", () => {
    expect(matchPath("/users/:id", "/users/42")).toEqual({ params: { id: "42" } });
  });

  test("extracts multiple params", () => {
    expect(matchPath("/orgs/:org/repos/:repo", "/orgs/acme/repos/hius")).toEqual({
      params: { org: "acme", repo: "hius" },
    });
  });

  test("segment count mismatch returns null", () => {
    expect(matchPath("/users/:id", "/users")).toBeNull();
    expect(matchPath("/users/:id", "/users/42/extra")).toBeNull();
  });

  test("root path matches root", () => {
    expect(matchPath("/", "/")).toEqual({ params: {} });
  });

  test("trailing slash is normalized", () => {
    expect(matchPath("/users", "/users/")).toEqual({ params: {} });
  });
});
