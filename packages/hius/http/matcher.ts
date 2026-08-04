type Segment = { type: "static"; value: string } | { type: "param"; name: string };

function compilePattern(pattern: string): Segment[] {
  return pattern
    .split("/")
    .filter(Boolean)
    .map((s) =>
      s.startsWith(":") ? { type: "param", name: s.slice(1) } : { type: "static", value: s },
    );
}

type MatchResult = { params: Record<string, string> };

export function matchPath(pattern: string, pathname: string): MatchResult | null {
  // Normalize trailing slashes
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  const patternSegments = compilePattern(pattern);
  const pathSegments = normalized.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const seg = patternSegments[i]!;
    const val = pathSegments[i]!;

    if (seg.type === "static") {
      if (seg.value !== val) return null;
    } else {
      params[seg.name] = val;
    }
  }

  return { params };
}
