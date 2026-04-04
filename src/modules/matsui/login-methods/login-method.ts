import type { Page } from "playwright";

/**
 * 松井証券へのログイン方式のインターフェース
 */
export interface MatsuiLoginMethod {
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
   * スクレイピングの開始地点となるページに遷移する
   * @param page PlaywrightのPageオブジェクト
   */
  navigateToHome(page: Page): Promise<void>;
}
