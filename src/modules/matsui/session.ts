import type { Page } from "playwright";
import { logger } from "../logger.js";
import { MatsuiPage } from "./page.js";

export async function isSessionValid(page: Page): Promise<boolean> {
  try {
    await page.goto(MatsuiPage.tradeMemberHome, { timeout: 10000 });
    if (page.url().includes(MatsuiPage.tradeMente)) {
      throw new Error("メンテナンス中のため同期を実行できません。");
    }
    return !page.url().includes("/login");
  } catch (error) {
    if (error instanceof Error && error.message.includes("メンテナンス")) {
      throw error;
    }
    logger.error(error, "セッション有効性チェック中にエラーが発生しました。");
    return false;
  }
}
