import type { Page } from "playwright";
import { logger } from "../logger.js";
import { backupCookies, openBrowser, restoreCookies } from "./browser.js";
import type { AssetScrapingStrategy } from "./strategies/strategy-interface.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, HEADLESS } = process.env;

/**
 * 松井証券のスクレイピングを管理するクラス
 */
export class MatsuiScraper {
  private strategy: AssetScrapingStrategy<unknown> | null = null;
  private page: Page | null = null;

  /**
   * ブラウザを初期化してCookieを復元
   */
  async initialize(): Promise<void> {
    if (!CHROMIUM_USER_DATA_DIR_MATSUI) {
      throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_MATSUI が設定されていません。");
    }

    const { browserContext, page } = await openBrowser(
      CHROMIUM_USER_DATA_DIR_MATSUI,
      HEADLESS === "true"
    );

    // Cookie復元を試行
    const cookiesRestored = await restoreCookies(browserContext, CHROMIUM_USER_DATA_DIR_MATSUI);
    if (cookiesRestored) {
      logger.info("保存されているCookieを復元しました。");
    }
    this.page = page;
  }

  /**
   * スクレイピング戦略を設定する
   * @param strategy 設定する戦略
   */
  setStrategy<T>(strategy: AssetScrapingStrategy<T>): void {
    this.strategy = strategy;
  }

  /**
   * 認証処理を実行する（セッション確認→必要に応じてログイン）
   */
  async authenticate(): Promise<void> {
    if (!this.strategy || !this.page) {
      throw new Error("スクレイピング戦略またはページが初期化されていません。");
    }

    logger.info("セッションの有効性をチェックします。");
    const sessionValid = await this.strategy.isSessionValid(this.page);

    if (!sessionValid) {
      logger.info("セッションが無効なため、ログインを実行します。");
      await this.strategy.login(this.page);
      logger.info("ログインが完了しました。");
    } else {
      logger.info("既存のセッションを使用します。");
    }
  }

  /**
   * 設定された戦略を実行して資産データを取得する
   * @returns 資産データ
   */
  async scrape<T>(): Promise<T> {
    if (!this.strategy || !this.page) {
      throw new Error("スクレイピング戦略またはページが初期化されていません。");
    }

    return (await this.strategy.scrapeAssets(this.page)) as T;
  }

  /**
   * ブラウザを閉じてCookieを保存する
   */
  async close(): Promise<void> {
    if (!this.page) {
      return;
    }
    try {
      await backupCookies(this.page, CHROMIUM_USER_DATA_DIR_MATSUI!);
    } catch (error) {
      logger.error(error, "スクレイピング後のCookie保存中にエラーが発生しました。");
    }
    const browserContext = this.page.context();
    try {
      logger.info("ブラウザコンテキストを閉じています。");
      await browserContext.close();
      logger.info("ブラウザコンテキストを閉じました。");
    } catch (error) {
      logger.error(error, "ブラウザコンテキストのクローズ中にエラーが発生しました。");
    }
  }
}
