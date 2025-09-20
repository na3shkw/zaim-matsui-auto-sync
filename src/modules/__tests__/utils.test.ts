import { describe, expect, it } from "vitest";
import { parseNumber } from "../utils.js";

describe("parseNumber", () => {
  it("数字の文字列を正しく数値に変換する", () => {
    expect(parseNumber("123")).toBe(123);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("-123")).toBe(-123);
  });

  it("小数点を含む文字列を正しく数値に変換する", () => {
    expect(parseNumber("123.45")).toBe(123.45);
    expect(parseNumber("0.5")).toBe(0.5);
    expect(parseNumber("-123.45")).toBe(-123.45);
  });

  it("カンマ区切りの数字を正しく数値に変換する", () => {
    expect(parseNumber("1,000")).toBe(1000);
    expect(parseNumber("1,000,000")).toBe(1000000);
    expect(parseNumber("123,456.78")).toBe(123456.78);
  });

  it("前後の空白を除去して数値に変換する", () => {
    expect(parseNumber("  123  ")).toBe(123);
    expect(parseNumber(" 1,000 ")).toBe(1000);
    expect(parseNumber("\t123\n")).toBe(123);
  });

  it("空白が入っている場合を正しく処理する", () => {
    expect(parseNumber(" 1,000,000 ")).toBe(1000000);
    expect(parseNumber("  123,456.78  ")).toBe(123456.78);
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("   ")).toBe(0);
  });

  it("空白のみの場合は0を返す", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("   ")).toBe(0);
  });

  it("不正な文字列の場合はundefinedを返す", () => {
    expect(parseNumber("abc")).toBeUndefined();
    expect(parseNumber("123abc")).toBeUndefined();
  });

  it("特殊なケースを正しく処理する", () => {
    expect(parseNumber("Infinity")).toBe(Infinity);
    expect(parseNumber("-Infinity")).toBe(-Infinity);
    expect(parseNumber("NaN")).toBeUndefined();
  });

  it("科学記法の数値を正しく変換する", () => {
    expect(parseNumber("1e5")).toBe(100000);
    expect(parseNumber("1.23e-4")).toBe(0.000123);
    expect(parseNumber("-2.5e3")).toBe(-2500);
  });

  it("複数のドットがある場合は不正な値として扱う", () => {
    expect(parseNumber("123.45.67")).toBeUndefined();
    expect(parseNumber("1.2.3")).toBeUndefined();
  });

  it("先頭や末尾にカンマがある場合を処理する", () => {
    expect(parseNumber(",123")).toBe(123);
    expect(parseNumber("123,")).toBe(123);
  });
});
