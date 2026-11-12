import { describe, expect, it } from "vitest";
import { decodeBase32, generateTotp, getTotpRemainingSeconds } from "./totp.js";

// RFC 6238 Appendix B のテストベクタ（SHA1、シークレット "12345678901234567890"）
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("decodeBase32", () => {
  it("Base32 文字列をデコードできる", () => {
    expect(decodeBase32(RFC_SECRET).toString()).toBe("12345678901234567890");
  });

  it("小文字・空白・パディングを無視する", () => {
    expect(decodeBase32("gezd gnbv gy3t qojq gezd gnbv gy3t qojq====").toString()).toBe(
      "12345678901234567890",
    );
  });

  it("不正な文字を含む場合はエラーをスローする", () => {
    expect(() => decodeBase32("ABC1")).toThrow("Base32 として不正な文字");
  });
});

describe("generateTotp", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("時刻 %i 秒のとき 8 桁で %s を返す", (seconds, expected) => {
    expect(generateTotp(RFC_SECRET, seconds * 1000, { digits: 8 })).toBe(expected);
  });

  it("既定では 6 桁を返す", () => {
    expect(generateTotp(RFC_SECRET, 59 * 1000)).toBe("287082");
  });
});

describe("getTotpRemainingSeconds", () => {
  it("有効期間内の残り秒数を返す", () => {
    expect(getTotpRemainingSeconds(0)).toBe(30);
    expect(getTotpRemainingSeconds(29_000)).toBe(1);
    expect(getTotpRemainingSeconds(30_500)).toBe(30);
  });
});
