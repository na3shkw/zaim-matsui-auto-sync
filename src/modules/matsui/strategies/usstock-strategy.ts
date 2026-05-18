import type { Page } from "playwright";
import type { UsStockAsset } from "../../../types/matsui.js";
import { logger } from "../../logger.js";
import { parseNumber } from "../../utils.js";
import { MatsuiPage } from "../page.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";
import { openUsStockTab } from "./usstock-utils.js";

/**
 * 米国株の資産データをスクレイピングする戦略
 */
export class UsStockStrategy implements AssetScrapingStrategy<UsStockAsset> {
  async prepareTargetPage(page: Page): Promise<Page> {
    const newPage = await openUsStockTab(page);

    // 米国株の評価額を表示するページに遷移
    await newPage.goto(MatsuiPage.usStockPosition);
    await newPage.waitForLoadState("networkidle");
    logger.info("米国株の評価額ページに遷移しました。");

    // total-summaryコンテナが表示されるまで待機
    const totalSummary = newPage.locator(".total-summary");
    await totalSummary.waitFor({ state: "visible", timeout: 30000 });

    // 円表示に切り替え
    const controlRow = newPage.locator(".control-row").filter({ hasText: "円" });
    const yenButton = controlRow.locator("button.btn").filter({ hasText: "円" });
    await yenButton.click();
    logger.info("円表示に切り替えました。");

    // 円表示に切り替わるまで待機（.total-priceに「円」が含まれることを確認）
    await totalSummary
      .locator(".total-price")
      .filter({ hasText: "円" })
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    return newPage;
  }

  async scrapeAssets(page: Page): Promise<UsStockAsset> {
    // 各サマリーアイテムを取得
    const totalSummary = page.locator(".total-summary");
    const summaryItems = totalSummary.locator(".total-summary-item");
    const itemCount = await summaryItems.count();

    let totalProfit: number | undefined;
    let totalProfitRate: number | undefined;
    let totalAmount: number | undefined;
    let dailyChange: number | undefined;

    // 各アイテムを処理
    for (let i = 0; i < itemCount; i++) {
      const item = summaryItems.nth(i);
      const titleDiv = item.locator(".title > div").first();
      const titleText = await titleDiv.innerText();

      // 株式評価損益合計と評価損益率
      if (titleText.includes("株式評価損益合計")) {
        const prices = item.locator(".price-cell .total-price");
        const priceCount = await prices.count();
        if (priceCount >= 2) {
          const profitText = await prices.nth(0).innerText();
          const profitRateText = await prices.nth(1).innerText();
          // 単位（円、%）を除去してから数値化
          totalProfit = parseNumber(profitText.replace(/円/g, ""));
          totalProfitRate = parseNumber(profitRateText.replace(/%/g, ""));
        }
      }
      // 株式時価総額合計と前日比合計
      else if (titleText.includes("株式時価総額合計")) {
        const prices = item.locator(".price-cell .total-price");
        const priceCount = await prices.count();
        if (priceCount >= 2) {
          const amountText = await prices.nth(0).innerText();
          const changeText = await prices.nth(1).innerText();
          // 単位（円）を除去してから数値化
          totalAmount = parseNumber(amountText.replace(/円/g, ""));
          dailyChange = parseNumber(changeText.replace(/円/g, ""));
        }
      }
    }

    // 必要な値が取得できたかチェック
    if (
      totalProfit === undefined ||
      totalProfitRate === undefined ||
      totalAmount === undefined ||
      dailyChange === undefined
    ) {
      throw new Error("米国株の評価額データを取得できませんでした。");
    }

    return {
      totalProfit,
      totalProfitRate,
      totalAmount,
      dailyChange,
    };
  }
}
