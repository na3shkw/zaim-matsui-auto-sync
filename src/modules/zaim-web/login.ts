import type { Page } from "playwright";
import { logger } from "../logger.js";
import { ZaimWebPage } from "./page.js";
import { KufuLoginSelector, KufuTwoFactorSelector } from "./selectors.js";
import { generateTotp, getTotpRemainingSeconds } from "./totp.js";

const { ZAIM_EMAIL, ZAIM_PASSWORD, ZAIM_TOTP_SECRET } = process.env;

/** 残り有効秒数がこれ未満のワンタイムパスワードは使わず、次の周期まで待つ */
const TOTP_MIN_REMAINING_SECONDS = 5;

/**
 * URL が Zaim 上のページかどうかを判定する
 *
 * @param url 判定するURL
 * @returns Zaim 上のページであれば true
 */
function isZaimUrl(url: URL): boolean {
  return url.origin === ZaimWebPage.zaimOrigin && !url.pathname.startsWith("/user_session");
}

/**
 * Zaim にログイン済みかどうかを判定する
 *
 * @param page PlaywrightのPageオブジェクト
 * @returns ログイン済みであれば true
 */
export async function isZaimSessionValid(page: Page): Promise<boolean> {
  try {
    await page.goto(ZaimWebPage.home, { timeout: 15000 });
    return isZaimUrl(new URL(page.url()));
  } catch (error) {
    logger.error(error, "Zaim のセッション有効性チェック中にエラーが発生しました。");
    return false;
  }
}

/**
 * 有効期限に余裕のあるワンタイムパスワードを生成する
 *
 * @param secret Base32 形式のシークレットキー
 * @returns ワンタイムパスワード
 */
async function generateFreshTotp(secret: string): Promise<string> {
  const remaining = getTotpRemainingSeconds();
  if (remaining < TOTP_MIN_REMAINING_SECONDS) {
    logger.info(`ワンタイムパスワードの残り有効時間が短いため、${remaining} 秒待機します。`);
    await new Promise((resolve) => setTimeout(resolve, remaining * 1000));
  }
  return generateTotp(secret);
}

/**
 * くふうアカウント（メールアドレス・パスワード＋認証アプリの2段階認証）で Zaim にログインする
 *
 * 2段階認証が無効なアカウントの場合は、パスワード認証のみでログインを完了する。
 *
 * @param page PlaywrightのPageオブジェクト
 */
export async function loginToZaim(page: Page): Promise<void> {
  if (!ZAIM_EMAIL || !ZAIM_PASSWORD) {
    throw new Error("環境変数 ZAIM_EMAIL または ZAIM_PASSWORD が設定されていません。");
  }

  await page.goto(ZaimWebPage.login);
  await page.locator(KufuLoginSelector.email).waitFor({ state: "visible" });

  await page.fill(KufuLoginSelector.email, ZAIM_EMAIL);
  await page.fill(KufuLoginSelector.password, ZAIM_PASSWORD);
  logger.info("Zaim のログイン情報を入力しました。");

  // 2段階認証が有効な場合は2段階認証画面へ、無効な場合は Zaim へ遷移する
  await Promise.all([
    page.waitForURL((url) => url.pathname === ZaimWebPage.kufuTotpPath || isZaimUrl(url), {
      timeout: 30000,
    }),
    page.locator(KufuLoginSelector.submit).click(),
  ]);
  logger.info("Zaim のログインボタンをクリックしました。");

  if (new URL(page.url()).pathname === ZaimWebPage.kufuTotpPath) {
    if (!ZAIM_TOTP_SECRET) {
      throw new Error(
        "2段階認証を求められましたが、環境変数 ZAIM_TOTP_SECRET が設定されていません。",
      );
    }
    await page.fill(KufuTwoFactorSelector.passcode, await generateFreshTotp(ZAIM_TOTP_SECRET));
    logger.info("2段階認証のコードを入力しました。");

    await Promise.all([
      page.waitForURL(isZaimUrl, { timeout: 30000 }),
      page.locator(KufuTwoFactorSelector.submit).click(),
    ]);
  }

  logger.info("Zaim へのログインが完了しました。");
}
