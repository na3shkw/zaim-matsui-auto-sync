import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";
import { isSameDateDisplay, normalizeAmountDisplay } from "./client.js";

vi.mock("../logger.js");

describe("normalizeAmountDisplay", () => {
  it.each([
    ["1,234,567", "1234567"],
    ["-311", "-311"],
    ["-1,000", "-1000"],
    ["0", "0"],
  ])("表示値 %s を %s に正規化する", (display, expected) => {
    expect(normalizeAmountDisplay(display)).toBe(expected);
  });
});

describe("isSameDateDisplay", () => {
  it("曜日付きの表示値と日付が一致すれば true を返す", () => {
    expect(isSameDateDisplay("2026年11月1日(日)", dayjs("2026-11-01"))).toBe(true);
  });

  it("日付が異なれば false を返す", () => {
    expect(isSameDateDisplay("2026年11月11日(水)", dayjs("2026-11-01"))).toBe(false);
  });
});
