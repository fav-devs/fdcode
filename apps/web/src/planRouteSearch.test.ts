import { describe, expect, it } from "vitest";

import { parsePlanRouteSearch, stripPlanSearchParams } from "./planRouteSearch";

describe("parsePlanRouteSearch", () => {
  it("parses valid plan search values", () => {
    expect(parsePlanRouteSearch({ plan: "1" })).toEqual({ plan: "1" });
  });

  it("treats numeric and boolean plan toggles as open", () => {
    expect(parsePlanRouteSearch({ plan: 1 })).toEqual({ plan: "1" });
    expect(parsePlanRouteSearch({ plan: true })).toEqual({ plan: "1" });
    expect(parsePlanRouteSearch({ plan: '"1"' })).toEqual({ plan: "1" });
  });

  it("drops invalid plan values", () => {
    expect(parsePlanRouteSearch({ plan: "0" })).toEqual({});
    expect(parsePlanRouteSearch({ plan: false })).toEqual({});
  });
});

describe("stripPlanSearchParams", () => {
  it("removes only the plan search param", () => {
    expect(stripPlanSearchParams({ plan: "1", diff: "1", filesPath: "src/app.ts" })).toEqual({
      diff: "1",
      filesPath: "src/app.ts",
    });
  });
});
