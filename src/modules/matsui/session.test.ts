import type { FrameLocator } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { SessionTimeoutError } from "./errors.js";
import { throwIfSessionTimeout } from "./session.js";

vi.mock("../logger.js");

/**
 * throwIfSessionTimeout に渡す FrameLocator のモックを生成する。
 * 実際に依存するのは locator(...).isVisible() のみなので、それだけを実装する。
 *
 * @param isVisible locator(...).isVisible() の挙動。true/false を返す、または reject する
 */
function createCtFrameMock(isVisible: boolean | Error): FrameLocator {
  const isVisibleFn =
    isVisible instanceof Error
      ? vi.fn().mockRejectedValue(isVisible)
      : vi.fn().mockResolvedValue(isVisible);
  const locator = vi.fn().mockReturnValue({ isVisible: isVisibleFn });
  return { locator } as unknown as FrameLocator;
}

describe("throwIfSessionTimeout", () => {
  it("セッションタイムアウトの文言が表示されている場合、SessionTimeoutError を投げる", async () => {
    const ctFrame = createCtFrameMock(true);
    const originalError = new Error("元のエラー");

    await expect(throwIfSessionTimeout(ctFrame, originalError)).rejects.toBeInstanceOf(
      SessionTimeoutError,
    );
  });

  it("セッションタイムアウトの文言が表示されていない場合、元のエラーを再スローする", async () => {
    const ctFrame = createCtFrameMock(false);
    const originalError = new Error("元のエラー");

    await expect(throwIfSessionTimeout(ctFrame, originalError)).rejects.toBe(originalError);
  });

  it("isVisible() が reject した場合、SessionTimeoutError ではなく元のエラーを再スローする", async () => {
    const ctFrame = createCtFrameMock(new Error("frame detached"));
    const originalError = new Error("元のエラー");

    await expect(throwIfSessionTimeout(ctFrame, originalError)).rejects.toBe(originalError);
  });
});
