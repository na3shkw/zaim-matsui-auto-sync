#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../modules/config.js";
import { MatsuiScraper, Zaim } from "../modules/index.js";
import { LoginMethodFactory } from "../modules/matsui/login-methods/index.js";
import { MatsuiZaimSyncService } from "../modules/sync/sync-service.js";
import { TotalAmountRepository } from "../modules/sync/total-amount-repository.js";
import { ZaimApiRegistrar, type ZaimRegistrar } from "../modules/sync/zaim-registrar.js";
import { ZaimWebRegistrar } from "../modules/zaim-web/client.js";
import { runAction } from "./run-action.js";

const { ZAIM_TOTAL_AMOUNT_FILE, MATSUI_LOGIN_METHOD, ZAIM_REGISTER_METHOD } = process.env;

/**
 * 環境変数 ZAIM_REGISTER_METHOD に応じた収入登録方式を生成する
 */
function createZaimRegistrar(): ZaimRegistrar {
  switch (ZAIM_REGISTER_METHOD ?? "api") {
    case "api":
      return new ZaimApiRegistrar(new Zaim());
    case "web":
      return new ZaimWebRegistrar();
    default:
      throw new Error(
        `環境変数 ZAIM_REGISTER_METHOD の値が不正です（api または web を指定してください）: ${ZAIM_REGISTER_METHOD}`,
      );
  }
}

const program = new Command();

program
  .name("sync-matsui-zaim")
  .description("松井証券の資産情報をZaimに同期する")
  .option("--pretty-log", "整形されたログを出力する", false)
  .option(
    "--dry-run",
    "ドライラン（Zaimへの記録と総額記録ファイルの更新を行わない。web の場合は送信直前まで画面を操作する）",
    false,
  )
  .action(async (options) => {
    await runAction(options.prettyLog, async () => {
      if (!ZAIM_TOTAL_AMOUNT_FILE) {
        throw new Error(`環境変数 ZAIM_TOTAL_AMOUNT_FILE が設定されていません。`);
      }

      // 設定読み込み
      const config = loadConfig();

      // 依存性の注入
      const scraper = new MatsuiScraper();
      const loginMethod = LoginMethodFactory.create(
        MATSUI_LOGIN_METHOD === "passkey" ? "passkey" : "password",
      );
      const totalAmountRepo = new TotalAmountRepository(ZAIM_TOTAL_AMOUNT_FILE);
      const zaimRegistrar = createZaimRegistrar();
      const syncService = new MatsuiZaimSyncService(
        scraper,
        loginMethod,
        totalAmountRepo,
        zaimRegistrar,
      );

      // 同期実行
      await syncService.sync(config, { dryRun: options.dryRun });
    });
  });

program.parse();
