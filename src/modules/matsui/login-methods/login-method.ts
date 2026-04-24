import type { Page } from "playwright";

/**
 * 松井証券へのログイン方式のインターフェース
 */
export interface MatsuiLoginMethod {
  /**
   * ログイン処理を実行する
   * @param page PlaywrightのPageオブジェクト
   */
  login(page: Page): Promise<void>;
}
