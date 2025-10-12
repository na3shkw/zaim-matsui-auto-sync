#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../modules/config.js";
import { configureLogger, logger, MatsuiScraper, Zaim } from "../modules/index.js";
import { MatsuiZaimSyncService } from "../modules/sync/sync-service.js";
import { TotalAmountRepository } from "../modules/sync/total-amount-repository.js";

const { ZAIM_TOTAL_AMOUNT_FILE } = process.env;

const program = new Command();

program
  .name("sync-matsui-zaim")
  .description("松井証券の資産情報をZaimに同期する")
  .option("--pretty-log", "整形されたログを出力する", false)
  .option("--dry-run", "ドライラン（Zaimへの記録を行わない）", false)
  .action(async (options) => {
    try {
      configureLogger(options.prettyLog ? "pretty" : "default");

      if (!ZAIM_TOTAL_AMOUNT_FILE) {
        throw new Error(`環境変数 ZAIM_TOTAL_AMOUNT_FILE が設定されていません。`);
      }

      // 設定読み込み
      const config = loadConfig();

      // 依存性の注入
      const scraper = new MatsuiScraper();
      const totalAmountRepo = new TotalAmountRepository(ZAIM_TOTAL_AMOUNT_FILE);
      const zaimClient = new Zaim();
      const syncService = new MatsuiZaimSyncService(scraper, totalAmountRepo, zaimClient);

      // 同期実行
      await syncService.sync(config, { dryRun: options.dryRun });
    } catch (error) {
      logger.error(error, "処理中にエラーが発生しました。");
      process.exitCode = 1;
    }
  });

program.parse();
