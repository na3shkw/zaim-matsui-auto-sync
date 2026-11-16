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
 * storageStateファイルのパスを返す
 *
 * @param userDataDir ユーザーデータディレクトリのパス
 * @returns storageStateファイルのパス
 */
function getStorageStatePath(userDataDir: string): string {
  return path.join(userDataDir, STORAGE_STATE_FILENAME);
}

/**
 * ユーザーデータディレクトリを指定してブラウザを開く
 *
 * @param userDataDir ユーザーデータのあるパス
 * @param options 起動オプション
 * @returns ブラウザコンテキストと最初のページ
 */
export async function openBrowser(
  userDataDir: string,
  { headless = true, restoreStorageState = false, blockedScriptPatterns = [] }: OpenBrowserOptions = {},
): Promise<OpenedBrowser> {
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless,
    ...(BROWSER_USER_AGENT ? { userAgent: BROWSER_USER_AGENT } : {}),
    // ヘッドレスの場合はChromeの新しいヘッドレスモードを使うためにchromiumの指定が必須
    channel: "chromium",
    args: [
      // headlessモードで起動した際のクラッシュを回避するため
      "--single-process",
    ],
  });

  const storageStatePath = getStorageStatePath(userDataDir);
  if (restoreStorageState && fs.existsSync(storageStatePath)) {
    // launchPersistentContext は storageState オプションをサポートしないため、
    // addCookies() で Cookie のみ復元する。
    // localStorage・sessionStorage はユーザーデータディレクトリのプロファイルに
    // 残るため、実用上の問題は生じない。
    try {
      const state = JSON.parse(fs.readFileSync(storageStatePath, "utf-8")) as {
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
    throw Error("予期せぬエラーによりページを開けません。");
  }
  return { browserContext, page };
}

/**
 * storageState（Cookie・localStorage・sessionStorage）をファイルに保存
 *
 * @param browserContext PlaywrightのBrowserContextオブジェクト
 * @param userDataDir ユーザーデータディレクトリのパス
 * @throws ファイル書き込みエラー時
 */
export async function saveStorageState(
  browserContext: BrowserContext,
  userDataDir: string,
): Promise<void> {
  await browserContext.storageState({ path: getStorageStatePath(userDataDir) });
}

/**
 * storageStateファイルを削除する
 *
 * @param userDataDir ユーザーデータディレクトリのパス
 */
export function deleteStorageState(userDataDir: string): void {
  const stateFilePath = getStorageStatePath(userDataDir);
  if (!fs.existsSync(stateFilePath)) {
    return;
  }
  fs.unlinkSync(stateFilePath);
  logger.info("storage-state.json を削除しました。");
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
   * ブラウザを起動する
   *
   * @returns ブラウザコンテキストと最初のページ
   */
  async open(): Promise<OpenedBrowser> {
    const opened = await openBrowser(this.userDataDir, this.options);
    this.browserContext = opened.browserContext;
    return opened;
  }

  /**
   * 現在のストレージ状態をファイルに保存する
   */
  async saveState(): Promise<void> {
    if (!this.browserContext) return;
    await saveStorageState(this.browserContext, this.userDataDir);
  }

  /**
   * Cookie とストレージ状態ファイルを削除する（セッションを破棄して再ログインする前に使用）
   */
  async clearSession(): Promise<void> {
    if (this.browserContext) {
      await this.browserContext.clearCookies();
    }
    deleteStorageState(this.userDataDir);
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
