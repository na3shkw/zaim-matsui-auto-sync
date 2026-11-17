#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { PersistentBrowser } from "../modules/browser.js";
import { getUserInput, logger } from "../modules/index.js";
import { MATSUI_BLOCKED_SCRIPT_PATTERNS } from "../modules/matsui/browser.js";
import { MatsuiPage } from "../modules/matsui/page.js";
import { runAction } from "./run-action.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, HEADLESS } = process.env;

const PASSKEY_CREDENTIAL_FILENAME = "passkey-credential.json";
const MATSUI_RP_ID = "matsui.co.jp";

const program = new Command();

program
  .name("register-matsui-passkey")
  .description("松井証券のパスキーを登録して資格情報を保存する（初回セットアップ用）")
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    let browser: PersistentBrowser | undefined;
    await runAction(
      options.prettyLog,
      async () => {
        if (!CHROMIUM_USER_DATA_DIR_MATSUI) {
          throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_MATSUI が設定されていません。");
        }

        if (HEADLESS === "true") {
          throw new Error(
            "パスキー登録はヘッドレスモードでは実行できません。HEADLESS=false を設定してください。",
          );
        }

        const credentialFile = path.join(
          CHROMIUM_USER_DATA_DIR_MATSUI,
          PASSKEY_CREDENTIAL_FILENAME,
        );

        browser = new PersistentBrowser(CHROMIUM_USER_DATA_DIR_MATSUI, {
          headless: false,
          restoreStorageState: true,
          blockedScriptPatterns: MATSUI_BLOCKED_SCRIPT_PATTERNS,
        });
        const { browserContext, page } = await browser.open();

        // CDP セッションを設定して仮想認証器を有効化
        const cdpSession = await browserContext.newCDPSession(page);
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
        logger.info({ authenticatorId }, "仮想認証器を設定しました。");

        logger.info(
          "ブラウザでパスキーの登録操作を完了してください。\n松井証券お客様サイト > セキュリティ設定 > パスキー登録 から登録できます。",
        );
        await page.goto(MatsuiPage.tradeMemberHome);

        // ユーザーが登録を完了したら Enter を押してもらう
        await getUserInput("登録が完了したら Enter を押してください...");

        // 仮想認証器からクレデンシャルを取得して保存
        const { credentials } = await cdpSession.send("WebAuthn.getCredentials", {
          authenticatorId,
        });

        const credential = credentials.find((c) => c.rpId === MATSUI_RP_ID);

        if (!credential) {
          throw new Error(
            "パスキーの資格情報が仮想認証器に見つかりません。\n登録操作がこのブラウザウィンドウ上で完了しているか確認してください。",
          );
        }

        fs.writeFileSync(credentialFile, JSON.stringify(credential, null, 2), "utf-8");
        logger.info({ credentialFile }, "パスキーの資格情報を保存しました。");

        logger.info("パスキー登録が完了しました。");
      },
      () => browser?.close(),
    );
  });

program.parse();
