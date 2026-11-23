import { describe, expect, it, vi } from "vitest";
import { buildSnapshotName, maskAmounts, shouldRecordRequest } from "./inspect.js";

vi.mock("../logger.js");

describe("maskAmounts", () => {
  it("表示上の金額をマスクする（マイナス・桁区切りを含む）", () => {
    expect(maskAmounts("<p>¥8,380</p><p>¥-436</p><p>¥1</p>")).toBe(
      "<p>¥*******</p><p>¥*******</p><p>¥*******</p>",
    );
  });

  it('埋め込みデータの "amount" と "y" の値を 0 にする', () => {
    expect(maskAmounts('[{"amount":2513,"y":-311},{"amount":-96,"y":53.5}]')).toBe(
      '[{"amount":0,"y":0},{"amount":0,"y":0}]',
    );
  });

  it("金額以外の数値は変更しない", () => {
    const html = '{"category_id":64280526,"id":11,"x":3}';
    expect(maskAmounts(html)).toBe(html);
  });
});

describe("buildSnapshotName", () => {
  it("連番・きっかけ・ホスト名・パスからファイル名を生成する", () => {
    expect(buildSnapshotName(3, "nav", "https://login.example.com/signin/totp?x=1")).toBe(
      "03-nav-login.example.com_signin_totp",
    );
  });

  it("120文字に切り詰める", () => {
    const name = buildSnapshotName(1, "manual", `https://example.com/${"a".repeat(200)}`);
    expect(name).toHaveLength(120);
  });
});

describe("shouldRecordRequest", () => {
  const zaimOrigin = "https://example.com";

  it.each([
    ["POST", "https://example.com/money", true],
    ["PUT", "https://api.example.com/v2/home/money/1", true],
    ["GET", "https://example.com/money/new", false],
    ["POST", "https://login.example.net/signin/basic", false],
    ["POST", "https://evilexample.com/money", false],
  ])("%s %s は記録対象: %s", (method, url, expected) => {
    expect(shouldRecordRequest(method, url, zaimOrigin)).toBe(expected);
  });
});
