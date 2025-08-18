import fs from "fs";
import path from "path";
import type { BrowserContext, Page } from "playwright";
import playwright from "playwright";
import { logger } from "../logger.js";
import { getAuthenticationCode } from "./auth.js";
import { openBrowser } from "./browser.js";
import { MatsuiPage } from "./page.js";

interface MatsuiScraper {
  /**
   * NISA時価評価額の合計
   */
  nisaTotalMarketValue: number;
}

interface NisaPositionItem {
  時価評価額: number | undefined;
  評価損益: number | undefined;
}

interface NisaPosition {
  合計: NisaPositionItem;
  "投資信託（NISA）": NisaPositionItem;
  "投資信託（積立NISA）": NisaPositionItem;
  "日本株（NISA）": NisaPositionItem;
  "米国株（NISA）": NisaPositionItem;
}

const { CHROMIUM_USER_DATA_DIR_MATSUI, MATSUI_LOGIN_ID, MATSUI_PASSWORD, HEADLESS } = process.env;

const COOKIES_FILE_PATH = path.join(CHROMIUM_USER_DATA_DIR_MATSUI ?? process.cwd(), "cookies.json");

/**
 * Cookieをファイルにバックアップ
 *
 * @param page PlaywrightのPageオブジェクト
 */
async function backupCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.context().cookies();
    fs.writeFileSync(COOKIES_FILE_PATH, JSON.stringify(cookies, null, 2));
    logger.info(`Cookieを${COOKIES_FILE_PATH}にバックアップしました。`);
  } catch (error) {
    logger.error(error, "Cookieのバックアップ中にエラーが発生しました。");
  }
}

/**
 * Cookieをファイルから復元
 *
 * @param browserContext PlaywrightのBrowserContextオブジェクト
 * @returns 復元したかどうか
 */
async function restoreCookies(browserContext: BrowserContext): Promise<boolean> {
  try {
    const cookiesData = fs.readFileSync(COOKIES_FILE_PATH, "utf-8");
    const cookies = JSON.parse(cookiesData);
    await browserContext.addCookies(cookies);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * セッションの有効性をチェック
 *
 * @param page PlaywrightのPageオブジェクト
 * @returns セッションが有効かどうか
 */
async function isSessionValid(page: Page): Promise<boolean> {
  try {
    const response = await page.goto(MatsuiPage.home, { timeout: 10000 });
    const url = response?.url();

    // メンテナンス画面の場合
    if (url && MatsuiPage.fundMente.indexOf(url) !== -1) {
      throw new Error("メンテナンス中のため同期を実行できません。");
    }

    try {
      // モーダルが表示されるまで待機（最大3秒）
      await page.waitForSelector(".modal-container.dialog.error", {
        timeout: 3000,
        state: "visible",
      });
    } catch {
      return true;
    }
  } catch (error) {
    logger.error(error, "セッション有効性チェック中にエラーが発生しました。");
  }
  return false;
}

/**
 * ログイン情報を入力後、認証コードを利用してログインする
 *
 * @param page PlaywrightのPageオブジェクト
 */
async function login(page: Page): Promise<void> {
  if (!MATSUI_LOGIN_ID || !MATSUI_PASSWORD) {
    throw new Error("環境変数 MATSUI_LOGIN_ID または MATSUI_PASSWORD が設定されていません。");
  }

  const response = await page.goto(MatsuiPage.login);
  const url = response?.url();

  // メンテナンス画面にリダイレクトされた場合
  if (url && MatsuiPage.fundMente.indexOf(url) !== -1) {
    throw new Error("メンテナンス中のため同期を実行できません。");
  }

  await page.waitForLoadState("networkidle");

  // ログイン情報を入力
  await page.getByLabel("ログインID").fill(MATSUI_LOGIN_ID);
  await page.getByLabel("パスワード").fill(MATSUI_PASSWORD);

  // ページ遷移を待機しながらクリック
  await Promise.all([
    page.waitForURL("**", { timeout: 10000 }),
    page.getByRole("button", { name: "ログイン" }).click(),
  ]);
  logger.info("ログインフォームを送信しました。");

  const { authenticationCode } = await getAuthenticationCode();
  await page.fill(".inputAuthNumArea input[type='text']", authenticationCode);
  logger.info("認証コードを入力しました。");

  // 少し待ってから自動遷移したかどうかを確認
  await page.waitForTimeout(1000);

  // 認証ボタンがまだ存在するかチェック（自動遷移しなかった場合）
  const authButton = page.getByRole("button", { name: "認証する" });
  const buttonExists = (await authButton.count()) > 0;

  if (buttonExists) {
    await authButton.click();
    logger.info("自動遷移しなかったため、認証ボタンをクリックしました。");
  } else {
    logger.info("認証コード入力により自動遷移しました。");
  }

  // ログイン成功後にCookieを保存
  await backupCookies(page);
}

/**
 * 資産評価額を取得する
 *
 * @param page PlaywrightのPageオブジェクト
 * @returns {Promise<NisaPosition>} 資産評価額
 */
async function getNisaPositionData(page: Page): Promise<NisaPosition> {
  await page.goto(MatsuiPage.nisa);
  const trs = await page.locator("table[aria-describedby='NISA保有残高'] tr").all();
  const getRowData = async (tr: playwright.Locator) =>
    (await tr.allInnerTexts()).join("").split(/\s+/);
  const [head, ...body] = await Promise.all(trs.map(getRowData));

  if (!head) {
    throw new Error("表のヘッダが空です。");
  }
  const nisaPositionData: NisaPosition = Object.fromEntries(
    body.map((row) => [
      row[0],
      Object.fromEntries(
        head.slice(1).map((key, index) => {
          const rawValue = row[index + 1];
          let value: number | undefined;
          switch (rawValue) {
            case "-":
              value = 0;
              break;
            default:
              // カンマを削除して数値にパースする（パースできない文字列が入った場合はundefinedになる）
              value = parseInt(String(rawValue).replace(/,/g, ""), 10) || undefined;
          }
          return [key, value];
        })
      ),
    ])
  );
  return nisaPositionData;
}

/**
 * 松井証券のNISA口座から資産評価額を取得する
 * @returns {Promise<MatsuiScraper>} 資産評価額
 */
export async function scrapeMatsui(): Promise<MatsuiScraper> {
  if (!CHROMIUM_USER_DATA_DIR_MATSUI) {
    throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_MATSUI が設定されていません。");
  }

  let browserContext: BrowserContext | undefined = undefined;
  let page: Page | undefined = undefined;
  try {
    ({ browserContext, page } = await openBrowser(
      CHROMIUM_USER_DATA_DIR_MATSUI,
      HEADLESS === "true"
    ));

    // Cookie復元を試行
    const cookiesRestored = await restoreCookies(browserContext);

    // セッション有効性をチェック
    let sessionValid = false;
    if (cookiesRestored) {
      logger.info("保存されたCookieを復元しました。セッションの有効性をチェックします。");
      sessionValid = await isSessionValid(page);
    }

    if (!sessionValid) {
      logger.info("セッションが無効なため、ログインを実行します。");
      await login(page);
      logger.info("ログインが完了しました。");
    } else {
      logger.info("既存のセッションを使用します。");
    }

    logger.info("NISA保有残高を取得します。");
    const nisaPositionData = await getNisaPositionData(page);
    logger.info("NISA保有残高の取得が完了しました。");

    const nisaTotalMarketValue = nisaPositionData["合計"]["時価評価額"];
    if (typeof nisaTotalMarketValue === "undefined") {
      throw new Error("パースされた値が不正です。");
    }

    return { nisaTotalMarketValue };
  } catch (error) {
    logger.error(error, "松井証券のスクレイピング中にエラーが発生しました。");
    throw error;
  } finally {
    try {
      // Cookieを保存
      if (page) {
        await backupCookies(page);
      }

      if (browserContext) {
        logger.info("ブラウザコンテキストを閉じています。");
        await browserContext.close();
        logger.info("ブラウザコンテキストを閉じました。");
      }
    } catch (error) {
      logger.error(error, "ブラウザコンテキストのクローズ中にエラーが発生しました。");
    }
  }
}
