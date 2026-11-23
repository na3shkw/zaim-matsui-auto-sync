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

describe("MatsuiZaimSyncService の口座ごとの処理", () => {
  const twoAccountsConfig = {
    accounts: [
      {
        name: "口座A",
        enabled: true,
        matsui: { type: "fund", accountName: "ファンドA" },
        zaim: { accountId: 1, categoryId: 11 },
      },
      {
        name: "口座B",
        enabled: true,
        matsui: { type: "fund", accountName: "ファンドB" },
        zaim: { accountId: 2, categoryId: 11 },
      },
    ],
  } as AppConfig;

  function setup({
    amounts,
    lastTotalAmounts,
    registerIncome = vi.fn().mockResolvedValue(undefined),
  }: {
    amounts: Record<string, number>;
    lastTotalAmounts: { accountId: number; amount: number; updatedAt: string }[];
    registerIncome?: ReturnType<typeof vi.fn>;
  }) {
    const details = Object.fromEntries(
      Object.entries(amounts).map(([name, value]) => [name, { 評価額: value }]),
    );
    const scraper = {
      initialize: vi.fn(),
      setLoginMethod: vi.fn(),
      authenticate: vi.fn(),
      setStrategy: vi.fn(),
      scrape: vi.fn().mockResolvedValue({ details }),
      close: vi.fn(),
      activePage: null,
    };
    // 保存時点の内容を記録するため、呼び出しごとに複製する
    const savedSnapshots: unknown[] = [];
    const totalAmountRepo = {
      load: vi.fn().mockReturnValue(lastTotalAmounts),
      save: vi.fn((data: unknown) => savedSnapshots.push(structuredClone(data))),
    };
    const zaimRegistrar = { registerIncome, close: vi.fn(), activePage: null };
    const service = new MatsuiZaimSyncService(
      scraper as unknown as MatsuiScraper,
      {} as MatsuiLoginMethod,
      totalAmountRepo as unknown as TotalAmountRepository,
      zaimRegistrar as unknown as ZaimRegistrar,
    );
    return { service, scraper, totalAmountRepo, zaimRegistrar, savedSnapshots };
  }

  it("後続の口座の登録に失敗しても、登録に成功した口座の総額は保存する", async () => {
    const registerIncome = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("登録失敗"));
    const { service, savedSnapshots } = setup({
      amounts: { ファンドA: 1500, ファンドB: 2500 },
      lastTotalAmounts: [
        { accountId: 1, amount: 1000, updatedAt: "" },
        { accountId: 2, amount: 2000, updatedAt: "" },
      ],
      registerIncome,
    });

    await expect(service.sync(twoAccountsConfig, { dryRun: false })).rejects.toThrow("登録失敗");

    expect(savedSnapshots).toEqual([
      [
        expect.objectContaining({ accountId: 1, amount: 1500 }),
        expect.objectContaining({ accountId: 2, amount: 2000 }),
      ],
    ]);
  });

  it("前回総額がない口座は、登録に成功した後に追加して保存する", async () => {
    const { service, savedSnapshots, zaimRegistrar } = setup({
      amounts: { ファンドA: 1500, ファンドB: 2500 },
      lastTotalAmounts: [{ accountId: 1, amount: 1500, updatedAt: "" }],
    });

    await service.sync(twoAccountsConfig, { dryRun: false });

    expect(zaimRegistrar.registerIncome).toHaveBeenCalledTimes(1);
    expect(zaimRegistrar.registerIncome).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500, toAccountId: 2 }),
      { dryRun: false },
    );
    expect(savedSnapshots.at(-1)).toEqual([
      expect.objectContaining({ accountId: 1, amount: 1500 }),
      expect.objectContaining({ accountId: 2, amount: 2500 }),
    ]);
  });

  it("差分が 0 円の口座は登録も保存もしない", async () => {
    const { service, totalAmountRepo, zaimRegistrar } = setup({
      amounts: { ファンドA: 1000, ファンドB: 2000 },
      lastTotalAmounts: [
        { accountId: 1, amount: 1000, updatedAt: "" },
        { accountId: 2, amount: 2000, updatedAt: "" },
      ],
    });

    await service.sync(twoAccountsConfig, { dryRun: false });

    expect(zaimRegistrar.registerIncome).not.toHaveBeenCalled();
    expect(totalAmountRepo.save).not.toHaveBeenCalled();
  });

  it("ドライランでも登録処理は呼び出し、総額は保存しない", async () => {
    const { service, totalAmountRepo, zaimRegistrar } = setup({
      amounts: { ファンドA: 1500, ファンドB: 2500 },
      lastTotalAmounts: [
        { accountId: 1, amount: 1000, updatedAt: "" },
        { accountId: 2, amount: 2000, updatedAt: "" },
      ],
    });

    await service.sync(twoAccountsConfig, { dryRun: true });

    expect(zaimRegistrar.registerIncome).toHaveBeenCalledTimes(2);
    expect(zaimRegistrar.registerIncome).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
    expect(totalAmountRepo.save).not.toHaveBeenCalled();
  });

  it("Zaim への登録を始める前に、松井証券のブラウザを閉じる", async () => {
    const { service, scraper, zaimRegistrar } = setup({
      amounts: { ファンドA: 1500, ファンドB: 2500 },
      lastTotalAmounts: [],
    });

    await service.sync(twoAccountsConfig, { dryRun: false });

    const firstCloseOrder = scraper.close.mock.invocationCallOrder[0]!;
    const firstRegisterOrder = zaimRegistrar.registerIncome.mock.invocationCallOrder[0]!;
    expect(firstCloseOrder).toBeLessThan(firstRegisterOrder);
  });
});
