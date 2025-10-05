#!/usr/bin/env node
import { Command } from "commander";
import dayjs from "dayjs";
import { loadConfig } from "../modules/config.js";
import { configureLogger, logger, MatsuiScraper, Zaim } from "../modules/index.js";
import { StrategyFactory } from "../modules/matsui/strategies/index.js";
import { TotalAmountRepository } from "../modules/sync/total-amount-repository.js";
import type { Position, PositionDetails } from "../types/matsui.js";

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
      const { dryRun } = options;

      const config = loadConfig();
      const accounts = config.accounts.filter((acc) => acc.enabled);
      if (accounts.length === 0) {
        throw new Error("有効なアカウントが1つもありません。");
      }

      if (!ZAIM_TOTAL_AMOUNT_FILE) {
        throw new Error(`環境変数 ZAIM_TOTAL_AMOUNT_FILE が設定されていません。`);
      }

      // 資産評価額を取得
      let positionData: PositionDetails | null = null;
      let scraper: MatsuiScraper | null = null;
      try {
        // Strategyパターンを使用してスクレイピング実行
        scraper = new MatsuiScraper();
        await scraper.initialize();

        logger.info("資産評価額を取得します。");

        scraper.setStrategy(StrategyFactory.create("fund"));

        // 認証処理を実行
        await scraper.authenticate();

        // データを取得
        positionData = (await scraper.scrape<Position>()).details;
        logger.debug(positionData);
        logger.info("資産評価額の取得が完了しました。");
      } catch (error) {
        logger.error(error, "松井証券のスクレイピング中にエラーが発生しました。");
        throw error;
      } finally {
        if (scraper) {
          await scraper.close();
        }
      }

      // 前回記録時点の総額との差分を取得
      logger.info("総額記録ファイルを取得します。");
      const totalAmountRepo = new TotalAmountRepository(ZAIM_TOTAL_AMOUNT_FILE);
      const lastTotalAmountList = totalAmountRepo.load();
      logger.info("前回同期実行後の総額を取得しました。");

      // 口座ごとにZaimに記録する
      // 松井証券の異なる口座の残高を同じZaimの口座に記録することは想定していないため注意
      for (const account of accounts) {
        const currentTotalAmount = positionData[account.matsui.accountName]?.評価額;
        if (typeof currentTotalAmount === "undefined") {
          throw new Error(`${account.name}の評価額を取得できませんでした`);
        }

        let lastTotalAmountItem = lastTotalAmountList.find(
          (item) => item.accountId === account.zaim.accountId
        );
        if (typeof lastTotalAmountItem === "undefined") {
          logger.info(
            `${account.name}の前回総額データがありません。初回実行時は前回総額を0として続行します。`
          );
          lastTotalAmountItem = {
            amount: 0,
            accountId: account.zaim.accountId,
            updatedAt: dayjs().format(),
          };
          lastTotalAmountList.push(lastTotalAmountItem);
        }

        const amount = currentTotalAmount - lastTotalAmountItem.amount;
        logger.info(`${account.name}の記録する金額は ${amount} 円です。`);

        if (dryRun) {
          logger.info("ドライランモードのためZaimへの記録は行いません。");
          continue;
        }
        // Zaim APIにデータを送信
        const zaim = new Zaim();
        await zaim.registerIncomeJournalEntry({
          categoryId: account.zaim.categoryId,
          amount,
          date: dayjs(),
          toAccountId: account.zaim.accountId,
          comment: "自動同期",
        });
        logger.info(`${account.name}のZaimへの記録が完了しました。`);

        // 総額データに反映
        lastTotalAmountItem.amount = currentTotalAmount;
        lastTotalAmountItem.updatedAt = dayjs().format();
      }

      // 総額データを更新
      if (dryRun) {
        logger.info("ドライランモードのため総額データの更新は行いません。");
        return;
      }
      totalAmountRepo.save(lastTotalAmountList);
      logger.info("総額データを更新しました。");
    } catch (error) {
      logger.error(error, "処理中にエラーが発生しました。");
      process.exitCode = 1;
    }
  });

program.parse();
