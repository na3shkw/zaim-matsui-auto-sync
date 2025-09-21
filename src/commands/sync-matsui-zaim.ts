#!/usr/bin/env node
import { Command } from "commander";
import dayjs from "dayjs";
import fs from "fs";
import { loadConfig } from "../modules/config.js";
import { configureLogger, logger, scrapeMatsui, Zaim } from "../modules/index.js";

const { ZAIM_TOTAL_AMOUNT_FILE } = process.env;

interface LastTotalAmount {
  accountId: number;
  amount: number;
  updatedAt: string;
}

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
      const positionData = await scrapeMatsui();

      // 前回記録時点の総額との差分を取得
      logger.info("総額記録ファイルを取得します。");
      const isAmountFileExists = fs.existsSync(ZAIM_TOTAL_AMOUNT_FILE);
      let lastTotalAmountList: LastTotalAmount[] = [];
      if (isAmountFileExists) {
        lastTotalAmountList = JSON.parse(
          fs.readFileSync(ZAIM_TOTAL_AMOUNT_FILE, { encoding: "utf-8" })
        );
        if (!lastTotalAmountList) {
          throw new Error("総額記録ファイルの中身が空です。");
        }
      } else {
        // 初回実行時のみ通る想定
        logger.info("総額記録ファイルがありません。");
      }
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
      fs.writeFileSync(ZAIM_TOTAL_AMOUNT_FILE, JSON.stringify(lastTotalAmountList, null, 2), {
        encoding: "utf-8",
      });
      logger.info("総額データを更新しました。");
    } catch (error) {
      logger.error(error, "処理中にエラーが発生しました。");
      process.exitCode = 1;
    }
  });

program.parse();
