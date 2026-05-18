import type { Page } from "playwright";
import type { UsStockPowerAsset } from "../../../types/matsui.js";
import { logger } from "../../logger.js";
import { parseNumber } from "../../utils.js";
import { MatsuiPage } from "../page.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";
import { openUsStockTab } from "./usstock-utils.js";

/**
 * 米国株口座の使用可能現金（余力）をスクレイピングする戦略。
 * 円建て現金とドル建て現金を取得し、ドル分をリアルタイムの米ドル/円レートで円換算して合計する。
 */
export class UsStockPowerStrategy implements AssetScrapingStrategy<UsStockPowerAsset> {
  async prepareTargetPage(page: Page): Promise<Page> {
    const newPage = await openUsStockTab(page);

    await newPage.goto(MatsuiPage.usStockAssetPower);
    await newPage.waitForLoadState("networkidle");
    logger.info("米国株の余力情報ページに遷移しました。");

    await newPage
      .locator(".panel-color")
      .filter({ has: newPage.locator(".panel-color-header", { hasText: "現物買付余力" }) })
      .locator("table.asset-table")
      .first()
      .waitFor({ state: "visible", timeout: 30000 });

    return newPage;
  }

  async scrapeAssets(page: Page): Promise<UsStockPowerAsset> {
    const powerPanel = page.locator(".panel-color").filter({
      has: page.locator(".panel-color-header", { hasText: "現物買付余力" }),
    });

    // 米国株口座の使用可能現金(円)
    const jpyRow = powerPanel.locator("tr").filter({
      has: page.locator("th.subtitle-cell", { hasText: "米国株口座の使用可能現金(円)" }),
    });
    const jpyText = await jpyRow.locator("td.value-cell").innerText();
    const jpyCash = parseNumber(jpyText.replace(/円/g, ""));
    if (jpyCash === undefined) {
      throw new Error("米国株口座の使用可能現金(円)を取得できませんでした。");
    }
    logger.info(`米国株口座の使用可能現金(円): ${jpyCash}円`);

    // 米国株口座の使用可能現金(ドル)
    const usdRow = powerPanel.locator("tr").filter({
      has: page.locator("th.subtitle-cell", { hasText: "米国株口座の使用可能現金(ドル)" }),
    });
    const usdText = await usdRow.locator("td.value-cell").innerText();
    const usdCash = parseNumber(usdText.replace(/ドル/g, ""));
    if (usdCash === undefined) {
      throw new Error("米国株口座の使用可能現金(ドル)を取得できませんでした。");
    }
    logger.info(`米国株口座の使用可能現金(ドル): ${usdCash}ドル`);

    // 米ドル/円レート（ページヘッダのリアルタイム表示から取得）
    const rateElement = page.locator('[data-symbol="*@FX@USD/JPY@E@MarketInfoFull"]');
    await rateElement.waitFor({ state: "visible", timeout: 10000 });
    const rateText = await rateElement.innerText();
    const rateMatch = rateText.match(/米ドル\/円\s*([\d,.]+)/);
    const usdJpyRate = rateMatch?.[1] !== undefined ? parseNumber(rateMatch[1]) : undefined;

    if (usdJpyRate === undefined) {
      throw new Error("米ドル/円の為替レートを取得できませんでした。");
    }
    logger.info(`米ドル/円レート: ${usdJpyRate}`);

    const totalBuyingPower = Math.round(jpyCash + usdCash * usdJpyRate);
    logger.info(`米国株口座の使用可能現金合計（円換算）: ${totalBuyingPower}円`);

    return { totalBuyingPower };
  }
}
