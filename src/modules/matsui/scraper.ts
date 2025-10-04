import fs from "fs";
import path from "path";
import type { BrowserContext, Page } from "playwright";
import playwright from "playwright";
import { logger } from "../logger.js";
import { parseNumber } from "../utils.js";
import { getAuthenticationCode } from "./auth.js";
import { openBrowser } from "./browser.js";
import { MatsuiPage } from "./page.js";

/**
 * 資産スクレイピング戦略のインターフェース
 */
interface AssetScrapingStrategy<T> {
  /**
   * セッションの有効性を確認する
   * @param page PlaywrightのPageオブジェクト
   * @returns セッションが有効かどうか
   */
  isSessionValid(page: Page): Promise<boolean>;

  /**
   * ログイン処理を実行する
   * @param page PlaywrightのPageオブジェクト
   */
  login(page: Page): Promise<void>;

  /**
   * 資産データをスクレイピングする
   * @param page PlaywrightのPageオブジェクト
   * @returns スクレイピングした資産データ
   */
  scrapeAssets(page: Page): Promise<T>;
}

interface PositionItem {
  評価額: number | undefined;
  評価損益: number | undefined;
  /**
   * 損益率 (%)
   */
  損益率: number | undefined;
}

interface PositionDetails {
  [key: string]: PositionItem;
}

interface Position {
  details: PositionDetails;
  total: PositionItem;
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
 * 投資信託の資産データをスクレイピングする戦略
 */
class MutualFundStrategy implements AssetScrapingStrategy<Position> {
  async isSessionValid(page: Page): Promise<boolean> {
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

  async login(page: Page): Promise<void> {
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

  async scrapeAssets(page: Page): Promise<Position> {
    await page.goto(MatsuiPage.position);
    // メインのコンテナが表示され、残高の読み込みが完了する（「※該当するデータがありません。」の要素が消える）まで待機する
    await page.locator("#currentPortfolioInquiry").waitFor({ state: "visible", timeout: 30000 });
    await page
      .locator("#currentPortfolioInquiry .noRecord")
      .waitFor({ state: "detached", timeout: 30000 });
    // テーブルデータのパース
    const trs = await page
      .locator("#currentPortfolioInquiry h4", { hasText: "全保有銘柄" })
      .locator("+ table tr")
      .all();
    const getRowData = async (tr: playwright.Locator) =>
      (await tr.allInnerTexts())
        // 同じセルに表示されている評価損益と損益率を分離するため、正規表現で括弧を削除してから分割する
        .map((text) => text.replace(/\s[(|)]\s/g, "\n"))
        .join("")
        .split(/\s+/);
    const [_, ...body] = await Promise.all(trs.map(getRowData));
    const totalRow = body[body.length - 1];
    if (!totalRow || totalRow[0] !== "合計") {
      throw new Error("合計行を取得できませんでした。");
    }

    const positionData: Position = {
      details: Object.fromEntries(
        body.slice(0, -1).map((row) => [
          row[0],
          {
            評価額: row[1] ? parseNumber(row[1]) : undefined,
            評価損益: row[2] ? parseNumber(row[2]) : undefined,
            損益率: row[3] ? parseNumber(row[3]) : undefined,
          },
        ])
      ),
      total: {
        評価額: totalRow[1] ? parseNumber(totalRow[1]) : undefined,
        評価損益: totalRow[2] ? parseNumber(totalRow[2]) : undefined,
        損益率: totalRow[3] ? parseNumber(totalRow[3]) : undefined,
      },
    };

    return positionData;
  }
}

/**
 * 松井証券のスクレイピングを管理するクラス
 */
class MatsuiScraper<T> {
  private strategy: AssetScrapingStrategy<T> | null = null;
  private page: Page;

  /**
   * MatsuiScraperのコンストラクタ
   * @param page PlaywrightのPageオブジェクト
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * スクレイピング戦略を設定する
   * @param strategy 設定する戦略
   */
  setStrategy(strategy: AssetScrapingStrategy<T>): void {
    this.strategy = strategy;
  }

  /**
   * 認証処理を実行する（セッション確認→必要に応じてログイン）
   */
  async authenticate(): Promise<void> {
    if (!this.strategy) {
      throw new Error("スクレイピング戦略が設定されていません。");
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
  async scrape(): Promise<T> {
    if (!this.strategy) {
      throw new Error("スクレイピング戦略が設定されていません。");
    }

    return await this.strategy.scrapeAssets(this.page);
  }
}

/**
 * 松井証券の残高情報から資産評価額を取得する
 * @returns 資産評価額
 */
export async function scrapeMatsui(): Promise<PositionDetails> {
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
    if (cookiesRestored) {
      logger.info("保存されたCookieを復元しました。");
    }

    logger.info("資産評価額を取得します。");

    // Strategyパターンを使用してスクレイピング実行
    const scraper = new MatsuiScraper<Position>(page);
    scraper.setStrategy(new MutualFundStrategy());

    // 認証処理を実行
    await scraper.authenticate();

    // データを取得
    const positionData = await scraper.scrape();
    logger.debug(positionData);
    logger.info("資産評価額の取得が完了しました。");

    return positionData.details;
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
