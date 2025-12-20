import fs from "fs";
import path from "path";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

/**
 * ユーザーデータディレクトリを指定してブラウザを開く
 *
 * @param userDataDir ユーザーデータのあるパス
 * @param headless ヘッドレスで起動するか
 * @returns
 */
export async function openBrowser(userDataDir: string, headless: boolean = true) {
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless,
    // ヘッドレスの場合はChromeの新しいヘッドレスモードを使うためにchromiumの指定が必須
    channel: "chromium",
    args: [
      // headlessモードで起動した際のクラッシュを回避するため
      "--single-process",
    ],
  });

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
 * Cookieをファイルにバックアップ
 *
 * @param page PlaywrightのPageオブジェクト
 * @param userDataDir ユーザーデータディレクトリのパス
 * @throws ファイル書き込みエラー時
 */
export async function backupCookies(page: Page, userDataDir: string): Promise<void> {
  const cookiesFilePath = path.join(userDataDir, "cookies.json");
  const cookies = await page.context().cookies();
  fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));
}

/**
 * Cookieをファイルから復元
 *
 * @param browserContext PlaywrightのBrowserContextオブジェクト
 * @param userDataDir ユーザーデータディレクトリのパス
 * @returns 復元に成功したかどうか（ファイルが存在しない場合はfalseを返す）
 * @throws ファイル読み込みエラーやJSON解析エラー時
 */
export async function restoreCookies(
  browserContext: BrowserContext,
  userDataDir: string
): Promise<boolean> {
  const cookiesFilePath = path.join(userDataDir, "cookies.json");

  if (!fs.existsSync(cookiesFilePath)) {
    return false;
  }

  const cookiesData = fs.readFileSync(cookiesFilePath, "utf-8");
  const cookies = JSON.parse(cookiesData);
  await browserContext.addCookies(cookies);
  return true;
}
