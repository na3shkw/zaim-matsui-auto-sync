import type { BrowserContext, Page } from "playwright";
import { PersistentBrowser } from "../browser.js";
import { logger } from "../logger.js";
import { MATSUI_BLOCKED_SCRIPT_PATTERNS } from "./browser.js";
import type { MatsuiLoginMethod } from "./login-methods/login-method.js";
import { isSessionValid } from "./session.js";
import type { AssetScrapingStrategy } from "./strategies/strategy-interface.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, HEADLESS } = process.env;

/**
 * 松井証券のスクレイピングを管理するクラス
 */
export class MatsuiScraper {
  private loginMethod: MatsuiLoginMethod | null = null;
  private strategy: AssetScrapingStrategy<unknown> | null = null;
  private browser: PersistentBrowser | null = null;
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private lastScrapePage: Page | null = null;

  /**
   * 現在のページオブジェクトを取得
   */
  get currentPage(): Page | null {
    return this.page;
  }

  /**
   * 直近の scrape() で戦略が操作していたページを取得する
   */
  get activePage(): Page | null {
    if (this.lastScrapePage && !this.lastScrapePage.isClosed()) {
      return this.lastScrapePage;
    }
    return this.page;
  }

  /**
   * ブラウザを初期化してCookieを復元
   */
  async initialize(): Promise<void> {
    if (!CHROMIUM_USER_DATA_DIR_MATSUI) {
      throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_MATSUI が設定されていません。");
    }

    this.browser = new PersistentBrowser(CHROMIUM_USER_DATA_DIR_MATSUI, {
      headless: HEADLESS === "true",
      restoreStorageState: true,
      blockedScriptPatterns: MATSUI_BLOCKED_SCRIPT_PATTERNS,
    });
    const { browserContext, page } = await this.browser.open();
    this.browserContext = browserContext;
    this.page = page;
  }

  /**
   * ログイン方式を設定する
   * @param loginMethod 設定するログイン方式
   */
  setLoginMethod(loginMethod: MatsuiLoginMethod): void {
    this.loginMethod = loginMethod;
  }

  /**
   * スクレイピング戦略を設定する
   * @param strategy 設定する戦略
   */
  setStrategy<T>(strategy: AssetScrapingStrategy<T>): void {
    this.strategy = strategy;
    this.lastScrapePage = null;
  }

  /**
   * 認証処理を実行する（セッション確認→必要に応じてログイン）
   */
  async authenticate(): Promise<void> {
    if (!this.loginMethod || !this.page) {
      throw new Error("ログイン方式またはページが初期化されていません。");
    }

    logger.info("セッションの有効性をチェックします。");
    if (await isSessionValid(this.page)) {
      logger.info("既存のセッションを使用します。");
    } else {
      logger.info("セッションが無効なため、ログインを実行します。");
      await this.loginMethod.login(this.page);
      logger.info("ログインが完了しました。");
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

    this.lastScrapePage = null;
    const onPage = (newPage: Page) => {
      this.lastScrapePage = newPage;
    };
    this.browserContext?.on("page", onPage);
    let targetPage: Page;
    try {
      targetPage = await this.strategy.prepareTargetPage(this.page);
    } finally {
      this.browserContext?.off("page", onPage);
    }
    this.lastScrapePage = targetPage;
    return (await this.strategy.scrapeAssets(targetPage)) as T;
  }

  /**
   * ブラウザのCookieとストレージ状態ファイルを削除する（セッションタイムアウト後の再ログイン前に使用）
   */
  async clearSession(): Promise<void> {
    await this.browser?.clearSession();
  }

  /**
   * ブラウザを閉じてCookieを保存する
   */
  async close(): Promise<void> {
    await this.browser?.close();
  }
}
