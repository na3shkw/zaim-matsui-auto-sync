import type { Page } from "playwright";
import playwright from "playwright";
import type { Position } from "../../../types/matsui.js";
import { logger } from "../../logger.js";
import { parseNumber } from "../../utils.js";
import { MatsuiPage } from "../page.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";

/**
 * 投資信託の資産データをスクレイピングする戦略
 */
export class FundStrategy implements AssetScrapingStrategy<Position> {
  async prepareTargetPage(page: Page): Promise<Page> {
    await page.goto(MatsuiPage.tradeMemberHome);

    // 投資信託メニューをクリック
    const mutualFundMenuLink = page
      .locator('#common-header [data-page="mutual-fund-top"]')
      .locator("visible=true")
      .first();
    await mutualFundMenuLink.click();
    logger.info("「投資信託」メニューをクリックしました。");

    // 起動ボタンをクリック（別画面に遷移）
    const activateButton = page.locator(
      '[data-page="activate-mutual-fund-screen"] .btn-menu-activate-mutual-fund-screen'
    );
    await activateButton.waitFor({ state: "visible", timeout: 10000 });
    await activateButton.click();
    logger.info("投資信託サイトの起動ボタンをクリックしました。");

    // iframe内の「起動する」画像をクリックして新しいタブが開くのを待つ
    const iframe = page.frameLocator("#net-stock-contents");
    logger.info("iframeの読み込みを待機中...");

    const ctFrame = iframe.frameLocator('frame[name="CT"]');
    logger.info("CTフレームを取得しました。");

    // frame内の起動ボタン (name="kidouButton"のimg要素の親a要素) を取得
    const launchButton = ctFrame.locator('a:has(img[name="kidouButton"])');
    await launchButton.waitFor({ state: "visible", timeout: 30000 });
    logger.info("起動ボタンが表示されました。");

    // 起動ボタンをクリックして新しいタブが開くのを待つ
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      launchButton.click(),
    ]);
    logger.info("投資信託サイトの起動ボタンをクリックしました。");

    await newPage.waitForLoadState("networkidle");
    logger.info("投資信託サイトが起動しました。");

    // 既存の残高照会ページ遷移処理
    await newPage.goto(MatsuiPage.position);
    await newPage.waitForLoadState("networkidle");
    logger.info("残高照会ページに遷移しました。");

    // メインのコンテナが表示され、残高の読み込みが完了する（「※該当するデータがありません。」の要素が消える）まで待機する
    await newPage.locator("#currentPortfolioInquiry").waitFor({ state: "visible", timeout: 30000 });
    await newPage
      .locator("#currentPortfolioInquiry .noRecord")
      .waitFor({ state: "detached", timeout: 30000 });

    return newPage;
  }

  async scrapeAssets(page: Page): Promise<Position> {
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
