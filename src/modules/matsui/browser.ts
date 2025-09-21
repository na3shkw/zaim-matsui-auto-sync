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
  const page = browserContext.pages()[0];
  if (!page) {
    throw Error("予期せぬエラーによりページを開けません。");
  }
  return { browserContext, page };
}
