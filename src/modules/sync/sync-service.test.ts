import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import type { MatsuiLoginMethod } from "../matsui/login-methods/login-method.js";
import type { MatsuiScraper } from "../matsui/scraper.js";
import type { ZaimRegistrar } from "./zaim-registrar.js";
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
      { close: vi.fn(), activePage: null } as unknown as ZaimRegistrar,
    );

    await expect(service.sync(config, { dryRun: false })).rejects.toThrow("失敗");

    expect(activePage.screenshot).toHaveBeenCalled();
    expect(currentPage.screenshot).not.toHaveBeenCalled();
  });

  it("収入登録の失敗時、登録処理が操作していたページを記録し、ブラウザを閉じる", async () => {
    const scraperPage = createPageMock();
    const registrarPage = createPageMock();
    const scraper = {
      initialize: vi.fn(),
      setLoginMethod: vi.fn(),
      authenticate: vi.fn(),
      setStrategy: vi.fn(),
      scrape: vi.fn().mockResolvedValue({ details: { ファンドA: { 評価額: 1000 } } }),
      close: vi.fn(),
      activePage: scraperPage as unknown as Page,
    };
    const totalAmountRepo = { load: vi.fn().mockReturnValue([]), save: vi.fn() };
    const zaimRegistrar = {
      registerIncome: vi.fn().mockRejectedValue(new Error("登録失敗")),
      close: vi.fn(),
      activePage: registrarPage as unknown as Page,
    };
    const service = new MatsuiZaimSyncService(
      scraper as unknown as MatsuiScraper,
      {} as MatsuiLoginMethod,
      totalAmountRepo as unknown as TotalAmountRepository,
      zaimRegistrar as unknown as ZaimRegistrar,
    );

    await expect(service.sync(config, { dryRun: false })).rejects.toThrow("登録失敗");

    expect(registrarPage.screenshot).toHaveBeenCalled();
    expect(scraperPage.screenshot).not.toHaveBeenCalled();
    expect(totalAmountRepo.save).not.toHaveBeenCalled();
    expect(scraper.close).toHaveBeenCalled();
    expect(zaimRegistrar.close).toHaveBeenCalled();
  });
});
