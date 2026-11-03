import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { throwIfNoRecord } from "./fund-strategy.js";

vi.mock("../../logger.js");

function createPageMock(isVisible: boolean): Page {
  const first = vi.fn().mockReturnValue({ isVisible: vi.fn().mockResolvedValue(isVisible) });
  return { locator: vi.fn().mockReturnValue({ first }) } as unknown as Page;
}

describe("throwIfNoRecord", () => {
  it("データなしの表示がある場合、データなしのエラーをスローする", async () => {
    const originalError = new Error("元のエラー");

    const promise = throwIfNoRecord(createPageMock(true), originalError);

    await expect(promise).rejects.toThrow("投資信託の残高データがありません。");
    await expect(promise).rejects.toMatchObject({ cause: originalError });
  });

  it("データなしの表示がない場合、元のエラーを再スローする", async () => {
    const originalError = new Error("元のエラー");

    await expect(throwIfNoRecord(createPageMock(false), originalError)).rejects.toBe(originalError);
  });
});
