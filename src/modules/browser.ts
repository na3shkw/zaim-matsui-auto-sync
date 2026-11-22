import fs from "fs";
import path from "path";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import { logger } from "./logger.js";

const { BROWSER_USER_AGENT } = process.env;

const STORAGE_STATE_FILENAME = "storage-state.json";

export interface OpenBrowserOptions {
  /** ヘッドレスで起動するか（既定: true） */
  headless?: boolean;
  /** ユーザーデータディレクトリの storage-state.json から Cookie を復元するか（既定: false） */
  restoreStorageState?: boolean;
  /** 読み込みを無効化するスクリプトのURLパターン */
  blockedScriptPatterns?: RegExp[];
}

export interface OpenedBrowser {
  browserContext: BrowserContext;
  page: Page;
}

/**
 * ユーザーデータディレクトリを保持するブラウザのライフサイクル（起動・状態保存・終了）を管理する
 *
 * セッションの確認やログインはサイトごとに異なるため、利用側で実装する。
 */
export class PersistentBrowser {
  private browserContext: BrowserContext | null = null;

  /**
   * @param userDataDir ユーザーデータディレクトリのパス
   * @param options 起動オプション
   */
  constructor(
    private readonly userDataDir: string,
    private readonly options: OpenBrowserOptions = {},
  ) {}

  /**
   * 起動中のブラウザコンテキスト（未起動の場合は null）
   */
  get context(): BrowserContext | null {
    return this.browserContext;
  }

  private get storageStatePath(): string {
    return path.join(this.userDataDir, STORAGE_STATE_FILENAME);
  }

  /**
   * ブラウザを起動する
   *
   * @returns ブラウザコンテキストと最初のページ
   * @throws 起動済みの場合（前のコンテキストを閉じられなくなるため、close() してから呼び出す）
   */
  async open(): Promise<OpenedBrowser> {
    if (this.browserContext) {
      throw new Error("ブラウザは起動済みです。再度起動する場合は close() してください。");
    }

    const {
      headless = true,
      restoreStorageState = false,
      blockedScriptPatterns = [],
    } = this.options;

    const browserContext = await chromium.launchPersistentContext(this.userDataDir, {
      headless,
      ...(BROWSER_USER_AGENT ? { userAgent: BROWSER_USER_AGENT } : {}),
      // ヘッドレスの場合はChromeの新しいヘッドレスモードを使うためにchromiumの指定が必須
      channel: "chromium",
      args: [
        // headlessモードで起動した際のクラッシュを回避するため
        "--single-process",
      ],
    });

    if (restoreStorageState && fs.existsSync(this.storageStatePath)) {
      // launchPersistentContext は storageState オプションをサポートしないため、
      // addCookies() で Cookie のみ復元する。
      // localStorage・sessionStorage はユーザーデータディレクトリのプロファイルに
      // 残るため、実用上の問題は生じない。
      try {
        const state = JSON.parse(fs.readFileSync(this.storageStatePath, "utf-8")) as {
          cookies?: Parameters<BrowserContext["addCookies"]>[0];
        };
        if (state.cookies && state.cookies.length > 0) {
          await browserContext.addCookies(state.cookies);
        }
        logger.info("保存されているストレージ状態を復元しました。");
      } catch (e) {
        logger.warn(
          { err: e },
          "storage-state.json の読み込みに失敗しました。Cookieなしで続行します。",
        );
      }
    }

    // 画面操作の妨げになるスクリプトをブロック
    for (const pattern of blockedScriptPatterns) {
      await browserContext.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "// blocked",
        }),
      );
    }

    const page = browserContext.pages()[0];
    if (!page) {
      await browserContext.close();
      throw Error("予期せぬエラーによりページを開けません。");
    }
    this.browserContext = browserContext;
    return { browserContext, page };
  }

  /**
   * 現在のストレージ状態（Cookie・localStorage・sessionStorage）をファイルに保存する
   *
   * @throws ファイル書き込みエラー時
   */
  async saveState(): Promise<void> {
    if (!this.browserContext) return;
    await this.browserContext.storageState({ path: this.storageStatePath });
  }

  /**
   * Cookie とストレージ状態ファイルを削除する（セッションを破棄して再ログインする前に使用）
   */
  async clearSession(): Promise<void> {
    if (this.browserContext) {
      await this.browserContext.clearCookies();
    }
    if (!fs.existsSync(this.storageStatePath)) {
      return;
    }
    fs.unlinkSync(this.storageStatePath);
    logger.info("storage-state.json を削除しました。");
  }

  /**
   * ストレージ状態を保存してブラウザを閉じる
   *
   * 呼び出し元の例外を上書きしないよう、各処理のエラーはログに記録するのみとする。
   */
  async close(): Promise<void> {
    if (!this.browserContext) return;
    try {
      await this.saveState();
    } catch (error) {
      logger.error(error, "ストレージ状態の保存中にエラーが発生しました。");
    }
    try {
      logger.info("ブラウザコンテキストを閉じています。");
      await this.browserContext.close();
      logger.info("ブラウザコンテキストを閉じました。");
    } catch (error) {
      logger.error(error, "ブラウザコンテキストのクローズ中にエラーが発生しました。");
    }
    this.browserContext = null;
  }
}

/**
 * ユーザーデータディレクトリを指定してブラウザを開く
 *
 * ライフサイクルを自前で管理する場合の簡易的な入口。状態の保存・復元が必要な場合は PersistentBrowser を使用する。
 *
 * @param userDataDir ユーザーデータのあるパス
 * @param options 起動オプション
 * @returns ブラウザコンテキストと最初のページ
 */
export function openBrowser(
  userDataDir: string,
  options: OpenBrowserOptions = {},
): Promise<OpenedBrowser> {
  return new PersistentBrowser(userDataDir, options).open();
}
