import type { Page } from "playwright";

/**
 * 資産スクレイピング戦略のインターフェース
 */
export interface AssetScrapingStrategy<T> {
  /**
   * スクレイピング対象のページを準備する（オプショナル）
   * @param page PlaywrightのPageオブジェクト
   * @returns スクレイピングに使用するPageオブジェクト
   */
  prepareTargetPage(page: Page): Promise<Page>;

  /**
   * 資産データをスクレイピングする
   * @param page PlaywrightのPageオブジェクト
   * @returns スクレイピングした資産データ
   */
  scrapeAssets(page: Page): Promise<T>;
}
