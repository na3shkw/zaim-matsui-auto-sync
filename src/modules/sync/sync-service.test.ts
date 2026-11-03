import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import type { MatsuiLoginMethod } from "../matsui/login-methods/login-method.js";
import type { MatsuiScraper } from "../matsui/scraper.js";
import type { Zaim } from "../zaim/client.js";
import type { TotalAmountRepository } from "./total-amount-repository.js";

vi.mock("fs");
vi.mock("../logger.js");

// sync-service.ts はモジュールトップで ERROR_LOG_DIR を参照するため、import 前に設定する
process.env.ERROR_LOG_DIR = "/test/error-log";
const { MatsuiZaimSyncService } = await import("./sync-service.js");

function createPageMock() {
  return {
    url: vi.fn().mockReturnValue("https://example.com"),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("")),
    content: vi.fn().mockResolvedValue("<html></html>"),
  };
}

const config = {
  accounts: [
    {
      name: "投資信託",
      enabled: true,
      matsui: { type: "fund", accountName: "ファンドA" },
      zaim: { accountId: 1, categoryId: 11 },
    },
  ],
} as AppConfig;

describe("MatsuiZaimSyncService", () => {
  it("戦略の失敗時、最初のタブではなく戦略が操作していたタブを記録する", async () => {
    const currentPage = createPageMock();
    const activePage = createPageMock();
    const scraper = {
      initialize: vi.fn(),
      setLoginMethod: vi.fn(),
      authenticate: vi.fn(),
      setStrategy: vi.fn(),
      scrape: vi.fn().mockRejectedValue(new Error("失敗")),
      close: vi.fn(),
      currentPage: currentPage as unknown as Page,
      activePage: activePage as unknown as Page,
    };
    const service = new MatsuiZaimSyncService(
      scraper as unknown as MatsuiScraper,
      {} as MatsuiLoginMethod,
      {} as TotalAmountRepository,
      {} as Zaim,
    );

    await expect(service.sync(config, { dryRun: false })).rejects.toThrow("失敗");

    expect(activePage.screenshot).toHaveBeenCalled();
    expect(currentPage.screenshot).not.toHaveBeenCalled();
  });
});
