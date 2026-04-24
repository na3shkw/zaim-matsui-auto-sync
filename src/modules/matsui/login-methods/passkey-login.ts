import fs from "fs";
import path from "path";
import type { CDPSession, Page } from "playwright";
import { logger } from "../../logger.js";
import { saveStorageState } from "../browser.js";
import { MatsuiPage } from "../page.js";
import type { MatsuiLoginMethod } from "./login-method.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI } = process.env;

const PASSKEY_CREDENTIAL_FILENAME = "passkey-credential.json";

interface PasskeyCredential {
  credentialId: string;
  privateKey: string;
  userHandle: string;
  signCount: number;
  rpId: string;
  isResidentCredential: boolean;
}

/**
 * パスキー認証によるログイン実装
 *
 * 事前に register-matsui-passkey コマンドでパスキーを登録し、
 * 資格情報ファイルを生成しておく必要があります。
 */
export class PasskeyLoginMethod implements MatsuiLoginMethod {
  async login(page: Page): Promise<void> {
    const credentialFile = path.join(CHROMIUM_USER_DATA_DIR_MATSUI!, PASSKEY_CREDENTIAL_FILENAME);

    if (!fs.existsSync(credentialFile)) {
      throw new Error(
        `パスキーの資格情報ファイルが見つかりません: ${credentialFile}\n` +
          "register-matsui-passkey コマンドを実行してパスキーを登録してください。",
      );
    }

    const credential = JSON.parse(fs.readFileSync(credentialFile, "utf-8")) as PasskeyCredential;

    // CDP セッションを取得して仮想認証器を設定
    const cdpSession = await page.context().newCDPSession(page);
    const { authenticatorId } = await this.setupVirtualAuthenticator(cdpSession, credential);
    logger.info("仮想認証器を設定しました。");

    // ログインページに移動
    await page.goto(MatsuiPage.tradeLogin);
    await page.locator("#login-passkey-tag").waitFor({ state: "visible" });

    // パスキーログインに切り替えてボタンをクリック
    await page.locator("#login-passkey-tag").click();
    const passkeyButton = page.locator("#login-passkey-btn");
    await Promise.all([
      page.waitForURL(MatsuiPage.tradeMemberHome, { timeout: 30000 }),
      passkeyButton.click(),
    ]);
    logger.info("パスキーでログインしました。");

    // ログイン成功後に signCount をインクリメントして保存
    await this.updateSignCount(cdpSession, authenticatorId, credential, credentialFile);

    // ログイン成功後にストレージ状態を保存
    await saveStorageState(page.context(), CHROMIUM_USER_DATA_DIR_MATSUI!);
  }

  private async setupVirtualAuthenticator(
    cdpSession: CDPSession,
    credential: PasskeyCredential,
  ): Promise<{ authenticatorId: string }> {
    await cdpSession.send("WebAuthn.enable", { enableUI: false });

    const { authenticatorId } = await cdpSession.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    await cdpSession.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: credential.credentialId,
        isResidentCredential: credential.isResidentCredential,
        rpId: credential.rpId,
        privateKey: credential.privateKey,
        userHandle: credential.userHandle,
        signCount: credential.signCount,
      },
    });

    return { authenticatorId };
  }

  private async updateSignCount(
    cdpSession: CDPSession,
    authenticatorId: string,
    credential: PasskeyCredential,
    credentialFile: string,
  ): Promise<void> {
    const { credentials } = await cdpSession.send("WebAuthn.getCredentials", { authenticatorId });
    const updated = credentials.find((c) => c.credentialId === credential.credentialId);
    if (updated) {
      fs.writeFileSync(
        credentialFile,
        JSON.stringify({ ...credential, signCount: updated.signCount }, null, 2),
        "utf-8",
      );
      logger.info("パスキーの資格情報を更新しました。");
    } else {
      logger.warn("仮想認証器からパスキーの資格情報が見つかりませんでした。signCount が更新されていません。");
    }
  }
}
