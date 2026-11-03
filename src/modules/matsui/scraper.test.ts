import { EventEmitter } from "events";
import type { Page } from "playwright";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetScrapingStrategy } from "./strategies/strategy-interface.js";

const { openBrowserMock } = vi.hoisted(() => ({ openBrowserMock: vi.fn() }));

vi.mock("../logger.js");
vi.mock("./browser.js", () => ({
  openBrowser: openBrowserMock,
  getStorageStatePath: vi.fn(),
  saveStorageState: vi.fn(),
  deleteStorageState: vi.fn(),
}));

// scraper.ts はモジュールトップで環境変数を参照するため、import 前に設定する
process.env.CHROMIUM_USER_DATA_DIR_MATSUI = "/test/user-data";
const { MatsuiScraper } = await import("./scraper.js");

function createPageMock(): Page {
  return { isClosed: vi.fn().mockReturnValue(false) } as unknown as Page;
}

describe("MatsuiScraper.activePage", () => {
  let browserContext: EventEmitter;
  let firstPage: Page;

  beforeEach(() => {
    browserContext = new EventEmitter();
    firstPage = createPageMock();
    openBrowserMock.mockResolvedValue({ browserContext, page: firstPage });
  });

  async function createScraper(strategy: AssetScrapingStrategy<unknown>) {
    const scraper = new MatsuiScraper();
    await scraper.initialize();
    scraper.setStrategy(strategy);
    return scraper;
  }

  function createStrategyOpeningTab(newPage: Page): AssetScrapingStrategy<unknown> {
    return {
      prepareTargetPage: vi.fn(async () => {
        browserContext.emit("page", newPage);
        throw new Error("失敗");
      }),
      scrapeAssets: vi.fn(),
    };
  }

  function createStrategyFailingInPlace(): AssetScrapingStrategy<unknown> {
    return {
      prepareTargetPage: vi.fn().mockRejectedValue(new Error("失敗")),
      scrapeAssets: vi.fn(),
    };
  }

  it("戦略が新しいタブを開いて失敗した場合、そのタブを返す", async () => {
    const newPage = createPageMock();
    const scraper = await createScraper(createStrategyOpeningTab(newPage));

    await expect(scraper.scrape()).rejects.toThrow("失敗");

    expect(scraper.activePage).toBe(newPage);
  });

  it("戦略が新しいタブを開かずに失敗した場合、最初のタブを返す", async () => {
    const scraper = await createScraper(createStrategyFailingInPlace());

    await expect(scraper.scrape()).rejects.toThrow("失敗");

    expect(scraper.activePage).toBe(firstPage);
  });

  it("前回の scrape() で開いたタブは、次の scrape() に引き継がない", async () => {
    const scraper = await createScraper(createStrategyOpeningTab(createPageMock()));
    await expect(scraper.scrape()).rejects.toThrow("失敗");

    scraper.setStrategy(createStrategyFailingInPlace());
    await expect(scraper.scrape()).rejects.toThrow("失敗");

    expect(scraper.activePage).toBe(firstPage);
  });
});
