import fs from "fs";
import path from "path";
import type { BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "../logger.js";

/**
 * ユーザーデータディレクトリを指定してブラウザを開く
 *
 * @param userDataDir ユーザーデータのあるパス
 * @param headless ヘッドレスで起動するか
 * @param storageStatePath 復元するstorageStateファイルのパス（存在する場合）
 * @returns
 */
export async function openBrowser(
  userDataDir: string,
  headless: boolean = true,
  storageStatePath?: string
) {
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless,
    // ヘッドレスの場合はChromeの新しいヘッドレスモードを使うためにchromiumの指定が必須
    channel: "chromium",
    args: [
      // headlessモードで起動した際のクラッシュを回避するため
      "--single-process",
    ],
  });

  if (storageStatePath) {
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
    } catch (e) {
      logger.warn(
        { err: e },
        "storage-state.json の読み込みに失敗しました。Cookieなしで続行します。"
      );
    }
  }

  // ランダムに表示されるポップアップスクリプトをブロック
  await browserContext.route(/\/Rtoaster(\.Popup)?\.js(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "// blocked",
    })
  );

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
  userDataDir: string
): Promise<void> {
  const stateFilePath = path.join(userDataDir, "storage-state.json");
  await browserContext.storageState({ path: stateFilePath });
}

/**
 * storageStateファイルのパスを返す（ファイルが存在する場合のみ）
 *
 * @param userDataDir ユーザーデータディレクトリのパス
 * @returns ファイルが存在すればパス、なければ undefined
 */
export function getStorageStatePath(userDataDir: string): string | undefined {
  const stateFilePath = path.join(userDataDir, "storage-state.json");
  return fs.existsSync(stateFilePath) ? stateFilePath : undefined;
}
