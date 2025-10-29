import type { Page } from "playwright";

/**
 * 資産スクレイピング戦略のインターフェース
 */
export interface AssetScrapingStrategy<T> {
  /**
   * セッションの有効性を確認する
   * @param page PlaywrightのPageオブジェクト
   * @returns セッションが有効かどうか
   */
  isSessionValid(page: Page): Promise<boolean>;

  /**
   * ログイン処理を実行する
   * @param page PlaywrightのPageオブジェクト
   */
  login(page: Page): Promise<void>;

  /**
   * スクレイピング対象のページを準備する（オプショナル）
   * @param page PlaywrightのPageオブジェクト
   * @returns スクレイピングに使用するPageオブジェクト
   */
  prepareTargetPage?(page: Page): Promise<Page>;

  /**
   * 資産データをスクレイピングする
   * @param page PlaywrightのPageオブジェクト
   * @returns スクレイピングした資産データ
   */
  scrapeAssets(page: Page): Promise<T>;
}
