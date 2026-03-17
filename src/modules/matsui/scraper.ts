import type { BrowserContext, Page } from "playwright";
import { logger } from "../logger.js";
import { getStorageStatePath, openBrowser, saveStorageState } from "./browser.js";
import type { AssetScrapingStrategy } from "./strategies/strategy-interface.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, HEADLESS } = process.env;

/**
 * 松井証券のスクレイピングを管理するクラス
 */
export class MatsuiScraper {
  private strategy: AssetScrapingStrategy<unknown> | null = null;
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * 現在のページオブジェクトを取得
   */
  get currentPage(): Page | null {
    return this.page;
  }

  /**
   * ブラウザを初期化してCookieを復元
   */
  async initialize(): Promise<void> {
    if (!CHROMIUM_USER_DATA_DIR_MATSUI) {
      throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_MATSUI が設定されていません。");
    }

    const storageStatePath = getStorageStatePath(CHROMIUM_USER_DATA_DIR_MATSUI);
    const { browserContext, page } = await openBrowser(
      CHROMIUM_USER_DATA_DIR_MATSUI,
      HEADLESS === "true",
      storageStatePath
    );

    if (storageStatePath) {
      logger.info("保存されているストレージ状態を復元しました。");
    }
    this.browserContext = browserContext;
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

    // スクレイピング対象のページを準備
    let targetPage = this.page;
    if (this.strategy.prepareTargetPage) {
      targetPage = await this.strategy.prepareTargetPage(this.page);
    }

    return (await this.strategy.scrapeAssets(targetPage)) as T;
  }

  /**
   * ブラウザを閉じてCookieを保存する
   */
  async close(): Promise<void> {
    if (!this.browserContext) {
      return;
    }
    try {
      await saveStorageState(this.browserContext, CHROMIUM_USER_DATA_DIR_MATSUI!);
    } catch (error) {
      logger.error(error, "スクレイピング後のストレージ状態の保存中にエラーが発生しました。");
    }
    try {
      logger.info("ブラウザコンテキストを閉じています。");
      await this.browserContext.close();
      logger.info("ブラウザコンテキストを閉じました。");
    } catch (error) {
      logger.error(error, "ブラウザコンテキストのクローズ中にエラーが発生しました。");
    }
  }
}
