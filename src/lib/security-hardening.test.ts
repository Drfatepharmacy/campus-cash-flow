import { describe, it, expect } from "vitest";
import { safeCell, csvCell } from "./spreadsheet-safe";
import { constrainCallbackUrl } from "./callback-url";

describe("formula injection", () => {
  it("prefixes dangerous cells", () => {
    for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) expect(safeCell(v)).toBe(`'${v}`);
    expect(safeCell("Jane")).toBe("Jane");
    expect(safeCell(-5)).toBe(-5);
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});
describe("callback url", () => {
  const o = "https://www.uniego.app";
  it("accepts own host", () => expect(constrainCallbackUrl(`${o}/p/AB`, o, "/p/AB").toString()).toBe(`${o}/p/AB`));
  it("rejects external host", () => expect(() => constrainCallbackUrl("https://evil.com/p/AB", o, "/p/AB")).toThrow());
  it("rejects other path", () => expect(() => constrainCallbackUrl(`${o}/dashboard`, o, "/p/AB")).toThrow());
});
